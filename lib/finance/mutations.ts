import "server-only";

import { randomUUID } from "node:crypto";
import {
  DiscordChannelPurpose,
  FinanceTransactionSource,
  FinanceTransactionType,
  ResultSession,
  type Prisma,
} from "@/generated/prisma/client";
import { getDiscordChannelCatalogState } from "@/lib/discord/channels";
import {
  appendLedgerEntry,
  ensureFinanceAccount,
  ensureFinanceRuleSet,
  persistedRules,
  runSerializable,
} from "./ledger";
import { reconcilePublishedResultFinance } from "./automation";
import { serializePositionRules, serializeThresholdRules } from "./rules";
import { markRaceFinanceDirty } from "./reconciliation";

export async function setTeamStartBalance(input: {
  teamId: number;
  leagueId: number;
  seasonId: number;
  amountEuro: bigint;
  description: string;
  actorUserId: number;
}) {
  return runSerializable(async (transaction) => {
    const team = await transaction.team.findFirst({
      where: { id: input.teamId, leagueId: input.leagueId, seasonId: input.seasonId },
      select: { id: true, leagueId: true, seasonId: true, name: true, shortName: true, color: true, logoUrl: true },
    });
    if (!team) throw new Error("TEAM_NOT_FOUND");
    const ruleSet = await ensureFinanceRuleSet(transaction, input.leagueId, input.seasonId, input.actorUserId);
    const account = await ensureFinanceAccount(transaction, team, ruleSet.id, persistedRules(ruleSet).defaultStartBalanceEuro);
    const startEntries = await transaction.teamFinanceTransaction.findMany({
      where: { accountId: account.id, type: FinanceTransactionType.START_BALANCE },
      select: { amountEuro: true },
    });
    const currentStart = startEntries.reduce((total, entry) => total + entry.amountEuro, BigInt(0));
    const delta = input.amountEuro - currentStart;
    if (delta === BigInt(0)) return { changed: false, accountId: account.id };
    const ledgerEntry = await appendLedgerEntry(transaction, {
      accountId: account.id,
      teamId: team.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      ruleSetId: ruleSet.id,
      actorUserId: input.actorUserId,
      amountEuro: delta,
      type: FinanceTransactionType.START_BALANCE,
      source: FinanceTransactionSource.MANUAL,
      description: input.description,
      logicalKey: `start:team:${team.id}`,
      sourceKey: `manual:start:${randomUUID()}`,
      metadata: { previousStartEuro: currentStart.toString(), configuredStartEuro: input.amountEuro.toString() },
    });
    await transaction.systemAuditLog.create({
      data: { actorId: input.actorUserId, action: "FINANCE_START_BALANCE_CHANGED", entityType: "TeamFinanceTransaction", entityId: ledgerEntry.id, metadata: { teamId: team.id, previousStartEuro: currentStart.toString(), configuredStartEuro: input.amountEuro.toString() } },
    });
    return { changed: true, accountId: account.id };
  });
}

