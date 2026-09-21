import "server-only";

import { createHash } from "node:crypto";
import {
  FinanceSettlementStatus,
  FinanceTransactionSource,
  FinanceTransactionType,
  ResultPublicationStatus,
  ResultSession,
} from "@/generated/prisma/client";
import { DriverLineupStatus, ResultStatus as DomainResultStatus } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import type { RaceFinancePreview } from "./types";
import {
  appendLedgerEntry,
  ensureFinanceAccount,
  ensureFinanceRuleSet,
  getActiveFinanceRuleSet,
  persistedRules,
  runSerializable,
  type FinanceDatabase,
  type TeamIdentity,
} from "./ledger";
import {
  DEFAULT_FINANCE_RULES,
  amountForPoints,
  damageFees,
  resultStatusFee,
  rewardForPosition,
  roundBasisPoints,
  type FinanceRules,
} from "./rules";

export class FinanceReconciliationError extends Error {
  constructor(public readonly code: "RACE_NOT_FOUND" | "RESULTS_NOT_READY" | "NO_TEAMS") {
    super(code);
    this.name = "FinanceReconciliationError";
  }
}

type RuleRecord = Awaited<ReturnType<typeof getActiveFinanceRuleSet>>;

type DesiredEntry = {
  logicalKey: string;
  team: TeamIdentity;
  driverId: number | null;
  driverName: string | null;
  resultSessionId: number | null;
  raceResultId: number | null;
  type: FinanceTransactionType;
  amountEuro: bigint;
  description: string;
  thresholdEvent?: boolean;
};

type Calculation = {
  preview: RaceFinancePreview;
  entries: DesiredEntry[];
  teams: TeamIdentity[];
  ruleSet: NonNullable<RuleRecord> | null;
  rules: FinanceRules;
  settlement: {
    id: number;
    ruleSetId: number;
    revision: number;
    inputHash: string | null;
    status: FinanceSettlementStatus;
  } | null;
  openingBalances: Map<number, bigint>;
};

const resultSelect = {
  id: true,
  driverId: true,
  representedTeamId: true,
  status: true,
  finalPosition: true,
  fastestLap: true,
  polePosition: true,
  racePoints: true,
  bonusPoints: true,
  driver: {
    select: {
      name: true,
      seasonAssignments: {
        select: { seasonId: true, lineupStatus: true },
      },
    },
  },
  representedTeam: {
    select: {
      id: true,
      leagueId: true,
      seasonId: true,
      name: true,
      shortName: true,
      color: true,
      logoUrl: true,
    },
  },
  financeDetail: {
    select: {
      frontWingDamage: true,
      underfloorDamage: true,
      sidepodDamage: true,
      rearWingDamage: true,
      updatedAt: true,
    },
  },
} as const;

