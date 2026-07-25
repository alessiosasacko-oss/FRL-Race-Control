ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'PENALTY';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'QUALIFYING_BAN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RACE_BAN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_OPEN';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_CLOSING_SOON';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ATTENDANCE_CLOSED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'RACE_RESULT';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'CHAMPIONSHIP_UPDATED';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_SEASON';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'NEW_RACE';
ALTER TYPE "NotificationType" ADD VALUE IF NOT EXISTS 'ADMIN_ANNOUNCEMENT';

CREATE TYPE "NotificationPriority" AS ENUM (
    'LOW',
    'NORMAL',
    'HIGH',
    'URGENT'
);

CREATE TYPE "EmailDeliveryStatus" AS ENUM (
    'PENDING',
    'SENDING',
    'SENT',
    'SKIPPED',
    'FAILED'
);

ALTER TABLE "Notification"
ADD COLUMN "priority" "NotificationPriority" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "relatedEntityType" VARCHAR(80),
ADD COLUMN "relatedEntityId" INTEGER,
ADD COLUMN "dedupeKey" VARCHAR(190),
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD CONSTRAINT "Notification_related_entity_check"
    CHECK (
        ("relatedEntityType" IS NULL AND "relatedEntityId" IS NULL)
        OR
        ("relatedEntityType" IS NOT NULL AND "relatedEntityId" IS NOT NULL)
    );

DROP INDEX "Notification_userId_readAt_createdAt_idx";

CREATE INDEX "Notification_userId_archivedAt_readAt_createdAt_idx"
ON "Notification"("userId", "archivedAt", "readAt", "createdAt");

CREATE INDEX "Notification_priority_createdAt_idx"
ON "Notification"("priority", "createdAt");

CREATE INDEX "Notification_relatedEntityType_relatedEntityId_idx"
ON "Notification"("relatedEntityType", "relatedEntityId");

CREATE UNIQUE INDEX "Notification_dedupeKey_key"
ON "Notification"("dedupeKey");

CREATE TABLE "UserSettings" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "inAppEnabled" BOOLEAN NOT NULL DEFAULT true,
    "inAppCategories" "NotificationType"[] NOT NULL DEFAULT ARRAY[]::"NotificationType"[],
    "emailEnabled" BOOLEAN NOT NULL DEFAULT false,
    "emailCategories" "NotificationType"[] NOT NULL DEFAULT ARRAY[]::"NotificationType"[],
    "quietHoursEnabled" BOOLEAN NOT NULL DEFAULT false,
    "quietHoursStartMinute" INTEGER,
    "quietHoursEndMinute" INTEGER,
    "timezone" VARCHAR(80) NOT NULL DEFAULT 'Europe/Berlin',
    "theme" VARCHAR(32) NOT NULL DEFAULT 'dark',
    "language" VARCHAR(16) NOT NULL DEFAULT 'de',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserSettings_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "UserSettings_quiet_hours_check"
        CHECK (
            (
                "quietHoursStartMinute" IS NULL
                AND "quietHoursEndMinute" IS NULL
            )
            OR
            (
                "quietHoursStartMinute" BETWEEN 0 AND 1439
                AND "quietHoursEndMinute" BETWEEN 0 AND 1439
            )
        )
);

CREATE UNIQUE INDEX "UserSettings_userId_key"
ON "UserSettings"("userId");

CREATE INDEX "UserSettings_emailEnabled_idx"
ON "UserSettings"("emailEnabled");

CREATE TABLE "EmailDelivery" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "notificationId" INTEGER,
    "recipient" VARCHAR(320) NOT NULL,
    "subject" VARCHAR(200) NOT NULL,
    "html" TEXT NOT NULL,
    "status" "EmailDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "scheduledFor" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailDelivery_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "EmailDelivery_attempts_check"
        CHECK ("attempts" >= 0)
);

CREATE UNIQUE INDEX "EmailDelivery_notificationId_key"
ON "EmailDelivery"("notificationId");

CREATE INDEX "EmailDelivery_status_scheduledFor_idx"
ON "EmailDelivery"("status", "scheduledFor");

CREATE INDEX "EmailDelivery_userId_createdAt_idx"
ON "EmailDelivery"("userId", "createdAt");

ALTER TABLE "UserSettings"
ADD CONSTRAINT "UserSettings_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDelivery"
ADD CONSTRAINT "EmailDelivery_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EmailDelivery"
ADD CONSTRAINT "EmailDelivery_notificationId_fkey"
FOREIGN KEY ("notificationId") REFERENCES "Notification"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