export async function createManualFinanceTransaction(input: {
  teamId: number;
  leagueId: number;
  seasonId: number;
  raceId: number | null;
  driverId: number | null;
  amountEuro: bigint;
  type: FinanceTransactionType;
  description: string;
  actorUserId: number;
}) {
  return runSerializable(async (transaction) => {
    const team = await transaction.team.findFirst({
      where: { id: input.teamId, leagueId: input.leagueId, seasonId: input.seasonId },
      select: { id: true, leagueId: true, seasonId: true, name: true, shortName: true, color: true, logoUrl: true },
    });
    if (!team) throw new Error("TEAM_NOT_FOUND");
    if (input.raceId) {
      const race = await transaction.race.findFirst({ where: { id: input.raceId, seasonId: input.seasonId }, select: { id: true } });
      if (!race) throw new Error("RACE_NOT_FOUND");
    }
    if (input.driverId) {
      const driver = await transaction.driver.findFirst({ where: { id: input.driverId, leagueId: input.leagueId }, select: { id: true } });
      if (!driver) throw new Error("DRIVER_NOT_FOUND");
    }
    const ruleSet = await ensureFinanceRuleSet(transaction, input.leagueId, input.seasonId, input.actorUserId);
    const account = await ensureFinanceAccount(transaction, team, ruleSet.id, persistedRules(ruleSet).defaultStartBalanceEuro);
    const forcedExpense = input.type === FinanceTransactionType.RULE_VIOLATION_FINE || input.type === FinanceTransactionType.DRIVER_TRANSFER;
    const amountEuro = forcedExpense ? -abs(input.amountEuro) : input.amountEuro;
    const ledgerEntry = await appendLedgerEntry(transaction, {
      accountId: account.id,
      teamId: team.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      raceId: input.raceId,
      driverId: input.driverId,
      ruleSetId: ruleSet.id,
      actorUserId: input.actorUserId,
      amountEuro,
      type: input.type,
      source: FinanceTransactionSource.MANUAL,
      description: input.description,
      sourceKey: `manual:${randomUUID()}`,
      metadata: { requestedAmountEuro: input.amountEuro.toString() },
    });
    await transaction.systemAuditLog.create({
      data: { actorId: input.actorUserId, action: "FINANCE_MANUAL_TRANSACTION_CREATED", entityType: "TeamFinanceTransaction", entityId: ledgerEntry.id, metadata: { teamId: team.id, type: input.type, amountEuro: amountEuro.toString(), raceId: input.raceId, driverId: input.driverId } },
    });
    return { transactionId: ledgerEntry.id, amountEuro };
  });
}

export async function bookDriverTransfer(input: {
  teamId: number;
  driverId: number;
  leagueId: number;
  seasonId: number;
  marketValueEuro: bigint;
  transferSourceKey: string;
  description: string;
  actorUserId?: number | null;
}) {
  if (!/^transfer:[a-z0-9:_-]{1,160}$/i.test(input.transferSourceKey)) throw new Error("INVALID_TRANSFER_SOURCE_KEY");
  return runSerializable(async (transaction) => {
    const existing = await transaction.teamFinanceTransaction.findUnique({ where: { sourceKey: input.transferSourceKey } });
    if (existing) return { transactionId: existing.id, changed: false };
    const team = await transaction.team.findFirst({ where: { id: input.teamId, leagueId: input.leagueId, seasonId: input.seasonId }, select: { id: true, leagueId: true, seasonId: true, name: true, shortName: true, color: true, logoUrl: true } });
    const driver = await transaction.driver.findUnique({ where: { id: input.driverId }, select: { id: true } });
    if (!team || !driver) throw new Error("TRANSFER_CONTEXT_NOT_FOUND");
    const ruleSet = await ensureFinanceRuleSet(transaction, input.leagueId, input.seasonId, input.actorUserId);
    const account = await ensureFinanceAccount(transaction, team, ruleSet.id, persistedRules(ruleSet).defaultStartBalanceEuro);
    const entry = await appendLedgerEntry(transaction, {
      accountId: account.id,
      teamId: team.id,
      leagueId: input.leagueId,
      seasonId: input.seasonId,
      driverId: input.driverId,
      ruleSetId: ruleSet.id,
      actorUserId: input.actorUserId,
      amountEuro: -abs(input.marketValueEuro),
      type: FinanceTransactionType.DRIVER_TRANSFER,
      source: input.actorUserId ? FinanceTransactionSource.MANUAL : FinanceTransactionSource.AUTOMATIC,
      description: input.description,
      logicalKey: input.transferSourceKey,
      sourceKey: input.transferSourceKey,
      metadata: { marketValueEuro: abs(input.marketValueEuro).toString() },
    });
    return { transactionId: entry.id, changed: true };
  });
}

