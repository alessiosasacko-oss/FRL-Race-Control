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
  teamId?: number;
  raceId?: number;
  type?: PrismaFinanceTransactionType;
  page: number;
};

function positiveInteger(value: string | string[] | undefined): number | undefined {
  const input = Array.isArray(value) ? value[0] : value;
  const number = Number(input);
  return Number.isInteger(number) && number > 0 ? number : undefined;
}

export function parseFinanceListQuery(input: Record<string, string | string[] | undefined>): FinanceListQuery {
  const rawType = Array.isArray(input.type) ? input.type[0] : input.type;
  const type = Object.values(PrismaFinanceTransactionType).includes(rawType as PrismaFinanceTransactionType)
    ? rawType as PrismaFinanceTransactionType
    : undefined;
  return {
    leagueId: positiveInteger(input.leagueId),
    seasonId: positiveInteger(input.seasonId),
    teamId: positiveInteger(input.teamId),
    raceId: positiveInteger(input.raceId),
    type,
    page: positiveInteger(input.page) ?? 1,
  };
}

function accountView(account: {
  id: number;
  teamId: number;
  balanceEuro: bigint;
  totalIncomeEuro: bigint;
  totalExpensesEuro: bigint;
  lastTransactionAt: Date | null;
  team: { name: string; shortName: string; color: string; logoUrl: string | null };
  league: { id: number; code: string; name: string };
  season: { id: number; name: string };
}): FinanceAccountView {
  return {
    id: account.id,
    teamId: account.teamId,
    teamName: account.team.name,
    shortName: account.team.shortName,
    color: account.team.color,
    logoUrl: account.team.logoUrl,
    league: account.league,
    season: account.season,
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
  race: { select: { id: true, name: true, circuit: true, countryCode: true, mystery: true, scheduledAt: true, round: true } },
  driver: { select: { id: true, name: true } },
  actor: { select: { displayName: true } },
} as const;

export async function getFinanceAdminData(query: FinanceListQuery) {
  const prisma = getPrismaClient();
  const leagues = await prisma.league.findMany({ orderBy: [{ displayOrder: "asc" }, { code: "asc" }], select: { id: true, code: true, name: true, currentSeasonId: true } });
  const selectedLeague = leagues.find((league) => league.id === query.leagueId) ?? leagues[0] ?? null;
  const seasons = await prisma.season.findMany({
    where: selectedLeague ? { participatingLeagues: { some: { id: selectedLeague.id } } } : undefined,
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    select: { id: true, name: true, active: true, archivedAt: true },
  });
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
    teamId: query.teamId,
    raceId: query.raceId,
    type: query.type,
  };

  const [teams, accounts, races, drivers, transactions, transactionCount, ruleSet, guild, publishSetting, settlements] = await Promise.all([
    prisma.team.findMany({ where: { ...whereContext }, orderBy: { name: "asc" }, select: { id: true, name: true, shortName: true, color: true, logoUrl: true } }),
    prisma.teamFinanceAccount.findMany({
      where: whereContext,
      orderBy: [{ balanceEuro: "desc" }, { team: { name: "asc" } }],
      select: { id: true, teamId: true, balanceEuro: true, totalIncomeEuro: true, totalExpensesEuro: true, lastTransactionAt: true, team: { select: { name: true, shortName: true, color: true, logoUrl: true } }, league: { select: { id: true, code: true, name: true } }, season: { select: { id: true, name: true } } },
    }),
    prisma.race.findMany({ where: seasonId ? { seasonId } : { id: -1 }, orderBy: { round: "desc" }, select: { id: true, name: true, circuit: true, countryCode: true, mystery: true, scheduledAt: true, round: true } }),
    prisma.driver.findMany({ where: leagueId ? { leagueId } : { id: -1 }, orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.teamFinanceTransaction.findMany({ where: transactionWhere, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (query.page - 1) * pageSize, take: pageSize, select: transactionSelection }),
    prisma.teamFinanceTransaction.count({ where: transactionWhere }),
    leagueId && seasonId ? prisma.financeRuleSet.findFirst({ where: { leagueId, seasonId, active: true }, orderBy: { version: "desc" } }) : null,
    prisma.discordGuildSettings.findFirst({ where: { enabled: true }, orderBy: { id: "asc" }, select: { id: true, guildId: true, guildName: true, roleMappings: { where: { enabled: true }, orderBy: { discordRoleName: "asc" }, select: { discordRoleId: true, discordRoleName: true, role: true } } } }),
    leagueId ? prisma.financePublishSetting.findUnique({ where: { leagueId } }) : null,
    leagueId && seasonId ? prisma.raceFinanceSettlement.findMany({ where: { leagueId, seasonId }, orderBy: { updatedAt: "desc" }, select: { raceId: true, revision: true, status: true, updatedAt: true } }) : [],
  ]);
  const channelState = guild ? await getDiscordChannelCatalogState(guild.guildId) : { status: "error" as const, message: "Kein aktiver Discord-Server konfiguriert.", catalog: null };
  const selectedRaceId = races.some((race) => race.id === query.raceId) ? query.raceId : races[0]?.id;
  const [racePreview, seasonPreview, discordPreview] = await Promise.all([
    selectedRaceId && leagueId ? previewRaceFinance(selectedRaceId, leagueId).catch(() => null) : null,
    seasonId && leagueId ? previewSeasonFinance(seasonId, leagueId).catch(() => null) : null,
    selectedRaceId && leagueId && publishSetting ? buildFinanceDiscordPreview(selectedRaceId, leagueId).catch(() => null) : null,
  ]);

  return {
    leagues,
    seasons,
    selectedLeague,
    selectedSeason,
    teams,
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
    settlements: settlements.map((settlement) => ({ ...settlement, updatedAt: settlement.updatedAt.toISOString() })),
    racePreview,
    seasonPreview,
    discordPreview,
  };
}

export async function getAuthorizedTeamFinanceData(user: AuthenticatedUser, requestedTeamId?: number) {
  const prisma = getPrismaClient();
  const canManageAll = hasPermission(user.roles, Permission.ManageFinance);
  const ownedOrganizationSeasons = canManageAll ? [] : await prisma.teamOrganizationSeason.findMany({
    where: { principalUserId: user.id },
    select: { organizationId: true, seasonId: true },
  });
  const ownership = canManageAll ? {} : {
    OR: [
      { principalUserId: user.id },
      ...ownedOrganizationSeasons.map((assignment) => ({
        organizationId: assignment.organizationId,
        seasonId: assignment.seasonId,
      })),
    ],
  };
  const teams = await prisma.team.findMany({
    where: { ...ownership, financeAccount: { isNot: null } },
    orderBy: [{ season: { startsOn: "desc" } }, { league: { displayOrder: "asc" } }, { name: "asc" }],
    select: { id: true, name: true, shortName: true, color: true, logoUrl: true, league: { select: { id: true, code: true, name: true } }, season: { select: { id: true, name: true } }, financeAccount: { select: { id: true, balanceEuro: true, totalIncomeEuro: true, totalExpensesEuro: true, lastTransactionAt: true } } },
  });
  const selectedTeam = teams.find((team) => team.id === requestedTeamId) ?? teams[0] ?? null;
  const transactions = selectedTeam ? await prisma.teamFinanceTransaction.findMany({ where: { teamId: selectedTeam.id }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 50, select: transactionSelection }) : [];
  return {
    canManageAll,
    teams: teams.map((team) => ({ id: team.id, name: team.name, shortName: team.shortName, league: team.league, season: team.season })),
    selected: selectedTeam?.financeAccount ? accountView({ ...selectedTeam.financeAccount, teamId: selectedTeam.id, team: { name: selectedTeam.name, shortName: selectedTeam.shortName, color: selectedTeam.color, logoUrl: selectedTeam.logoUrl }, league: selectedTeam.league, season: selectedTeam.season }) : null,
    transactions: transactions.map(transactionView),
  };
}

export async function getResultFinancePanelData(raceId: number, leagueId: number) {
  const prisma = getPrismaClient();
  const session = await prisma.raceResultSession.findUnique({
    where: { raceId_leagueId_session: { raceId, leagueId, session: ResultSession.RACE } },
    select: {
      publicationStatus: true,
      results: {
        orderBy: [{ finalPosition: { sort: "asc", nulls: "last" } }, { position: "asc" }],
        select: { id: true, status: true, finalPosition: true, driver: { select: { name: true } }, representedTeam: { select: { name: true } }, financeDetail: { select: { frontWingDamage: true, underfloorDamage: true, sidepodDamage: true, rearWingDamage: true } } },
      },
    },
  });
  const preview = await previewRaceFinance(raceId, leagueId).catch(() => null);
  return { session, preview };
}

export { formatEuro };