async function calculateRaceFinance(
  database: FinanceDatabase,
  raceId: number,
  leagueId: number,
  options: { useCurrentRules?: boolean; ruleSetOverride?: NonNullable<RuleRecord> | null } = {},
): Promise<Calculation> {
  const race = await database.race.findUnique({
    where: { id: raceId },
    select: {
      id: true,
      seasonId: true,
      name: true,
      round: true,
      scheduledAt: true,
      season: {
        select: {
          name: true,
          participatingLeagues: {
            where: { id: leagueId },
            select: { id: true, code: true, name: true },
          },
        },
      },
      resultSessions: {
        where: { leagueId, publicationStatus: ResultPublicationStatus.PUBLISHED },
        select: {
          id: true,
          session: true,
          revision: true,
          updatedAt: true,
          results: { select: resultSelect, orderBy: [{ finalPosition: { sort: "asc", nulls: "last" } }, { position: "asc" }] },
        },
      },
      financeSettlements: {
        where: { leagueId },
        select: {
          id: true,
          ruleSetId: true,
          revision: true,
          inputHash: true,
          status: true,
          createdAt: true,
          ruleSet: true,
          accountSnapshots: { select: { accountId: true, openingBalanceEuro: true } },
        },
      },
    },
  });
  const league = race?.season.participatingLeagues[0];
  if (!race || !league) throw new FinanceReconciliationError("RACE_NOT_FOUND");

  const settlement = race.financeSettlements[0] ?? null;
  const activeRuleSet = options.ruleSetOverride ?? await getActiveFinanceRuleSet(database, leagueId, race.seasonId);
  const selectedRuleSet = !options.useCurrentRules && settlement ? settlement.ruleSet : activeRuleSet;
  const rules = selectedRuleSet ? persistedRules(selectedRuleSet) : DEFAULT_FINANCE_RULES;
  const sessionByType = new Map(race.resultSessions.map((session) => [session.session, session]));
  const qualifying = sessionByType.get(ResultSession.QUALIFYING);
  const raceSession = sessionByType.get(ResultSession.RACE);
  const ready = Boolean(qualifying && raceSession);

  const allResults = race.resultSessions.flatMap((session) => session.results);
  const teamMap = new Map<number, TeamIdentity>();
  for (const result of allResults) teamMap.set(result.representedTeam.id, result.representedTeam);
  const teams = [...teamMap.values()].sort((left, right) => left.name.localeCompare(right.name, "de"));
  const accounts = teams.length > 0
    ? await database.teamFinanceAccount.findMany({ where: { teamId: { in: teams.map((team) => team.id) } } })
    : [];
  const accountByTeam = new Map(accounts.map((account) => [account.teamId, account]));
  const snapshotByAccount = new Map(settlement?.accountSnapshots.map((snapshot) => [snapshot.accountId, snapshot.openingBalanceEuro]) ?? []);
  const accountsWithoutSnapshot = settlement
    ? accounts.filter((account) => !snapshotByAccount.has(account.id))
    : [];
  const historicalTransactions = accountsWithoutSnapshot.length > 0 && settlement
    ? await database.teamFinanceTransaction.findMany({
        where: {
          accountId: { in: accountsWithoutSnapshot.map((account) => account.id) },
          createdAt: { lt: settlement.createdAt },
        },
        select: { accountId: true, amountEuro: true },
      })
    : [];
  const historicalOpeningByAccount = new Map<number, bigint>();
  for (const transaction of historicalTransactions) {
    historicalOpeningByAccount.set(
      transaction.accountId,
      (historicalOpeningByAccount.get(transaction.accountId) ?? BigInt(0)) + transaction.amountEuro,
    );
  }
  const openingBalances = new Map<number, bigint>();
  for (const team of teams) {
    const account = accountByTeam.get(team.id);
    openingBalances.set(
      team.id,
      account
        ? snapshotByAccount.get(account.id)
          ?? historicalOpeningByAccount.get(account.id)
          ?? rules.defaultStartBalanceEuro
        : rules.defaultStartBalanceEuro,
    );
  }

  const driverIds = [...new Set(allResults.map((result) => result.driverId))];
  const championship = driverIds.length > 0
    ? await database.championship.findUnique({
        where: { leagueId_seasonId: { leagueId, seasonId: race.seasonId } },
        select: { driverStandings: { where: { driverId: { in: driverIds } }, select: { driverId: true, penaltyPoints: true } } },
      })
    : null;
  const penaltyPoints = new Map(championship?.driverStandings.map((standing) => [standing.driverId, standing.penaltyPoints]) ?? []);
  const thresholdKeys = driverIds.flatMap((driverId) =>
    rules.penaltyPointThresholds.map((threshold) => `pp:season:${race.seasonId}:league:${leagueId}:driver:${driverId}:threshold:${threshold.points}`),
  );
  const priorThresholdTransactions = thresholdKeys.length > 0
    ? await database.teamFinanceTransaction.findMany({
        where: { logicalKey: { in: thresholdKeys }, type: FinanceTransactionType.PENALTY_POINTS_FINE },
        select: { logicalKey: true, amountEuro: true, raceSettlementId: true, teamId: true, driverId: true, description: true },
      })
    : [];
  const priorThresholdByKey = new Map<string, typeof priorThresholdTransactions>();
  for (const transaction of priorThresholdTransactions) {
    if (!transaction.logicalKey) continue;
    const values = priorThresholdByKey.get(transaction.logicalKey) ?? [];
    values.push(transaction);
    priorThresholdByKey.set(transaction.logicalKey, values);
  }

  const entries: DesiredEntry[] = [];
  const add = (entry: DesiredEntry) => {
    if (entry.amountEuro !== BigInt(0)) entries.push(entry);
  };

  if (ready && qualifying && raceSession) {
    const pole = qualifying.results.find((result) => result.polePosition);
    if (pole) add({
      logicalKey: `race:${raceId}:league:${leagueId}:driver:${pole.driverId}:pole`,
      team: pole.representedTeam,
      driverId: pole.driverId,
      driverName: pole.driver.name,
      resultSessionId: qualifying.id,
      raceResultId: pole.id,
      type: FinanceTransactionType.POLE_REWARD,
      amountEuro: rules.poleRewardEuro,
      description: "Pole Position im finalen Qualifying",
    });

    for (const result of raceSession.results) {
      const opening = openingBalances.get(result.representedTeamId) ?? rules.defaultStartBalanceEuro;
      if (result.status !== "DNS") add({
        logicalKey: `race:${raceId}:league:${leagueId}:driver:${result.driverId}:participation`,
        team: result.representedTeam,
        driverId: result.driverId,
        driverName: result.driver.name,
        resultSessionId: raceSession.id,
        raceResultId: result.id,
        type: FinanceTransactionType.PARTICIPATION_FEE,
        amountEuro: -roundBasisPoints(opening, rules.participationFeeBps),
        description: `Teilnahmegebühr (${(rules.participationFeeBps / 100).toLocaleString("de-DE")} % vom Opening Balance)`,
      });
      const positionReward = rewardForPosition(result.finalPosition, rules.positionRewards);
      if (positionReward > BigInt(0)) add({
        logicalKey: `race:${raceId}:league:${leagueId}:driver:${result.driverId}:race-position`,
        team: result.representedTeam,
        driverId: result.driverId,
        driverName: result.driver.name,
        resultSessionId: raceSession.id,
        raceResultId: result.id,
        type: FinanceTransactionType.RACE_POSITION_REWARD,
        amountEuro: positionReward,
        description: `Rennplatzierung P${result.finalPosition}`,
      });
      if (result.fastestLap && result.finalPosition && result.finalPosition <= 12) add({
        logicalKey: `race:${raceId}:league:${leagueId}:driver:${result.driverId}:fastest-lap`,
        team: result.representedTeam,
        driverId: result.driverId,
        driverName: result.driver.name,
        resultSessionId: raceSession.id,
        raceResultId: result.id,
        type: FinanceTransactionType.FASTEST_LAP_REWARD,
        amountEuro: rules.fastestLapRewardEuro,
        description: "Schnellste Rennrunde · Top 12",
      });
      const statusFee = resultStatusFee(result.status as DomainResultStatus, rules);
      if (statusFee) add({
        logicalKey: `race:${raceId}:league:${leagueId}:driver:${result.driverId}:status`,
        team: result.representedTeam,
        driverId: result.driverId,
        driverName: result.driver.name,
        resultSessionId: raceSession.id,
        raceResultId: result.id,
        type: result.status === "DSQ" ? FinanceTransactionType.DSQ_FEE : result.status === "RETIRED" ? FinanceTransactionType.PIT_RETIREMENT_FEE : FinanceTransactionType.DNF_FEE,
        amountEuro: -statusFee.amountEuro,
        description: `${statusFee.label}-Gebühr`,
      });
      for (const damage of damageFees(result.financeDetail ?? { frontWingDamage: false, underfloorDamage: false, sidepodDamage: false, rearWingDamage: false }, rules)) add({
        logicalKey: `race:${raceId}:league:${leagueId}:driver:${result.driverId}:damage:${damage.key}`,
        team: result.representedTeam,
        driverId: result.driverId,
        driverName: result.driver.name,
        resultSessionId: raceSession.id,
        raceResultId: result.id,
        type: FinanceTransactionType.DAMAGE_FEE,
        amountEuro: -damage.amountEuro,
        description: `${damage.label}-Schaden`,
      });
    }

    for (const session of race.resultSessions.filter((candidate) => candidate.session === ResultSession.RACE || candidate.session === ResultSession.SPRINT)) {
      for (const result of session.results) {
        const primary = result.driver.seasonAssignments.some((assignment) =>
          assignment.seasonId === race.seasonId && assignment.lineupStatus === DriverLineupStatus.Primary,
        );
        const points = result.racePoints + result.bonusPoints;
        const fee = primary ? amountForPoints(points, rules.superLicensePerPointEuro) : BigInt(0);
        if (fee > BigInt(0)) add({
          logicalKey: `race:${raceId}:league:${leagueId}:driver:${result.driverId}:super-license:${session.session.toLowerCase()}`,
          team: result.representedTeam,
          driverId: result.driverId,
          driverName: result.driver.name,
          resultSessionId: session.id,
          raceResultId: result.id,
          type: FinanceTransactionType.SUPER_LICENSE_FEE,
          amountEuro: -fee,
          description: `Superlizenz · ${points.toLocaleString("de-DE")} Punkte`,
        });
      }
    }

    const raceResultByDriver = new Map(raceSession.results.map((result) => [result.driverId, result]));
    for (const [driverId, points] of penaltyPoints) {
      const result = raceResultByDriver.get(driverId);
      if (!result) continue;
      for (const threshold of rules.penaltyPointThresholds.filter((candidate) => points >= candidate.points)) {
        const logicalKey = `pp:season:${race.seasonId}:league:${leagueId}:driver:${driverId}:threshold:${threshold.points}`;
        const prior = priorThresholdByKey.get(logicalKey) ?? [];
        const currentSettlementTotal = prior
          .filter((transaction) => transaction.raceSettlementId === settlement?.id)
          .reduce((total, transaction) => total + transaction.amountEuro, BigInt(0));
        if (currentSettlementTotal !== BigInt(0)) {
          add({ logicalKey, team: result.representedTeam, driverId, driverName: result.driver.name, resultSessionId: raceSession.id, raceResultId: result.id, type: FinanceTransactionType.PENALTY_POINTS_FINE, amountEuro: currentSettlementTotal, description: `${threshold.points}-PP-Schwellenwert`, thresholdEvent: true });
        } else if (prior.length === 0) {
          add({ logicalKey, team: result.representedTeam, driverId, driverName: result.driver.name, resultSessionId: raceSession.id, raceResultId: result.id, type: FinanceTransactionType.PENALTY_POINTS_FINE, amountEuro: -threshold.amountEuro, description: `${threshold.points}-PP-Schwellenwert erstmals erreicht`, thresholdEvent: true });
        }
      }
    }
  }

  entries.sort((left, right) => left.logicalKey.localeCompare(right.logicalKey));
  const inputHash = createHash("sha256").update(JSON.stringify({
    raceId,
    leagueId,
    ruleVersion: selectedRuleSet?.version ?? 0,
    sessions: race.resultSessions.map((session) => ({ id: session.id, session: session.session, revision: session.revision, updatedAt: session.updatedAt.toISOString() })),
    openings: [...openingBalances.entries()].sort(([left], [right]) => left - right).map(([teamId, balance]) => [teamId, balance.toString()]),
    entries: entries.map((entry) => [entry.logicalKey, entry.team.id, entry.amountEuro.toString()]),
  })).digest("hex");
  const teamTotals = teams.map((team) => {
    const teamEntries = entries.filter((entry) => entry.team.id === team.id);
    const income = teamEntries.filter((entry) => entry.amountEuro > BigInt(0)).reduce((sum, entry) => sum + entry.amountEuro, BigInt(0));
    const expenses = teamEntries.filter((entry) => entry.amountEuro < BigInt(0)).reduce((sum, entry) => sum - entry.amountEuro, BigInt(0));
    return {
      teamId: team.id,
      teamName: team.name,
      openingBalanceEuro: (openingBalances.get(team.id) ?? rules.defaultStartBalanceEuro).toString(),
      incomeEuro: income.toString(),
      expensesEuro: expenses.toString(),
      netEuro: (income - expenses).toString(),
    };
  });

  return {
    entries,
    teams,
    ruleSet: selectedRuleSet,
    rules,
    settlement: settlement ? { id: settlement.id, ruleSetId: settlement.ruleSetId, revision: settlement.revision, inputHash: settlement.inputHash, status: settlement.status } : null,
    openingBalances,
    preview: {
      ready,
      message: ready ? "Qualifying und Rennen sind veröffentlicht." : "Qualifying und Rennen müssen veröffentlicht sein, bevor Finanzen finalisiert werden.",
      race: { id: race.id, name: race.name, round: race.round, scheduledAt: race.scheduledAt.toISOString() },
      league,
      season: { id: race.seasonId, name: race.season.name },
      ruleSet: { id: selectedRuleSet?.id ?? null, version: selectedRuleSet?.version ?? 0, activeVersion: activeRuleSet?.version ?? null },
      settlement: settlement ? { id: settlement.id, revision: settlement.revision, status: settlement.status as unknown as import("@/domain").FinanceSettlementStatus, inputHash: settlement.inputHash } : null,
      currentInputHash: inputHash,
      needsReconciliation: ready && settlement?.inputHash !== inputHash,
      entries: entries.map((entry) => ({ logicalKey: entry.logicalKey, teamId: entry.team.id, teamName: entry.team.name, driverId: entry.driverId, driverName: entry.driverName, type: entry.type as unknown as import("@/domain").FinanceTransactionType, amountEuro: entry.amountEuro.toString(), description: entry.description })),
      teamTotals,
    },
  };
}