export async function createFinanceRuleVersion(input: {
  leagueId: number;
  seasonId: number;
  actorUserId: number;
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
  positionRewards: bigint[];
  penaltyPoint8Euro: bigint;
  penaltyPoint20Euro: bigint;
  teamChampionshipRewards: bigint[];
}) {
  return runSerializable(async (transaction) => {
    const season = await transaction.season.findFirst({
      where: { id: input.seasonId, participatingLeagues: { some: { id: input.leagueId } } },
      select: { id: true },
    });
    if (!season) throw new Error("SEASON_LEAGUE_MISMATCH");
    const previous = await transaction.financeRuleSet.findFirst({ where: { leagueId: input.leagueId, seasonId: input.seasonId }, orderBy: { version: "desc" }, select: { version: true } });
    await transaction.financeRuleSet.updateMany({ where: { leagueId: input.leagueId, seasonId: input.seasonId, active: true }, data: { active: false } });
    const ruleSet = await transaction.financeRuleSet.create({
      data: {
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        version: (previous?.version ?? 0) + 1,
        active: true,
        defaultStartBalanceEuro: input.defaultStartBalanceEuro,
        participationFeeBps: input.participationFeeBps,
        superLicensePerPointEuro: input.superLicensePerPointEuro,
        poleRewardEuro: input.poleRewardEuro,
        fastestLapRewardEuro: input.fastestLapRewardEuro,
        dnfFeeEuro: input.dnfFeeEuro,
        dsqFeeEuro: input.dsqFeeEuro,
        pitRetirementFeeEuro: input.pitRetirementFeeEuro,
        frontWingDamageFeeEuro: input.frontWingDamageFeeEuro,
        underfloorDamageFeeEuro: input.underfloorDamageFeeEuro,
        sidepodDamageFeeEuro: input.sidepodDamageFeeEuro,
        rearWingDamageFeeEuro: input.rearWingDamageFeeEuro,
        positionRewards: serializePositionRules(input.positionRewards.map((amountEuro, index) => ({ position: index + 1, amountEuro }))),
        penaltyPointThresholds: serializeThresholdRules([{ points: 8, amountEuro: input.penaltyPoint8Euro }, { points: 20, amountEuro: input.penaltyPoint20Euro }]),
        teamChampionshipRewards: serializePositionRules(input.teamChampionshipRewards.map((amountEuro, index) => ({ position: index + 1, amountEuro }))),
        createdByUserId: input.actorUserId,
      },
    });
    await transaction.systemAuditLog.create({
      data: { actorId: input.actorUserId, action: "FINANCE_RULE_VERSION_CREATED", entityType: "FinanceRuleSet", entityId: ruleSet.id, metadata: { leagueId: input.leagueId, seasonId: input.seasonId, version: ruleSet.version } },
    });
    return ruleSet;
  });
}

export async function saveResultFinanceDamage(input: {
  raceResultId: number;
  frontWingDamage: boolean;
  underfloorDamage: boolean;
  sidepodDamage: boolean;
  rearWingDamage: boolean;
  actorUserId: number;
}) {
  const context = await runSerializable(async (transaction) => {
    const result = await transaction.raceResult.findUnique({
      where: { id: input.raceResultId },
      select: { id: true, resultSession: { select: { raceId: true, leagueId: true, session: true } }, financeDetail: true },
    });
    if (!result || result.resultSession.session !== ResultSession.RACE) throw new Error("RACE_RESULT_NOT_FOUND");
    const previous = result.financeDetail;
    const detail = await transaction.raceResultFinanceDetail.upsert({
      where: { raceResultId: result.id },
      update: { ...damageFields(input), updatedByUserId: input.actorUserId },
      create: { raceResultId: result.id, ...damageFields(input), updatedByUserId: input.actorUserId },
    });
    await markRaceFinanceDirty(transaction, result.resultSession.raceId, result.resultSession.leagueId);
    await transaction.systemAuditLog.create({
      data: { actorId: input.actorUserId, action: "FINANCE_DAMAGE_UPDATED", entityType: "RaceResultFinanceDetail", entityId: detail.id, metadata: { raceResultId: result.id, previous: previous ? damageFields(previous) : null, current: damageFields(detail) } as Prisma.InputJsonValue },
    });
    return { raceId: result.resultSession.raceId, leagueId: result.resultSession.leagueId };
  });
  await reconcilePublishedResultFinance(context.raceId, context.leagueId);
  return context;
}

