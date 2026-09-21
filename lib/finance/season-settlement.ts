import "server-only";

import { createHash } from "node:crypto";
import {
  FinanceSettlementStatus,
  FinanceTransactionSource,
  FinanceTransactionType,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
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
import { DEFAULT_FINANCE_RULES, rewardForPosition } from "./rules";
import type { SeasonFinancePreview } from "./types";

type SeasonEntry = {
  logicalKey: string;
  team: TeamIdentity;
  amountEuro: bigint;
  description: string;
};

async function calculateSeasonFinance(
  database: FinanceDatabase,
  seasonId: number,
  leagueId: number,
  useCurrentRules = false,
  ruleOverride?: Awaited<ReturnType<typeof getActiveFinanceRuleSet>>,
) {
  const [championship, settlement, activeRuleSet] = await Promise.all([
    database.championship.findUnique({
      where: { leagueId_seasonId: { leagueId, seasonId } },
      select: {
        league: { select: { id: true, code: true, name: true } },
        season: { select: { id: true, name: true, active: true, archivedAt: true } },
        teamStandings: {
          orderBy: { position: "asc" },
          select: {
            position: true,
            team: { select: { id: true, leagueId: true, seasonId: true, name: true, shortName: true, color: true, logoUrl: true } },
          },
        },
      },
    }),
    database.seasonFinanceSettlement.findUnique({
      where: { seasonId_leagueId: { seasonId, leagueId } },
      include: { ruleSet: true },
    }),
    ruleOverride ?? getActiveFinanceRuleSet(database, leagueId, seasonId),
  ]);
  if (!championship) throw new Error("CHAMPIONSHIP_NOT_FOUND");
  const selectedRuleSet = !useCurrentRules && settlement ? settlement.ruleSet : activeRuleSet;
  const rules = selectedRuleSet ? persistedRules(selectedRuleSet) : DEFAULT_FINANCE_RULES;
  const entries: SeasonEntry[] = championship.teamStandings.flatMap((standing) => {
    const amountEuro = rewardForPosition(standing.position, rules.teamChampionshipRewards);
    return amountEuro > BigInt(0) ? [{
      logicalKey: `season:${seasonId}:league:${leagueId}:team:${standing.team.id}:championship-position`,
      team: standing.team,
      amountEuro,
      description: `Team-WM-Endprämie P${standing.position}`,
    }] : [];
  });
  const inputHash = createHash("sha256").update(JSON.stringify({
    seasonId,
    leagueId,
    ruleVersion: selectedRuleSet?.version ?? 0,
    entries: entries.map((entry) => [entry.logicalKey, entry.amountEuro.toString()]),
  })).digest("hex");
  const ready = championship.teamStandings.length > 0;
  const preview: SeasonFinancePreview = {
    ready,
    message: ready ? "Die aktuelle Team-WM-Tabelle ist auszahlungsbereit." : "Es liegt noch keine Team-WM-Tabelle vor.",
    league: championship.league,
    season: { id: championship.season.id, name: championship.season.name },
    ruleSet: { id: selectedRuleSet?.id ?? null, version: selectedRuleSet?.version ?? 0, activeVersion: activeRuleSet?.version ?? null },
    settlement: settlement ? { id: settlement.id, revision: settlement.revision, status: settlement.status as unknown as import("@/domain").FinanceSettlementStatus, inputHash: settlement.inputHash } : null,
    currentInputHash: inputHash,
    needsReconciliation: ready && settlement?.inputHash !== inputHash,
    entries: entries.map((entry) => ({
      logicalKey: entry.logicalKey,
      teamId: entry.team.id,
      teamName: entry.team.name,
      driverId: null,
      driverName: null,
      type: FinanceTransactionType.TEAM_CHAMPIONSHIP_REWARD as unknown as import("@/domain").FinanceTransactionType,
      amountEuro: entry.amountEuro.toString(),
      description: entry.description,
    })),
  };
  return { preview, entries, selectedRuleSet, rules, settlement };
}

export async function previewSeasonFinance(seasonId: number, leagueId: number, useCurrentRules = false): Promise<SeasonFinancePreview> {
  return (await calculateSeasonFinance(getPrismaClient(), seasonId, leagueId, useCurrentRules)).preview;
}

export async function reconcileSeasonFinances(input: { seasonId: number; leagueId: number; actorUserId: number; useCurrentRules?: boolean }) {
  return runSerializable(async (transaction) => {
    const previous = await transaction.seasonFinanceSettlement.findUnique({ where: { seasonId_leagueId: { seasonId: input.seasonId, leagueId: input.leagueId } } });
    const ruleSet = previous && !input.useCurrentRules
      ? await transaction.financeRuleSet.findUnique({ where: { id: previous.ruleSetId } })
      : await ensureFinanceRuleSet(transaction, input.leagueId, input.seasonId, input.actorUserId);
    if (!ruleSet) throw new Error("FINANCE_RULES_NOT_FOUND");
    const calculation = await calculateSeasonFinance(transaction, input.seasonId, input.leagueId, Boolean(input.useCurrentRules), ruleSet);
    if (!calculation.preview.ready) throw new Error("CHAMPIONSHIP_NOT_READY");
    if (previous?.inputHash === calculation.preview.currentInputHash && previous.ruleSetId === ruleSet.id) {
      return { changed: false, settlementId: previous.id, revision: previous.revision };
    }
    for (const entry of calculation.entries) await ensureFinanceAccount(transaction, entry.team, ruleSet.id, calculation.rules.defaultStartBalanceEuro);
    const settlement = await transaction.seasonFinanceSettlement.upsert({
      where: { seasonId_leagueId: { seasonId: input.seasonId, leagueId: input.leagueId } },
      update: { ruleSetId: ruleSet.id, status: FinanceSettlementStatus.PENDING },
      create: { seasonId: input.seasonId, leagueId: input.leagueId, ruleSetId: ruleSet.id, status: FinanceSettlementStatus.PENDING },
    });
    const accounts = await transaction.teamFinanceAccount.findMany({ where: { teamId: { in: calculation.entries.map((entry) => entry.team.id) } } });
    const accountByTeam = new Map(accounts.map((account) => [account.teamId, account]));
    const existing = await transaction.teamFinanceTransaction.findMany({ where: { seasonSettlementId: settlement.id, source: FinanceTransactionSource.AUTOMATIC } });
    const missingTeamIds = [...new Set(existing.map((entry) => entry.teamId))]
      .filter((teamId) => !accountByTeam.has(teamId));
    if (missingTeamIds.length > 0) {
      const historicalTeams = await transaction.team.findMany({
        where: { id: { in: missingTeamIds }, leagueId: input.leagueId, seasonId: input.seasonId },
        select: { id: true, leagueId: true, seasonId: true, name: true, shortName: true, color: true, logoUrl: true, financeAccount: true },
      });
      for (const historicalTeam of historicalTeams) {
        const { financeAccount, ...team } = historicalTeam;
        const account = financeAccount ?? await ensureFinanceAccount(transaction, team, ruleSet.id, calculation.rules.defaultStartBalanceEuro);
        accountByTeam.set(team.id, account);
      }
    }
    const existingByKey = new Map<string, typeof existing>();
    const existingByLogicalKey = new Map<string, typeof existing>();
    for (const entry of existing) {
      if (!entry.logicalKey) continue;
      const compositeKey = `${entry.logicalKey}::team:${entry.teamId}`;
      const values = existingByKey.get(compositeKey) ?? [];
      values.push(entry);
      existingByKey.set(compositeKey, values);
      const logicalValues = existingByLogicalKey.get(entry.logicalKey) ?? [];
      logicalValues.push(entry);
      existingByLogicalKey.set(entry.logicalKey, logicalValues);
    }
    const desiredByKey = new Map(calculation.entries.map((entry) => [`${entry.logicalKey}::team:${entry.team.id}`, entry]));
    const keys = new Set([...existingByKey.keys(), ...desiredByKey.keys()]);
    const revision = settlement.revision + 1;
    let deltaCount = 0;
    for (const compositeKey of [...keys].sort()) {
      const desired = desiredByKey.get(compositeKey);
      const prior = existingByKey.get(compositeKey) ?? [];
      const logicalKey = desired?.logicalKey ?? prior[0]?.logicalKey;
      if (!logicalKey) continue;
      const priorForLogicalKey = existingByLogicalKey.get(logicalKey) ?? [];
      const current = prior.reduce((sum, entry) => sum + entry.amountEuro, BigInt(0));
      const delta = (desired?.amountEuro ?? BigInt(0)) - current;
      if (delta === BigInt(0)) continue;
      const teamId = desired?.team.id ?? prior[0]?.teamId;
      if (!teamId) throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
      const account = accountByTeam.get(teamId);
      if (!account) throw new Error("FINANCE_ACCOUNT_NOT_FOUND");
      const keyHash = createHash("sha256").update(logicalKey).digest("hex").slice(0, 20);
      await appendLedgerEntry(transaction, {
        accountId: account.id,
        teamId,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        ruleSetId: ruleSet.id,
        seasonSettlementId: settlement.id,
        actorUserId: input.actorUserId,
        amountEuro: delta,
        type: priorForLogicalKey.length === 0 ? FinanceTransactionType.TEAM_CHAMPIONSHIP_REWARD : FinanceTransactionType.CORRECTION,
        source: FinanceTransactionSource.AUTOMATIC,
        description: priorForLogicalKey.length === 0 ? desired?.description ?? "Team-WM-Endprämie" : `Korrektur: ${desired?.description ?? prior[0]?.description ?? "Team-WM-Endprämie"}`,
        logicalKey,
        sourceKey: `season:${input.seasonId}:league:${input.leagueId}:revision:${revision}:${keyHash}`,
        metadata: { revision, previousAmountEuro: current.toString(), desiredAmountEuro: (desired?.amountEuro ?? BigInt(0)).toString() },
      });
      deltaCount += 1;
    }
    await transaction.seasonFinanceSettlement.update({
      where: { id: settlement.id },
      data: { status: FinanceSettlementStatus.SETTLED, revision, inputHash: calculation.preview.currentInputHash, ruleSetId: ruleSet.id, settledAt: new Date(), settledByUserId: input.actorUserId },
    });
    await transaction.systemAuditLog.create({
      data: { actorId: input.actorUserId, action: "FINANCE_SEASON_RECONCILED", entityType: "SeasonFinanceSettlement", entityId: settlement.id, metadata: { seasonId: input.seasonId, leagueId: input.leagueId, revision, deltaCount, ruleSetVersion: ruleSet.version } },
    });
    return { changed: deltaCount > 0, settlementId: settlement.id, revision };
  });
}
