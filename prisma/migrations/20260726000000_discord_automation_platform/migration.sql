-- Phase 9: Discord integration, automation jobs, announcements and webhooks.
CREATE TYPE "DiscordChannelPurpose" AS ENUM (
  'ATTENDANCE_OPENED',
  'ATTENDANCE_CLOSING_SOON',
  'ATTENDANCE_CLOSED',
  'RACE_WEEKEND',
  'SPRINT_RESULTS',
  'RACE_RESULTS',
  'DRIVER_STANDINGS',
  'TEAM_STANDINGS',
  'FIA_DECISION',
  'PENALTY_ISSUED',
  'SEASON_STARTED',
  'SEASON_FINISHED',
  'ADMIN_ANNOUNCEMENT'
);

CREATE TYPE "DiscordDeliveryStatus" AS ENUM (
  'PENDING',
  'SENDING',
  'SENT',
  'FAILED',
  'SKIPPED'
);

CREATE TYPE "AnnouncementTarget" AS ENUM ('APP', 'DISCORD', 'EMAIL', 'ALL');
CREATE TYPE "AnnouncementStatus" AS ENUM (
  'SCHEDULED',
  'PUBLISHED',
  'FAILED',
  'CANCELLED'
);

CREATE TYPE "AutomationJobType" AS ENUM (
  'ATTENDANCE_REMINDERS',
  'UPCOMING_RACE_REMINDERS',
  'CHAMPIONSHIP_VERIFICATION',
  'NOTIFICATION_CLEANUP',
  'EMAIL_QUEUE',
  'DISCORD_QUEUE',
  'MYSTERY_RACE_PUBLICATION',
  'STATISTICS_REFRESH',
  'ANNOUNCEMENT_PUBLICATION',
  'DISCORD_ROLE_SYNC'
);

CREATE TYPE "AutomationJobStatus" AS ENUM (
  'SCHEDULED',
  'RUNNING',
  'COMPLETED',
  'FAILED',
  'DISABLED'
);

CREATE TYPE "WebhookEventType" AS ENUM (
  'RACE_FINISHED',
  'ATTENDANCE_CHANGED',
  'FIA_DECISION',
  'CHAMPIONSHIP_RECALCULATED',
  'NOTIFICATION_CREATED',
  'USER_UPDATED',
  'DISCORD_SYNCHRONIZED'
);

CREATE TYPE "WebhookEventStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'PROCESSED',
  'FAILED'
);

ALTER TABLE "User"
  ADD COLUMN "discordUsername" VARCHAR(64),
  ADD COLUMN "discordGlobalName" VARCHAR(160),
  ADD COLUMN "discordGuildNickname" VARCHAR(160),
  ADD COLUMN "discordAvatarUrl" TEXT,
  ADD COLUMN "discordVerifiedAt" TIMESTAMP(3),
  ADD COLUMN "discordSyncedAt" TIMESTAMP(3);

