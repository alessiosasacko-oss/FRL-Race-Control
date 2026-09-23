import "server-only";

import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import {
  FinanceTransactionSource,
  FinanceTransactionType,
} from "@/generated/prisma/client";
import {
  DEFAULT_FINANCE_RULES,
  parsePositionRules,
  parseThresholdRules,
  serializePositionRules,
  serializeThresholdRules,
  type FinanceRules,
} from "./rules";

export type FinanceDatabase = PrismaClient | Prisma.TransactionClient;

export type TeamIdentity = {
  id: number;
  leagueId: number;
  seasonId: number;
  organization: {
    id: number;
    name: string;
    shortName: string;
    color: string;
    logoUrl: string | null;
  };
};

export function toFinanceTeamIdentity(team: {
  id: number;
  leagueId: number;
  seasonId: number;
  organization: TeamIdentity["organization"] | null;
}): TeamIdentity {
  if (!team.organization) throw new Error("TEAM_ORGANIZATION_NOT_FOUND");
  return { ...team, organization: team.organization };
}

export async function getActiveFinanceRuleSet(
  database: FinanceDatabase,
  leagueId: number,
  seasonId: number,
) {
  return database.financeRuleSet.findFirst({
    where: { leagueId, seasonId, active: true },
    orderBy: { version: "desc" },
  });
}

export async function ensureFinanceRuleSet(
  database: FinanceDatabase,
  leagueId: number,
  seasonId: number,
  actorUserId?: number | null,
) {
  const existing = await getActiveFinanceRuleSet(database, leagueId, seasonId);
  if (existing) return existing;
  return database.financeRuleSet.create({
    data: {
      leagueId,
      seasonId,
      version: 1,
      active: true,
      defaultStartBalanceEuro: DEFAULT_FINANCE_RULES.defaultStartBalanceEuro,
      participationFeeBps: DEFAULT_FINANCE_RULES.participationFeeBps,
      superLicensePerPointEuro: DEFAULT_FINANCE_RULES.superLicensePerPointEuro,
      poleRewardEuro: DEFAULT_FINANCE_RULES.poleRewardEuro,
      fastestLapRewardEuro: DEFAULT_FINANCE_RULES.fastestLapRewardEuro,
      dnfFeeEuro: DEFAULT_FINANCE_RULES.dnfFeeEuro,
      dsqFeeEuro: DEFAULT_FINANCE_RULES.dsqFeeEuro,
      pitRetirementFeeEuro: DEFAULT_FINANCE_RULES.pitRetirementFeeEuro,
      frontWingDamageFeeEuro: DEFAULT_FINANCE_RULES.frontWingDamageFeeEuro,
      underfloorDamageFeeEuro: DEFAULT_FINANCE_RULES.underfloorDamageFeeEuro,
      sidepodDamageFeeEuro: DEFAULT_FINANCE_RULES.sidepodDamageFeeEuro,
      rearWingDamageFeeEuro: DEFAULT_FINANCE_RULES.rearWingDamageFeeEuro,
      positionRewards: serializePositionRules(DEFAULT_FINANCE_RULES.positionRewards),
      penaltyPointThresholds: serializeThresholdRules(DEFAULT_FINANCE_RULES.penaltyPointThresholds),
      teamChampionshipRewards: serializePositionRules(DEFAULT_FINANCE_RULES.teamChampionshipRewards),
      createdByUserId: actorUserId ?? null,
    },
  });
}

export async function ensureFinanceAccount(
  database: FinanceDatabase,
  team: TeamIdentity,
  ruleSetId: number,
  startBalanceEuro: bigint,
) {
  const existing = await database.teamFinanceAccount.findUnique({ where: { organizationId: team.organization.id } });
  if (existing) return existing;
  const now = new Date();
  const account = await database.teamFinanceAccount.create({
    data: {
      organizationId: team.organization.id,
      balanceEuro: startBalanceEuro,
      totalIncomeEuro: startBalanceEuro > BigInt(0) ? startBalanceEuro : BigInt(0),
      totalExpensesEuro: startBalanceEuro < BigInt(0) ? -startBalanceEuro : BigInt(0),
      ledgerRevision: 1,
      lastTransactionAt: now,
    },
  });
  await database.teamFinanceTransaction.create({
    data: {
      accountId: account.id,
      teamId: team.id,
      leagueId: team.leagueId,
      seasonId: team.seasonId,
      ruleSetId,
      amountEuro: startBalanceEuro,
      type: FinanceTransactionType.START_BALANCE,
      source: FinanceTransactionSource.AUTOMATIC,
      description: "Globaler Startkontostand der Teamorganisation",
      logicalKey: `start:organization:${team.organization.id}`,
      sourceKey: `start:organization:${team.organization.id}:initial`,
      metadata: {
        organizationId: team.organization.id,
        sourceTeamId: team.id,
        configuredAmountEuro: startBalanceEuro.toString(),
      },
      createdAt: now,
    },
  });
  return account;
}

