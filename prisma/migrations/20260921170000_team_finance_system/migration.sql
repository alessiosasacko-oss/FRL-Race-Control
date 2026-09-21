-- Additive FRL finance ledger. This migration creates no seed data and does not
-- mutate existing balances or results.
CREATE TYPE "FinanceTransactionType" AS ENUM ('START_BALANCE', 'RACE_POSITION_REWARD', 'POLE_REWARD', 'FASTEST_LAP_REWARD', 'PARTICIPATION_FEE', 'SUPER_LICENSE_FEE', 'DAMAGE_FEE', 'DNF_FEE', 'DSQ_FEE', 'PIT_RETIREMENT_FEE', 'PENALTY_POINTS_FINE', 'RULE_VIOLATION_FINE', 'TEAM_CHAMPIONSHIP_REWARD', 'DRIVER_TRANSFER', 'MANUAL_ADJUSTMENT', 'CORRECTION');
CREATE TYPE "FinanceTransactionSource" AS ENUM ('AUTOMATIC', 'MANUAL');
CREATE TYPE "FinanceSettlementStatus" AS ENUM ('PENDING', 'SETTLED', 'NEEDS_RECONCILIATION');

ALTER TYPE "DiscordChannelPurpose" ADD VALUE IF NOT EXISTS 'FINANCE_STANDINGS';
ALTER TYPE "AutomationJobType" ADD VALUE IF NOT EXISTS 'FINANCE_RECONCILIATION';