export async function previewRaceFinance(raceId: number, leagueId: number, useCurrentRules = false): Promise<RaceFinancePreview> {
  return (await calculateRaceFinance(getPrismaClient(), raceId, leagueId, { useCurrentRules })).preview;
}

async function teamIdentitiesForPublishedRace(database: FinanceDatabase, raceId: number, leagueId: number): Promise<TeamIdentity[]> {
  const sessions = await database.raceResultSession.findMany({
    where: { raceId, leagueId, publicationStatus: ResultPublicationStatus.PUBLISHED },
    select: { results: { select: { representedTeam: { select: { id: true, leagueId: true, seasonId: true, name: true, shortName: true, color: true, logoUrl: true } } } } },
  });
  return [...new Map(sessions.flatMap((session) => session.results).map((result) => [result.representedTeam.id, result.representedTeam])).values()];
}

export async function reconcileRaceFinances(input: {
  raceId: number;
  leagueId: number;
  actorUserId?: number | null;
  automatic?: boolean;
  useCurrentRules?: boolean;
}) {
  return runSerializable(async (transaction) => {
    const race = await transaction.race.findUnique({ where: { id: input.raceId }, select: { seasonId: true } });
    if (!race) throw new FinanceReconciliationError("RACE_NOT_FOUND");
    const previousSettlement = await transaction.raceFinanceSettlement.findUnique({
      where: { raceId_leagueId: { raceId: input.raceId, leagueId: input.leagueId } },
      select: { id: true, ruleSetId: true },
    });
    const ruleSet = previousSettlement && !input.useCurrentRules
      ? await transaction.financeRuleSet.findUnique({ where: { id: previousSettlement.ruleSetId } })
      : await ensureFinanceRuleSet(transaction, input.leagueId, race.seasonId, input.actorUserId);
    if (!ruleSet) throw new FinanceReconciliationError("RACE_NOT_FOUND");
    const rules = persistedRules(ruleSet);
    const teams = await teamIdentitiesForPublishedRace(transaction, input.raceId, input.leagueId);
    if (teams.length === 0) throw new FinanceReconciliationError("NO_TEAMS");
    for (const team of teams) await ensureFinanceAccount(transaction, team, ruleSet.id, rules.defaultStartBalanceEuro);

    const calculation = await calculateRaceFinance(transaction, input.raceId, input.leagueId, { useCurrentRules: input.useCurrentRules, ruleSetOverride: ruleSet });
    if (!calculation.preview.ready) throw new FinanceReconciliationError("RESULTS_NOT_READY");
    if (calculation.settlement?.inputHash === calculation.preview.currentInputHash && calculation.settlement.ruleSetId === ruleSet.id) {
      return { changed: false, settlementId: calculation.settlement.id, revision: calculation.settlement.revision, preview: calculation.preview };
    }

    const settlement = await transaction.raceFinanceSettlement.upsert({
      where: { raceId_leagueId: { raceId: input.raceId, leagueId: input.leagueId } },
      update: { ruleSetId: ruleSet.id, status: FinanceSettlementStatus.PENDING },
      create: { raceId: input.raceId, leagueId: input.leagueId, seasonId: race.seasonId, ruleSetId: ruleSet.id, status: FinanceSettlementStatus.PENDING },
    });
    const accountRows = await transaction.teamFinanceAccount.findMany({ where: { teamId: { in: teams.map((team) => team.id) } } });
    const accountByTeam = new Map(accountRows.map((account) => [account.teamId, account]));
    for (const team of teams) {
      const account = accountByTeam.get(team.id);
      if (!account) throw new FinanceReconciliationError("NO_TEAMS");
      await transaction.raceFinanceAccountSnapshot.upsert({
        where: { raceSettlementId_accountId: { raceSettlementId: settlement.id, accountId: account.id } },
        update: {},
        create: {
          raceSettlementId: settlement.id,
          accountId: account.id,
          openingBalanceEuro: calculation.openingBalances.get(team.id) ?? account.balanceEuro,
          participantCount: calculation.entries.filter((entry) => entry.team.id === team.id && entry.type === FinanceTransactionType.PARTICIPATION_FEE).length,
        },
      });
    }

    const existing = await transaction.teamFinanceTransaction.findMany({
      where: { raceSettlementId: settlement.id, source: FinanceTransactionSource.AUTOMATIC },
      orderBy: { id: "asc" },
    });
    const missingTeamIds = [...new Set(existing.map((entry) => entry.teamId))]
      .filter((teamId) => !accountByTeam.has(teamId));
    if (missingTeamIds.length > 0) {
      const historicalTeams = await transaction.team.findMany({
        where: { id: { in: missingTeamIds }, leagueId: input.leagueId, seasonId: race.seasonId },
        select: { id: true, leagueId: true, seasonId: true, name: true, shortName: true, color: true, logoUrl: true, financeAccount: true },
      });
      for (const historicalTeam of historicalTeams) {
        const { financeAccount, ...team } = historicalTeam;
        const account = financeAccount ?? await ensureFinanceAccount(transaction, team, ruleSet.id, rules.defaultStartBalanceEuro);
        accountByTeam.set(team.id, account);
        if (!teams.some((candidate) => candidate.id === team.id)) teams.push(team);
      }
    }
    const existingByKey = new Map<string, typeof existing>();
    const existingByLogicalKey = new Map<string, typeof existing>();
    for (const entry of existing) {
      if (!entry.logicalKey) continue;
      const compositeKey = `${entry.logicalKey}::team:${entry.teamId}`;
      const group = existingByKey.get(compositeKey) ?? [];
      group.push(entry);
      existingByKey.set(compositeKey, group);
      const logicalGroup = existingByLogicalKey.get(entry.logicalKey) ?? [];
      logicalGroup.push(entry);
      existingByLogicalKey.set(entry.logicalKey, logicalGroup);
    }
    const desiredByKey = new Map(calculation.entries.map((entry) => [`${entry.logicalKey}::team:${entry.team.id}`, entry]));
    const desiredLogicalKeys = new Set(calculation.entries.map((entry) => entry.logicalKey));
    const keys = new Set([...existingByKey.keys(), ...desiredByKey.keys()]);
    const revision = settlement.revision + 1;
    let deltaCount = 0;
    for (const compositeKey of [...keys].sort()) {
      const desired = desiredByKey.get(compositeKey);
      const prior = existingByKey.get(compositeKey) ?? [];
      const logicalKey = desired?.logicalKey ?? prior[0]?.logicalKey;
      if (!logicalKey) continue;
      const priorForLogicalKey = existingByLogicalKey.get(logicalKey) ?? [];
      const currentAmount = prior.reduce((sum, entry) => sum + entry.amountEuro, BigInt(0));
      if (!desired && !desiredLogicalKeys.has(logicalKey) && prior.some((entry) => entry.type === FinanceTransactionType.PENALTY_POINTS_FINE)) continue;
      const desiredAmount = desired?.amountEuro ?? BigInt(0);
      const delta = desiredAmount - currentAmount;
      if (delta === BigInt(0)) continue;
      const reference = desired ?? calculation.entries.find((entry) => entry.team.id === prior[0]?.teamId);
      const team = reference?.team ?? teams.find((candidate) => candidate.id === prior[0]?.teamId);
      const account = team ? accountByTeam.get(team.id) : null;
      if (!team || !account) throw new FinanceReconciliationError("NO_TEAMS");
      const thresholdInitial = Boolean(desired?.thresholdEvent && priorForLogicalKey.length === 0);
      const keyHash = createHash("sha256").update(logicalKey).digest("hex").slice(0, 20);
      await appendLedgerEntry(transaction, {
        accountId: account.id,
        teamId: team.id,
        leagueId: input.leagueId,
        seasonId: race.seasonId,
        raceId: input.raceId,
        driverId: desired?.driverId ?? prior[0]?.driverId,
        resultSessionId: desired?.resultSessionId ?? prior[0]?.resultSessionId,
        raceResultId: desired?.raceResultId ?? prior[0]?.raceResultId,
        ruleSetId: ruleSet.id,
        raceSettlementId: settlement.id,
        actorUserId: input.actorUserId,
        amountEuro: delta,
        type: priorForLogicalKey.length === 0 && desired ? desired.type : FinanceTransactionType.CORRECTION,
        source: FinanceTransactionSource.AUTOMATIC,
        description: priorForLogicalKey.length === 0 && desired ? desired.description : `Korrektur: ${desired?.description ?? prior[0]?.description ?? "entfallene automatische Buchung"}`,
        logicalKey,
        sourceKey: thresholdInitial ? logicalKey : `race:${input.raceId}:league:${input.leagueId}:revision:${revision}:${keyHash}`,
        metadata: { revision, previousAmountEuro: currentAmount.toString(), desiredAmountEuro: desiredAmount.toString() },
      });
      deltaCount += 1;
    }
    await transaction.raceFinanceSettlement.update({
      where: { id: settlement.id },
      data: {
        ruleSetId: ruleSet.id,
        status: FinanceSettlementStatus.SETTLED,
        revision,
        inputHash: calculation.preview.currentInputHash,
        automatic: Boolean(input.automatic),
        settledAt: new Date(),
        settledByUserId: input.actorUserId ?? null,
      },
    });
    await transaction.systemAuditLog.create({
      data: {
        actorId: input.actorUserId ?? null,
        action: "FINANCE_RACE_RECONCILED",
        entityType: "RaceFinanceSettlement",
        entityId: settlement.id,
        metadata: { raceId: input.raceId, leagueId: input.leagueId, revision, deltaCount, automatic: Boolean(input.automatic), ruleSetVersion: ruleSet.version },
      },
    });
    return { changed: deltaCount > 0, settlementId: settlement.id, revision, preview: calculation.preview };
  });
}

export async function markRaceFinanceDirty(database: FinanceDatabase, raceId: number, leagueId: number): Promise<void> {
  await database.raceFinanceSettlement.updateMany({
    where: { raceId, leagueId, status: FinanceSettlementStatus.SETTLED },
    data: { status: FinanceSettlementStatus.NEEDS_RECONCILIATION },
  });
}

export async function reconcileAutomaticallyConfiguredRace(raceId: number, leagueId: number) {
  const prisma = getPrismaClient();
  const setting = await prisma.financePublishSetting.findUnique({ where: { leagueId }, select: { autoReconcile: true, autoPublish: true } });
  if (!setting?.autoReconcile) return { processed: false, changed: false };
  try {
    const result = await reconcileRaceFinances({ raceId, leagueId, automatic: true });
    return { processed: true, changed: result.changed, settlementId: result.settlementId, revision: result.revision, autoPublish: setting.autoPublish };
  } catch (error: unknown) {
    if (error instanceof FinanceReconciliationError && error.code === "RESULTS_NOT_READY") return { processed: false, changed: false };
    throw error;
  }
}
