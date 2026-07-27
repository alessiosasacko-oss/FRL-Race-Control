CREATE TYPE "AttendanceChangeSource" AS ENUM (
    'DRIVER',
    'TEAM_PRINCIPAL',
    'ADMIN',
    'AUTOMATION'
);

ALTER TABLE "League"
ADD COLUMN "raceWeekday" INTEGER NOT NULL DEFAULT 7,
ADD COLUMN "raceStartMinute" INTEGER NOT NULL DEFAULT 1140,
ADD COLUMN "raceTimezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
ADD COLUMN "defaultAttendanceDeadlineMinutes" INTEGER,
ADD COLUMN "displayOrder" INTEGER NOT NULL DEFAULT 0;

UPDATE "League"
SET
    "raceWeekday" = CASE
        WHEN "code" IN ('F6', 'F5') THEN 5
        WHEN "code" IN ('F4', 'F3') THEN 6
        ELSE 7
    END,
    "raceStartMinute" = CASE
        WHEN "code" IN ('F6', 'F4', 'F2') THEN 960
        ELSE 1140
    END,
    "displayOrder" = CASE "code"
        WHEN 'F1' THEN 1
        WHEN 'F2' THEN 2
        WHEN 'F3' THEN 3
        WHEN 'F4' THEN 4
        WHEN 'F5' THEN 5
        WHEN 'F6' THEN 6
        ELSE 99
    END
WHERE "code" IN ('F1', 'F2', 'F3', 'F4', 'F5', 'F6');

ALTER TABLE "League"
ADD CONSTRAINT "League_raceWeekday_check"
CHECK ("raceWeekday" BETWEEN 1 AND 7),
ADD CONSTRAINT "League_raceStartMinute_check"
CHECK ("raceStartMinute" BETWEEN 0 AND 1439),
ADD CONSTRAINT "League_defaultAttendanceDeadlineMinutes_check"
CHECK (
    "defaultAttendanceDeadlineMinutes" IS NULL
    OR "defaultAttendanceDeadlineMinutes" >= 0
);

CREATE INDEX "League_displayOrder_code_idx"
ON "League"("displayOrder", "code");

ALTER TABLE "Race" ADD COLUMN "weekendDate" DATE;
UPDATE "Race" SET "weekendDate" = "scheduledAt"::date;
ALTER TABLE "Race" ALTER COLUMN "weekendDate" SET NOT NULL;

CREATE TABLE "RaceLeagueSchedule" (
    "id" SERIAL NOT NULL,
    "raceId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "timezone" VARCHAR(64) NOT NULL,
    "attendanceDeadline" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceLeagueSchedule_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaceLeagueSchedule_raceId_leagueId_key"
ON "RaceLeagueSchedule"("raceId", "leagueId");
CREATE INDEX "RaceLeagueSchedule_leagueId_scheduledAt_idx"
ON "RaceLeagueSchedule"("leagueId", "scheduledAt");
CREATE INDEX "RaceLeagueSchedule_raceId_scheduledAt_idx"
ON "RaceLeagueSchedule"("raceId", "scheduledAt");
CREATE INDEX "RaceLeagueSchedule_attendanceDeadline_idx"
ON "RaceLeagueSchedule"("attendanceDeadline");

ALTER TABLE "RaceLeagueSchedule"
ADD CONSTRAINT "RaceLeagueSchedule_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "RaceLeagueSchedule"
ADD CONSTRAINT "RaceLeagueSchedule_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "RaceLeagueSchedule" (
    "raceId",
    "leagueId",
    "scheduledAt",
    "timezone",
    "attendanceDeadline",
    "updatedAt"
)
SELECT
    race."id",
    participation."A",
    race."scheduledAt",
    race."timezone",
    race."attendanceDeadline",
    CURRENT_TIMESTAMP
FROM "Race" AS race
JOIN "_SeasonParticipation" AS participation
    ON participation."B" = race."seasonId";

ALTER TABLE "RaceAttendance"
ADD COLUMN "leagueScheduleId" INTEGER,
ADD COLUMN "changeSource" "AttendanceChangeSource" NOT NULL DEFAULT 'DRIVER',
ADD COLUMN "changeReason" VARCHAR(1000);

UPDATE "RaceAttendance" AS attendance
SET "leagueScheduleId" = schedule."id"
FROM "Driver" AS driver
JOIN "RaceLeagueSchedule" AS schedule
    ON schedule."leagueId" = driver."leagueId"
