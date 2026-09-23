import "server-only";

import { FinanceTransactionType as PrismaFinanceTransactionType, ResultSession } from "@/generated/prisma/client";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { getDiscordChannelCatalogState } from "@/lib/discord/channels";
import { publicRaceTrack } from "@/lib/races/visibility";
import { previewRaceFinance } from "./reconciliation";
import { buildFinanceDiscordPreview } from "./discord";
import { previewSeasonFinance } from "./season-settlement";
import { DEFAULT_FINANCE_RULES, formatEuro } from "./rules";
import type { FinanceAccountView, FinanceTransactionView } from "./types";

export type FinanceListQuery = {
  leagueId?: number;
  seasonId?: number;
  organizationId?: number;
  raceId?: number;
  driverId?: number;
  type?: PrismaFinanceTransactionType;
  loadDiscordChannels: boolean;
  loadPreviews: boolean;
  page: number;
};

function positiveInteger(value: string | string[] | undefined): number | undefined {
  const input = Array.isArray(value) ? value[0] : value;
  const number = Number(input);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

function enabledFlag(value: string | string[] | undefined): boolean {
  return (Array.isArray(value) ? value[0] : value) === "1";
}

export function parseFinanceListQuery(input: Record<string, string | string[] | undefined>): FinanceListQuery {
  const rawType = Array.isArray(input.type) ? input.type[0] : input.type;
  const type = Object.values(PrismaFinanceTransactionType).includes(rawType as PrismaFinanceTransactionType)
    ? rawType as PrismaFinanceTransactionType
    : undefined;
  return {
    leagueId: positiveInteger(input.leagueId),
    seasonId: positiveInteger(input.seasonId),
    organizationId: positiveInteger(input.organizationId),
    raceId: positiveInteger(input.raceId),
    driverId: positiveInteger(input.driverId),
    type,
    loadDiscordChannels: enabledFlag(input.loadDiscordChannels),
    loadPreviews: enabledFlag(input.loadPreviews),
    page: positiveInteger(input.page) ?? 1,
  };
}

function accountView(account: {
  id: number;
  organizationId: number;
  balanceEuro: bigint;
  totalIncomeEuro: bigint;
  totalExpensesEuro: bigint;
  lastTransactionAt: Date | null;
  organization: { name: string; shortName: string; color: string; logoUrl: string | null };
}): FinanceAccountView {
  return {
    id: account.id,
    organizationId: account.organizationId,
    teamName: account.organization.name,
    shortName: account.organization.shortName,
    color: account.organization.color,
    logoUrl: account.organization.logoUrl,
    balanceEuro: account.balanceEuro.toString(),
    totalIncomeEuro: account.totalIncomeEuro.toString(),
    totalExpensesEuro: account.totalExpensesEuro.toString(),
    lastTransactionAt: account.lastTransactionAt?.toISOString() ?? null,
  };
}

function transactionView(transaction: {
  id: number;
  amountEuro: bigint;
  type: PrismaFinanceTransactionType;
  description: string;
  source: "AUTOMATIC" | "MANUAL";
  createdAt: Date;
  league: { id: number; code: string; name: string };
  season: { id: number; name: string };
  race: { id: number; name: string; circuit: string | null; countryCode: string | null; mystery: boolean; scheduledAt: Date; round: number } | null;
  driver: { id: number; name: string } | null;
  actor: { displayName: string } | null;
}): FinanceTransactionView {
  const race = transaction.race;
  return {
    id: transaction.id,
    amountEuro: transaction.amountEuro.toString(),
    type: transaction.type as unknown as import("@/domain").FinanceTransactionType,
    description: transaction.description,
    source: transaction.source,
    createdAt: transaction.createdAt.toISOString(),
    league: transaction.league,
    season: transaction.season,
    race: race ? { id: race.id, name: publicRaceTrack(race).name, round: race.round, mystery: race.mystery, scheduledAt: race.scheduledAt.toISOString() } : null,
    driver: transaction.driver,
    actor: transaction.actor,
  };
}

const transactionSelection = {
  id: true,
  amountEuro: true,
  type: true,
  description: true,
  source: true,
  createdAt: true,
  league: { select: { id: true, code: true, name: true } },
  season: { select: { id: true, name: true } },
  race: { select: { id: true, name: true, circuit: true, countryCode: true, mystery: true, scheduledAt: true, round: true } },
  driver: { select: { id: true, name: true } },
  actor: { select: { displayName: true } },
} as const;

export async function getFinanceAdminData(query: FinanceListQuery) {
  const prisma = getPrismaClient();
  const [leagues, availableSeasons] = await Promise.all([
    prisma.league.findMany({ orderBy: [{ displayOrder: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true, currentSeasonId: true } }),
    prisma.season.findMany({
      orderBy: [{ startsOn: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        active: true,
        archivedAt: true,
        participatingLeagues: { select: { id: true } },
      },
    }),
  ]);
  const selectedLeague = leagues.find((league) => league.id === query.leagueId) ?? leagues[0] ?? null;
  const seasons = availableSeasons
    .filter((season) => !selectedLeague || season.participatingLeagues.some((league) => league.id === selectedLeague.id))
    .map((season) => ({
      id: season.id,
      name: season.name,
      active: season.active,
      archivedAt: season.archivedAt,
    }));
  const selectedSeason = seasons.find((season) => season.id === query.seasonId)
    ?? seasons.find((season) => season.id === selectedLeague?.currentSeasonId)
    ?? seasons[0]
    ?? null;
  const leagueId = selectedLeague?.id;
  const seasonId = selectedSeason?.id;
  const whereContext = leagueId && seasonId ? { leagueId, seasonId } : { id: -1 };
  const pageSize = 50;
  const transactionWhere = {
    ...whereContext,
    account: query.organizationId ? { organizationId: query.organizationId } : undefined,
    raceId: query.raceId,
    driverId: query.driverId,
    type: query.type,
  };

  const [organizations, accounts, races, drivers, transactions, transactionCount, ruleSet, guild, publishSetting] = await Promise.all([
    prisma.teamOrganization.findMany({
      where: { teams: { some: { ...whereContext } } },
      orderBy: { name: "asc" },
      select: { id: true, name: true, shortName: true, color: true, logoUrl: true },
    }),
    prisma.teamFinanceAccount.findMany({
      orderBy: [{ balanceEuro: "desc" }, { organization: { name: "asc" } }],
      select: { id: true, organizationId: true, balanceEuro: true, totalIncomeEuro: true, totalExpensesEuro: true, lastTransactionAt: true, organization: { select: { name: true, shortName: true, color: true, logoUrl: true } } },
    }),
    prisma.race.findMany({ where: seasonId ? { seasonId } : { id: -1 }, orderBy: { round: "desc" }, select: { id: true, name: true, circuit: true, countryCode: true, mystery: true, scheduledAt: true, round: true } }),
    prisma.driver.findMany({ where: leagueId ? { leagueId } : { id: -1 }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.teamFinanceTransaction.findMany({ where: transactionWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * pageSize, take: pageSize, select: transactionSelection }),
    prisma.teamFinanceTransaction.count({ where: transactionWhere }),
    leagueId && seasonId ? prisma.financeRuleSet.findFirst({ where: { leagueId, seasonId, active: true }, orderBy: { version: "desc" } }) : null,
    prisma.discordGuildSettings.findFirst({ where: { enabled: true }, orderBy: { id: "asc" }, select: { id: true, guildId: true, guildName: true, roleMappings: { where: { enabled: true }, orderBy: { discordRoleName: "asc" }, select: { discordRoleId: true, discordRoleName: true, role: true } } } }),
    leagueId ? prisma.financePublishSetting.findUnique({ where: { leagueId } }) : null,
  ]);
  const channelState = guild && query.loadDiscordChannels
    ? await getDiscordChannelCatalogState(guild.guildId)
    : guild
      ? {
          status: "error" as const,
          message: "Discord-Kanäle werden erst auf Abruf geladen, damit die Finance-Seite nicht auf Discord warten muss.",
          catalog: null,
        }
      : { status: "error" as const, message: "Kein aktiver Discord-Server konfiguriert.", catalog: null };
  const selectedRaceId = races.some((race) => race.id === query.raceId) ? query.raceId : races[0]?.id;
  const [racePreview, seasonPreview, discordPreview] = query.loadPreviews
    ? await Promise.all([
        selectedRaceId && leagueId ? previewRaceFinance(selectedRaceId, leagueId).catch(() => null) : null,
        seasonId && leagueId ? previewSeasonFinance(seasonId, leagueId).catch(() => null) : null,
        selectedRaceId && leagueId && publishSetting ? buildFinanceDiscordPreview(selectedRaceId, leagueId).catch(() => null) : null,
      ])
    : [null, null, null];

  return {
    leagues,
    seasons,
    selectedLeague,
    selectedSeason,
    teams: organizations,
    accounts: accounts.map(accountView),
    races: races.map((race) => ({ id: race.id, name: publicRaceTrack(race).name, round: race.round, scheduledAt: race.scheduledAt.toISOString() })),
    drivers,
    transactions: transactions.map(transactionView),
    pagination: { page: query.page, pageSize, total: transactionCount, pages: Math.max(1, Math.ceil(transactionCount / pageSize)) },
    ruleSet,
    rules: ruleSet ?? DEFAULT_FINANCE_RULES,
    guild,
    channelState,
    publishSetting,
    racePreview,
    seasonPreview,
    discordPreview,
  };
}

export async function getAuthorizedTeamFinanceData(user: AuthenticatedUser, requestedOrganizationId?: number, leagueId?: number) {
  const prisma = getPrismaClient();
  const canManageAll = hasPermission(user.roles, Permission.ManageFinance);
  const organizations = await prisma.teamOrganization.findMany({
    where: {
      financeAccount: { isNot: null },
      ...(canManageAll ? {} : {
        OR: [
          { seasons: { some: { principalUserId: user.id } } },
          { teams: { some: { principalUserId: user.id } } },
        ],
      }),
    },
    orderBy: { name: "asc" },
    select: {
      id: true,
      name: true,
      shortName: true,
      color: true,
      logoUrl: true,
      financeAccount: { select: { id: true, organizationId: true, balanceEuro: true, totalIncomeEuro: true, totalExpensesEuro: true, lastTransactionAt: true } },
    },
  });
  const selectedOrganization = organizations.find((organization) => organization.id === requestedOrganizationId) ?? organizations[0] ?? null;
  const [transactions, leagues] = await Promise.all([
    selectedOrganization?.financeAccount
      ? prisma.teamFinanceTransaction.findMany({
          where: { accountId: selectedOrganization.financeAccount.id, leagueId },
          orderBy: [{ createdAt: "desc" }, { id: "desc" }],
          take: 50,
          select: transactionSelection,
        })
      : [],
    prisma.league.findMany({ orderBy: [{ displayOrder: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true } }),
  ]);
  return {
    canManageAll,
    teams: organizations.map((organization) => ({ id: organization.id, name: organization.name, shortName: organization.shortName })),
    selected: selectedOrganization?.financeAccount ? accountView({ ...selectedOrganization.financeAccount, organization: { name: selectedOrganization.name, shortName: selectedOrganization.shortName, color: selectedOrganization.color, logoUrl: selectedOrganization.logoUrl } }) : null,
    leagues,
    selectedLeagueId: leagueId,
    transactions: transactions.map(transactionView),
  };
}

export async function getResultFinancePanelData(raceId: number, leagueId: number) {
  const prisma = getPrismaClient();
  const [session, preview] = await Promise.all([
    prisma.raceResultSession.findUnique({
      where: { raceId_leagueId_session: { raceId, leagueId, session: ResultSession.RACE } },
      select: {
        publicationStatus: true,
        results: {
          orderBy: [{ finalPosition: { sort: "asc", nulls: "last" } }, { position: "asc" }],
          select: { id: true, status: true, finalPosition: true, driver: { select: { name: true } }, representedTeam: { select: { name: true } }, financeDetail: { select: { frontWingDamage: true, underfloorDamage: true, sidepodDamage: true, rearWingDamage: true } } },
        },
      },
    }),
    previewRaceFinance(raceId, leagueId).catch(() => null),
  ]);
  return { session, preview };
}

export { formatEuro };