CREATE TABLE "DiscordGuildSettings" (
  "id" SERIAL NOT NULL,
  "guildId" VARCHAR(32) NOT NULL,
  "guildName" VARCHAR(160) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "botUserId" VARCHAR(32),
  "botUsername" VARCHAR(64),
  "lastConnectedAt" TIMESTAMP(3),
  "lastHeartbeatAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordGuildSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordChannelMapping" (
  "id" SERIAL NOT NULL,
  "guildSettingsId" INTEGER NOT NULL,
  "leagueId" INTEGER,
  "scopeKey" VARCHAR(64) NOT NULL,
  "purpose" "DiscordChannelPurpose" NOT NULL,
  "channelId" VARCHAR(32) NOT NULL,
  "channelName" VARCHAR(160),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordChannelMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordRoleMapping" (
  "id" SERIAL NOT NULL,
  "guildSettingsId" INTEGER NOT NULL,
  "role" "Role" NOT NULL,
  "discordRoleId" VARCHAR(32) NOT NULL,
  "discordRoleName" VARCHAR(160),
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordRoleMapping_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Announcement" (
  "id" SERIAL NOT NULL,
  "createdByUserId" INTEGER NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "content" TEXT NOT NULL,
  "href" VARCHAR(500),
  "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
  "target" "AnnouncementTarget" NOT NULL,
  "status" "AnnouncementStatus" NOT NULL DEFAULT 'SCHEDULED',
  "pinned" BOOLEAN NOT NULL DEFAULT false,
  "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "publishedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Announcement_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DiscordDelivery" (
  "id" SERIAL NOT NULL,
  "guildSettingsId" INTEGER NOT NULL,
  "leagueId" INTEGER,
  "announcementId" INTEGER,
  "purpose" "DiscordChannelPurpose" NOT NULL,
  "status" "DiscordDeliveryStatus" NOT NULL DEFAULT 'PENDING',
  "payload" JSONB NOT NULL,
  "dedupeKey" VARCHAR(190) NOT NULL,
  "channelId" VARCHAR(32),
  "discordMessageId" VARCHAR(32),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DiscordDelivery_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationJob" (
  "id" SERIAL NOT NULL,
  "type" "AutomationJobType" NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" "AutomationJobStatus" NOT NULL DEFAULT 'SCHEDULED',
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "intervalMinutes" INTEGER NOT NULL,
  "nextRunAt" TIMESTAMP(3) NOT NULL,
  "lastRunAt" TIMESTAMP(3),
  "lockedAt" TIMESTAMP(3),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "lastError" TEXT,
  "lastResult" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AutomationJob_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AutomationJobRun" (
  "id" SERIAL NOT NULL,
  "jobId" INTEGER NOT NULL,
  "retryActorId" INTEGER,
  "status" "AutomationJobStatus" NOT NULL DEFAULT 'RUNNING',
  "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "finishedAt" TIMESTAMP(3),
  "result" JSONB,
  "error" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AutomationJobRun_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "WebhookEvent" (
  "id" SERIAL NOT NULL,
  "type" "WebhookEventType" NOT NULL,
  "source" VARCHAR(80) NOT NULL,
  "status" "WebhookEventStatus" NOT NULL DEFAULT 'PENDING',
  "dedupeKey" VARCHAR(190) NOT NULL,
  "payload" JSONB NOT NULL,
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "processedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "WebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "SystemAuditLog" (
  "id" SERIAL NOT NULL,
  "actorId" INTEGER,
  "action" VARCHAR(80) NOT NULL,
  "entityType" VARCHAR(80) NOT NULL,
  "entityId" INTEGER,
  "metadata" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "SystemAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DiscordGuildSettings_guildId_key" ON "DiscordGuildSettings"("guildId");
CREATE INDEX "DiscordGuildSettings_enabled_idx" ON "DiscordGuildSettings"("enabled");
CREATE INDEX "DiscordGuildSettings_lastHeartbeatAt_idx" ON "DiscordGuildSettings"("lastHeartbeatAt");

CREATE UNIQUE INDEX "DiscordChannelMapping_guildSettingsId_scopeKey_purpose_key"
  ON "DiscordChannelMapping"("guildSettingsId", "scopeKey", "purpose");
CREATE INDEX "DiscordChannelMapping_leagueId_purpose_enabled_idx"
  ON "DiscordChannelMapping"("leagueId", "purpose", "enabled");
CREATE INDEX "DiscordChannelMapping_channelId_idx" ON "DiscordChannelMapping"("channelId");

CREATE UNIQUE INDEX "DiscordRoleMapping_guildSettingsId_role_key"
  ON "DiscordRoleMapping"("guildSettingsId", "role");
CREATE INDEX "DiscordRoleMapping_discordRoleId_idx" ON "DiscordRoleMapping"("discordRoleId");

CREATE UNIQUE INDEX "DiscordDelivery_dedupeKey_key" ON "DiscordDelivery"("dedupeKey");
CREATE INDEX "DiscordDelivery_status_scheduledFor_idx" ON "DiscordDelivery"("status", "scheduledFor");
CREATE INDEX "DiscordDelivery_guildSettingsId_purpose_createdAt_idx"
  ON "DiscordDelivery"("guildSettingsId", "purpose", "createdAt");
CREATE INDEX "DiscordDelivery_leagueId_createdAt_idx" ON "DiscordDelivery"("leagueId", "createdAt");
CREATE INDEX "DiscordDelivery_announcementId_idx" ON "DiscordDelivery"("announcementId");

CREATE INDEX "Announcement_status_scheduledFor_idx" ON "Announcement"("status", "scheduledFor");
CREATE INDEX "Announcement_pinned_publishedAt_idx" ON "Announcement"("pinned", "publishedAt");
CREATE INDEX "Announcement_createdByUserId_createdAt_idx" ON "Announcement"("createdByUserId", "createdAt");

CREATE UNIQUE INDEX "AutomationJob_type_key" ON "AutomationJob"("type");
CREATE INDEX "AutomationJob_enabled_status_nextRunAt_idx" ON "AutomationJob"("enabled", "status", "nextRunAt");
CREATE INDEX "AutomationJob_lockedAt_idx" ON "AutomationJob"("lockedAt");
CREATE INDEX "AutomationJobRun_jobId_startedAt_idx" ON "AutomationJobRun"("jobId", "startedAt");
CREATE INDEX "AutomationJobRun_status_startedAt_idx" ON "AutomationJobRun"("status", "startedAt");
CREATE INDEX "AutomationJobRun_retryActorId_idx" ON "AutomationJobRun"("retryActorId");

CREATE UNIQUE INDEX "WebhookEvent_dedupeKey_key" ON "WebhookEvent"("dedupeKey");
CREATE INDEX "WebhookEvent_status_createdAt_idx" ON "WebhookEvent"("status", "createdAt");
CREATE INDEX "WebhookEvent_type_createdAt_idx" ON "WebhookEvent"("type", "createdAt");
CREATE INDEX "SystemAuditLog_actorId_createdAt_idx" ON "SystemAuditLog"("actorId", "createdAt");
CREATE INDEX "SystemAuditLog_action_createdAt_idx" ON "SystemAuditLog"("action", "createdAt");
CREATE INDEX "SystemAuditLog_entityType_entityId_idx" ON "SystemAuditLog"("entityType", "entityId");

ALTER TABLE "DiscordChannelMapping"
  ADD CONSTRAINT "DiscordChannelMapping_guildSettingsId_fkey"
  FOREIGN KEY ("guildSettingsId") REFERENCES "DiscordGuildSettings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordChannelMapping"
  ADD CONSTRAINT "DiscordChannelMapping_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordRoleMapping"
  ADD CONSTRAINT "DiscordRoleMapping_guildSettingsId_fkey"
  FOREIGN KEY ("guildSettingsId") REFERENCES "DiscordGuildSettings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Announcement"
  ADD CONSTRAINT "Announcement_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DiscordDelivery"
  ADD CONSTRAINT "DiscordDelivery_guildSettingsId_fkey"
  FOREIGN KEY ("guildSettingsId") REFERENCES "DiscordGuildSettings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DiscordDelivery"
  ADD CONSTRAINT "DiscordDelivery_leagueId_fkey"
  FOREIGN KEY ("leagueId") REFERENCES "League"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "DiscordDelivery"
  ADD CONSTRAINT "DiscordDelivery_announcementId_fkey"
  FOREIGN KEY ("announcementId") REFERENCES "Announcement"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AutomationJobRun"
  ADD CONSTRAINT "AutomationJobRun_jobId_fkey"
  FOREIGN KEY ("jobId") REFERENCES "AutomationJob"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "AutomationJobRun"
  ADD CONSTRAINT "AutomationJobRun_retryActorId_fkey"
  FOREIGN KEY ("retryActorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "SystemAuditLog"
  ADD CONSTRAINT "SystemAuditLog_actorId_fkey"
  FOREIGN KEY ("actorId") REFERENCES "User"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AutomationJob"
  ("type", "name", "intervalMinutes", "nextRunAt", "updatedAt")
VALUES
  ('ATTENDANCE_REMINDERS', 'Rennanmeldungs-Erinnerungen', 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('UPCOMING_RACE_REMINDERS', 'Rennwochenend-Erinnerungen', 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('CHAMPIONSHIP_VERIFICATION', 'Meisterschaftsprüfung', 360, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('NOTIFICATION_CLEANUP', 'Benachrichtigungs-Bereinigung', 1440, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('EMAIL_QUEUE', 'E-Mail-Outbox', 5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('DISCORD_QUEUE', 'Discord-Outbox', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('MYSTERY_RACE_PUBLICATION', 'Mystery-Race-Veröffentlichung', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('STATISTICS_REFRESH', 'Statistik-Aktualisierung', 60, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('ANNOUNCEMENT_PUBLICATION', 'Geplante Mitteilungen', 2, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('DISCORD_ROLE_SYNC', 'Discord-Rollensynchronisierung', 30, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP);