WHERE driver."id" = attendance."driverId"
  AND schedule."raceId" = attendance."raceId";

ALTER TABLE "RaceAttendance"
ALTER COLUMN "leagueScheduleId" SET NOT NULL;

ALTER TABLE "RaceAttendance"
ADD CONSTRAINT "RaceAttendance_leagueScheduleId_fkey"
FOREIGN KEY ("leagueScheduleId") REFERENCES "RaceLeagueSchedule"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE INDEX "RaceAttendance_leagueScheduleId_status_idx"
ON "RaceAttendance"("leagueScheduleId", "status");

CREATE TABLE "AttendanceAudit" (
    "id" SERIAL NOT NULL,
    "attendanceId" INTEGER,
    "leagueScheduleId" INTEGER NOT NULL,
    "raceId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "changedByUserId" INTEGER,
    "actorRole" "Role" NOT NULL,
    "source" "AttendanceChangeSource" NOT NULL,
    "previousStatus" "AttendanceStatus" NOT NULL,
    "newStatus" "AttendanceStatus" NOT NULL,
    "reason" VARCHAR(1000),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceAudit_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "AttendanceAudit_raceId_leagueId_createdAt_idx"
ON "AttendanceAudit"("raceId", "leagueId", "createdAt");
CREATE INDEX "AttendanceAudit_driverId_createdAt_idx"
ON "AttendanceAudit"("driverId", "createdAt");
CREATE INDEX "AttendanceAudit_attendanceId_createdAt_idx"
ON "AttendanceAudit"("attendanceId", "createdAt");
CREATE INDEX "AttendanceAudit_changedByUserId_createdAt_idx"
ON "AttendanceAudit"("changedByUserId", "createdAt");
CREATE INDEX "AttendanceAudit_source_createdAt_idx"
ON "AttendanceAudit"("source", "createdAt");

ALTER TABLE "AttendanceAudit"
ADD CONSTRAINT "AttendanceAudit_attendanceId_fkey"
FOREIGN KEY ("attendanceId") REFERENCES "RaceAttendance"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AttendanceAudit"
ADD CONSTRAINT "AttendanceAudit_leagueScheduleId_fkey"
FOREIGN KEY ("leagueScheduleId") REFERENCES "RaceLeagueSchedule"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceAudit"
ADD CONSTRAINT "AttendanceAudit_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceAudit"
ADD CONSTRAINT "AttendanceAudit_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceAudit"
ADD CONSTRAINT "AttendanceAudit_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "AttendanceAudit"
ADD CONSTRAINT "AttendanceAudit_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "AttendanceAudit" (
    "attendanceId",
    "leagueScheduleId",
    "raceId",
    "leagueId",
    "driverId",
    "changedByUserId",
    "actorRole",
    "source",
    "previousStatus",
    "newStatus",
    "reason",
    "createdAt"
)
SELECT
    attendance."id",
    attendance."leagueScheduleId",
    attendance."raceId",
    driver."leagueId",
    attendance."driverId",
    attendance."submittedByUserId",
    CASE
        WHEN 'SUPER_ADMIN'::"Role" = ANY(actor."roles")
            THEN 'SUPER_ADMIN'::"Role"
        WHEN 'ADMIN'::"Role" = ANY(actor."roles")
            THEN 'ADMIN'::"Role"
        WHEN 'TEAM_PRINCIPAL'::"Role" = ANY(actor."roles")
            THEN 'TEAM_PRINCIPAL'::"Role"
        ELSE 'DRIVER'::"Role"
    END,
    CASE
        WHEN 'SUPER_ADMIN'::"Role" = ANY(actor."roles")
          OR 'ADMIN'::"Role" = ANY(actor."roles")
            THEN 'ADMIN'::"AttendanceChangeSource"
        WHEN 'TEAM_PRINCIPAL'::"Role" = ANY(actor."roles")
            THEN 'TEAM_PRINCIPAL'::"AttendanceChangeSource"
        ELSE 'DRIVER'::"AttendanceChangeSource"
    END,
    'NO_RESPONSE'::"AttendanceStatus",
    attendance."status",
    'Bestehender Anmeldestatus bei Einführung des Audit-Logs',
    attendance."changedAt"
FROM "RaceAttendance" AS attendance
JOIN "Driver" AS driver ON driver."id" = attendance."driverId"
JOIN "User" AS actor ON actor."id" = attendance."submittedByUserId";