export async function saveFinancePublishSetting(input: {
  leagueId: number;
  guildSettingsId: number;
  enabled: boolean;
  autoReconcile: boolean;
  autoPublish: boolean;
  channelId: string;
  pingRoleId: string | null;
  messageTemplate: string;
  showBalances: boolean;
  showDelta: boolean;
  actorUserId: number;
}) {
  const { getPrismaClient } = await import("@/lib/db/prisma");
  const prisma = getPrismaClient();
  const guild = await prisma.discordGuildSettings.findUnique({
    where: { id: input.guildSettingsId },
    select: { id: true, guildId: true, roleMappings: { where: { enabled: true }, select: { discordRoleId: true, discordRoleName: true } } },
  });
  if (!guild) throw new Error("DISCORD_GUILD_NOT_FOUND");
  const channelState = await getDiscordChannelCatalogState(guild.guildId);
  const channel = channelState.catalog?.channels.find((candidate) => candidate.id === input.channelId && candidate.selectable);
  if (!channel) throw new Error("DISCORD_CHANNEL_INVALID");
  const role = input.pingRoleId ? guild.roleMappings.find((candidate) => candidate.discordRoleId === input.pingRoleId) : null;
  if (input.pingRoleId && !role) throw new Error("DISCORD_ROLE_INVALID");
  return runSerializable(async (transaction) => {
    const setting = await transaction.financePublishSetting.upsert({
      where: { leagueId: input.leagueId },
      update: {
        guildSettingsId: guild.id,
        enabled: input.enabled,
        autoReconcile: input.autoReconcile,
        autoPublish: input.autoPublish,
        channelId: channel.id,
        channelName: channel.name,
        pingRoleId: role?.discordRoleId ?? null,
        pingRoleName: role?.discordRoleName ?? null,
        messageTemplate: input.messageTemplate,
        showBalances: input.showBalances,
        showDelta: input.showDelta,
      },
      create: {
        leagueId: input.leagueId,
        guildSettingsId: guild.id,
        enabled: input.enabled,
        autoReconcile: input.autoReconcile,
        autoPublish: input.autoPublish,
        channelId: channel.id,
        channelName: channel.name,
        pingRoleId: role?.discordRoleId ?? null,
        pingRoleName: role?.discordRoleName ?? null,
        messageTemplate: input.messageTemplate,
        showBalances: input.showBalances,
        showDelta: input.showDelta,
      },
    });
    await transaction.discordChannelMapping.upsert({
      where: { guildSettingsId_scopeKey_purpose: { guildSettingsId: guild.id, scopeKey: `LEAGUE:${input.leagueId}`, purpose: DiscordChannelPurpose.FINANCE_STANDINGS } },
      update: { leagueId: input.leagueId, channelId: channel.id, channelName: channel.name, enabled: input.enabled },
      create: { guildSettingsId: guild.id, leagueId: input.leagueId, scopeKey: `LEAGUE:${input.leagueId}`, purpose: DiscordChannelPurpose.FINANCE_STANDINGS, channelId: channel.id, channelName: channel.name, enabled: input.enabled },
    });
    await transaction.systemAuditLog.create({
      data: { actorId: input.actorUserId, action: "FINANCE_DISCORD_SETTINGS_UPDATED", entityType: "FinancePublishSetting", entityId: setting.id, metadata: { leagueId: input.leagueId, enabled: input.enabled, autoReconcile: input.autoReconcile, autoPublish: input.autoPublish, channelId: channel.id, pingRoleId: role?.discordRoleId ?? null } },
    });
    return setting;
  });
}

function damageFields(value: { frontWingDamage: boolean; underfloorDamage: boolean; sidepodDamage: boolean; rearWingDamage: boolean }) {
  return {
    frontWingDamage: value.frontWingDamage,
    underfloorDamage: value.underfloorDamage,
    sidepodDamage: value.sidepodDamage,
    rearWingDamage: value.rearWingDamage,
  };
}

function abs(value: bigint): bigint {
  return value < BigInt(0) ? -value : value;
}