CREATE TABLE "FinanceRuleSet" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "version" INTEGER NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "defaultStartBalanceEuro" BIGINT NOT NULL DEFAULT 100000000,
    "participationFeeBps" INTEGER NOT NULL DEFAULT 150,
    "superLicensePerPointEuro" BIGINT NOT NULL DEFAULT 30000,
    "poleRewardEuro" BIGINT NOT NULL DEFAULT 2000000,
    "fastestLapRewardEuro" BIGINT NOT NULL DEFAULT 500000,
    "dnfFeeEuro" BIGINT NOT NULL DEFAULT 3000000,
    "dsqFeeEuro" BIGINT NOT NULL DEFAULT 5000000,
    "pitRetirementFeeEuro" BIGINT NOT NULL DEFAULT 6000000,
    "frontWingDamageFeeEuro" BIGINT NOT NULL DEFAULT 500000,
    "underfloorDamageFeeEuro" BIGINT NOT NULL DEFAULT 1000000,
    "sidepodDamageFeeEuro" BIGINT NOT NULL DEFAULT 1000000,
    "rearWingDamageFeeEuro" BIGINT NOT NULL DEFAULT 1000000,
    "positionRewards" JSONB NOT NULL,
    "penaltyPointThresholds" JSONB NOT NULL,
    "teamChampionshipRewards" JSONB NOT NULL,
    "createdByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinanceRuleSet_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamFinanceAccount" (
    "id" SERIAL NOT NULL,
    "teamId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "balanceEuro" BIGINT NOT NULL DEFAULT 0,
    "totalIncomeEuro" BIGINT NOT NULL DEFAULT 0,
    "totalExpensesEuro" BIGINT NOT NULL DEFAULT 0,
    "ledgerRevision" INTEGER NOT NULL DEFAULT 0,
    "lastTransactionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamFinanceAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceResultFinanceDetail" (
    "id" SERIAL NOT NULL,
    "raceResultId" INTEGER NOT NULL,
    "frontWingDamage" BOOLEAN NOT NULL DEFAULT false,
    "underfloorDamage" BOOLEAN NOT NULL DEFAULT false,
    "sidepodDamage" BOOLEAN NOT NULL DEFAULT false,
    "rearWingDamage" BOOLEAN NOT NULL DEFAULT false,
    "updatedByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RaceResultFinanceDetail_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceFinanceSettlement" (
    "id" SERIAL NOT NULL,
    "raceId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "ruleSetId" INTEGER NOT NULL,
    "status" "FinanceSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "inputHash" CHAR(64),
    "automatic" BOOLEAN NOT NULL DEFAULT false,
    "settledAt" TIMESTAMP(3),
    "settledByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "RaceFinanceSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceFinanceAccountSnapshot" (
    "id" SERIAL NOT NULL,
    "raceSettlementId" INTEGER NOT NULL,
    "accountId" INTEGER NOT NULL,
    "openingBalanceEuro" BIGINT NOT NULL,
    "participantCount" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "RaceFinanceAccountSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SeasonFinanceSettlement" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "ruleSetId" INTEGER NOT NULL,
    "status" "FinanceSettlementStatus" NOT NULL DEFAULT 'PENDING',
    "revision" INTEGER NOT NULL DEFAULT 0,
    "inputHash" CHAR(64),
    "settledAt" TIMESTAMP(3),
    "settledByUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "SeasonFinanceSettlement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TeamFinanceTransaction" (
    "id" SERIAL NOT NULL,
    "accountId" INTEGER NOT NULL,
    "teamId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "raceId" INTEGER,
    "driverId" INTEGER,
    "resultSessionId" INTEGER,
    "raceResultId" INTEGER,
    "ruleSetId" INTEGER,
    "raceSettlementId" INTEGER,
    "seasonSettlementId" INTEGER,
    "actorUserId" INTEGER,
    "amountEuro" BIGINT NOT NULL,
    "type" "FinanceTransactionType" NOT NULL,
    "source" "FinanceTransactionSource" NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "logicalKey" VARCHAR(190),
    "sourceKey" VARCHAR(190) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TeamFinanceTransaction_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "FinancePublishSetting" (
    "id" SERIAL NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "guildSettingsId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "autoReconcile" BOOLEAN NOT NULL DEFAULT false,
    "autoPublish" BOOLEAN NOT NULL DEFAULT false,
    "channelId" VARCHAR(32) NOT NULL,
    "channelName" VARCHAR(160),
    "pingRoleId" VARCHAR(32),
    "pingRoleName" VARCHAR(160),
    "messageTemplate" VARCHAR(1000) NOT NULL DEFAULT 'Die aktuellen FRL-Teamfinanzen nach {race} sind verfügbar.',
    "showBalances" BOOLEAN NOT NULL DEFAULT true,
    "showDelta" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "FinancePublishSetting_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "FinanceRuleSet_leagueId_seasonId_version_key" ON "FinanceRuleSet"("leagueId", "seasonId", "version");
CREATE INDEX "FinanceRuleSet_leagueId_seasonId_active_version_idx" ON "FinanceRuleSet"("leagueId", "seasonId", "active", "version");
CREATE INDEX "FinanceRuleSet_createdByUserId_idx" ON "FinanceRuleSet"("createdByUserId");
CREATE UNIQUE INDEX "TeamFinanceAccount_teamId_key" ON "TeamFinanceAccount"("teamId");
CREATE INDEX "TeamFinanceAccount_leagueId_seasonId_balanceEuro_idx" ON "TeamFinanceAccount"("leagueId", "seasonId", "balanceEuro");
CREATE INDEX "TeamFinanceAccount_seasonId_lastTransactionAt_idx" ON "TeamFinanceAccount"("seasonId", "lastTransactionAt");
CREATE UNIQUE INDEX "RaceResultFinanceDetail_raceResultId_key" ON "RaceResultFinanceDetail"("raceResultId");
CREATE INDEX "RaceResultFinanceDetail_updatedByUserId_idx" ON "RaceResultFinanceDetail"("updatedByUserId");
CREATE INDEX "RaceResultFinanceDetail_updatedAt_idx" ON "RaceResultFinanceDetail"("updatedAt");
CREATE UNIQUE INDEX "RaceFinanceSettlement_raceId_leagueId_key" ON "RaceFinanceSettlement"("raceId", "leagueId");
CREATE INDEX "RaceFinanceSettlement_leagueId_seasonId_status_idx" ON "RaceFinanceSettlement"("leagueId", "seasonId", "status");
CREATE INDEX "RaceFinanceSettlement_ruleSetId_idx" ON "RaceFinanceSettlement"("ruleSetId");
CREATE INDEX "RaceFinanceSettlement_settledByUserId_idx" ON "RaceFinanceSettlement"("settledByUserId");
CREATE UNIQUE INDEX "RaceFinanceAccountSnapshot_raceSettlementId_accountId_key" ON "RaceFinanceAccountSnapshot"("raceSettlementId", "accountId");
CREATE INDEX "RaceFinanceAccountSnapshot_accountId_createdAt_idx" ON "RaceFinanceAccountSnapshot"("accountId", "createdAt");
CREATE UNIQUE INDEX "SeasonFinanceSettlement_seasonId_leagueId_key" ON "SeasonFinanceSettlement"("seasonId", "leagueId");
CREATE INDEX "SeasonFinanceSettlement_leagueId_status_updatedAt_idx" ON "SeasonFinanceSettlement"("leagueId", "status", "updatedAt");
CREATE INDEX "SeasonFinanceSettlement_ruleSetId_idx" ON "SeasonFinanceSettlement"("ruleSetId");
CREATE INDEX "SeasonFinanceSettlement_settledByUserId_idx" ON "SeasonFinanceSettlement"("settledByUserId");
CREATE UNIQUE INDEX "TeamFinanceTransaction_sourceKey_key" ON "TeamFinanceTransaction"("sourceKey");
CREATE INDEX "TeamFinanceTransaction_accountId_createdAt_idx" ON "TeamFinanceTransaction"("accountId", "createdAt");
CREATE INDEX "TeamFinanceTransaction_leagueId_seasonId_createdAt_idx" ON "TeamFinanceTransaction"("leagueId", "seasonId", "createdAt");
CREATE INDEX "TeamFinanceTransaction_teamId_seasonId_createdAt_idx" ON "TeamFinanceTransaction"("teamId", "seasonId", "createdAt");
CREATE INDEX "TeamFinanceTransaction_raceId_leagueId_idx" ON "TeamFinanceTransaction"("raceId", "leagueId");
CREATE INDEX "TeamFinanceTransaction_driverId_createdAt_idx" ON "TeamFinanceTransaction"("driverId", "createdAt");
CREATE INDEX "TeamFinanceTransaction_type_createdAt_idx" ON "TeamFinanceTransaction"("type", "createdAt");
CREATE INDEX "TeamFinanceTransaction_logicalKey_idx" ON "TeamFinanceTransaction"("logicalKey");
CREATE INDEX "TeamFinanceTransaction_raceSettlementId_logicalKey_idx" ON "TeamFinanceTransaction"("raceSettlementId", "logicalKey");
CREATE INDEX "TeamFinanceTransaction_seasonSettlementId_logicalKey_idx" ON "TeamFinanceTransaction"("seasonSettlementId", "logicalKey");
CREATE UNIQUE INDEX "FinancePublishSetting_leagueId_key" ON "FinancePublishSetting"("leagueId");
CREATE INDEX "FinancePublishSetting_guildSettingsId_enabled_idx" ON "FinancePublishSetting"("guildSettingsId", "enabled");
CREATE INDEX "FinancePublishSetting_autoReconcile_autoPublish_idx" ON "FinancePublishSetting"("autoReconcile", "autoPublish");

ALTER TABLE "FinanceRuleSet" ADD CONSTRAINT "FinanceRuleSet_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceRuleSet" ADD CONSTRAINT "FinanceRuleSet_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "FinanceRuleSet" ADD CONSTRAINT "FinanceRuleSet_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceAccount" ADD CONSTRAINT "TeamFinanceAccount_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceAccount" ADD CONSTRAINT "TeamFinanceAccount_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceAccount" ADD CONSTRAINT "TeamFinanceAccount_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaceResultFinanceDetail" ADD CONSTRAINT "RaceResultFinanceDetail_raceResultId_fkey" FOREIGN KEY ("raceResultId") REFERENCES "RaceResult"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceResultFinanceDetail" ADD CONSTRAINT "RaceResultFinanceDetail_updatedByUserId_fkey" FOREIGN KEY ("updatedByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RaceFinanceSettlement" ADD CONSTRAINT "RaceFinanceSettlement_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaceFinanceSettlement" ADD CONSTRAINT "RaceFinanceSettlement_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaceFinanceSettlement" ADD CONSTRAINT "RaceFinanceSettlement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaceFinanceSettlement" ADD CONSTRAINT "RaceFinanceSettlement_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "FinanceRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "RaceFinanceSettlement" ADD CONSTRAINT "RaceFinanceSettlement_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "RaceFinanceAccountSnapshot" ADD CONSTRAINT "RaceFinanceAccountSnapshot_raceSettlementId_fkey" FOREIGN KEY ("raceSettlementId") REFERENCES "RaceFinanceSettlement"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceFinanceAccountSnapshot" ADD CONSTRAINT "RaceFinanceAccountSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TeamFinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeasonFinanceSettlement" ADD CONSTRAINT "SeasonFinanceSettlement_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeasonFinanceSettlement" ADD CONSTRAINT "SeasonFinanceSettlement_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeasonFinanceSettlement" ADD CONSTRAINT "SeasonFinanceSettlement_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "FinanceRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "SeasonFinanceSettlement" ADD CONSTRAINT "SeasonFinanceSettlement_settledByUserId_fkey" FOREIGN KEY ("settledByUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "TeamFinanceAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_resultSessionId_fkey" FOREIGN KEY ("resultSessionId") REFERENCES "RaceResultSession"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_raceResultId_fkey" FOREIGN KEY ("raceResultId") REFERENCES "RaceResult"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_ruleSetId_fkey" FOREIGN KEY ("ruleSetId") REFERENCES "FinanceRuleSet"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_raceSettlementId_fkey" FOREIGN KEY ("raceSettlementId") REFERENCES "RaceFinanceSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_seasonSettlementId_fkey" FOREIGN KEY ("seasonSettlementId") REFERENCES "SeasonFinanceSettlement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TeamFinanceTransaction" ADD CONSTRAINT "TeamFinanceTransaction_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "FinancePublishSetting" ADD CONSTRAINT "FinancePublishSetting_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "FinancePublishSetting" ADD CONSTRAINT "FinancePublishSetting_guildSettingsId_fkey" FOREIGN KEY ("guildSettingsId") REFERENCES "DiscordGuildSettings"("id") ON DELETE CASCADE ON UPDATE CASCADE;