export type LedgerEntryInput = {
  accountId: number;
  teamId: number;
  leagueId: number;
  seasonId: number;
  raceId?: number | null;
  driverId?: number | null;
  resultSessionId?: number | null;
  raceResultId?: number | null;
  ruleSetId?: number | null;
  raceSettlementId?: number | null;
  seasonSettlementId?: number | null;
  actorUserId?: number | null;
  amountEuro: bigint;
  type: FinanceTransactionType;
  source: FinanceTransactionSource;
  description: string;
  logicalKey?: string | null;
  sourceKey: string;
  metadata?: Prisma.InputJsonValue;
};

export async function appendLedgerEntry(
  database: FinanceDatabase,
  input: LedgerEntryInput,
) {
  const now = new Date();
  const transaction = await database.teamFinanceTransaction.create({
    data: {
      ...input,
      raceId: input.raceId ?? null,
      driverId: input.driverId ?? null,
      resultSessionId: input.resultSessionId ?? null,
      raceResultId: input.raceResultId ?? null,
      ruleSetId: input.ruleSetId ?? null,
      raceSettlementId: input.raceSettlementId ?? null,
      seasonSettlementId: input.seasonSettlementId ?? null,
      actorUserId: input.actorUserId ?? null,
      logicalKey: input.logicalKey ?? null,
      metadata: input.metadata,
      createdAt: now,
    },
  });
  await database.teamFinanceAccount.update({
    where: { id: input.accountId },
    data: {
      balanceEuro: { increment: input.amountEuro },
      totalIncomeEuro: input.amountEuro > BigInt(0) ? { increment: input.amountEuro } : undefined,
      totalExpensesEuro: input.amountEuro < BigInt(0) ? { increment: -input.amountEuro } : undefined,
      ledgerRevision: { increment: 1 },
      lastTransactionAt: now,
    },
  });
  return transaction;
}

export async function runSerializable<T>(operation: (transaction: Prisma.TransactionClient) => Promise<T>): Promise<T> {
  const { getPrismaClient } = await import("@/lib/db/prisma");
  const prisma = getPrismaClient();
  let lastError: unknown;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await prisma.$transaction(operation, {
        isolationLevel: "Serializable",
        maxWait: 5_000,
        timeout: 20_000,
      });
    } catch (error: unknown) {
      lastError = error;
      if (!(error && typeof error === "object" && "code" in error && (error.code === "P2034" || error.code === "P2002"))) throw error;
    }
  }
  throw lastError;
}

export function persistedRules(ruleSet: {
  defaultStartBalanceEuro: bigint;
  participationFeeBps: number;
  superLicensePerPointEuro: bigint;
  poleRewardEuro: bigint;
  fastestLapRewardEuro: bigint;
  dnfFeeEuro: bigint;
  dsqFeeEuro: bigint;
  pitRetirementFeeEuro: bigint;
  frontWingDamageFeeEuro: bigint;
  underfloorDamageFeeEuro: bigint;
  sidepodDamageFeeEuro: bigint;
  rearWingDamageFeeEuro: bigint;
  positionRewards: unknown;
  penaltyPointThresholds: unknown;
  teamChampionshipRewards: unknown;
}): FinanceRules {
  return {
    ...ruleSet,
    positionRewards: parsePositionRules(ruleSet.positionRewards, DEFAULT_FINANCE_RULES.positionRewards),
    penaltyPointThresholds: parseThresholdRules(ruleSet.penaltyPointThresholds),
    teamChampionshipRewards: parsePositionRules(ruleSet.teamChampionshipRewards, DEFAULT_FINANCE_RULES.teamChampionshipRewards),
  };
}
