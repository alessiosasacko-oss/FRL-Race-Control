CREATE TYPE "AttendanceStatus" AS ENUM (
    'REGISTERED',
    'DECLINED',
    'NO_RESPONSE'
);

CREATE TYPE "ResultSession" AS ENUM (
    'RACE',
    'SPRINT'
);

CREATE TYPE "ResultStatus" AS ENUM (
    'FINISHED',
    'DNF',
    'DNS',
    'DSQ',
    'RETIRED'
);

CREATE TYPE "ChampionshipAdjustmentTarget" AS ENUM (
    'DRIVER',
    'TEAM'
);

CREATE TYPE "ChampionshipAuditAction" AS ENUM (
    'ATTENDANCE_CHANGED',
    'RESULT_CREATED',
    'RESULT_UPDATED',
    'RESULT_DELETED',
    'SCORING_CHANGED',
    'ADJUSTMENT_CREATED',
    'CHAMPIONSHIP_RECALCULATED'
);

ALTER TABLE "Race"
ADD COLUMN "attendanceDeadline" TIMESTAMP(3);

ALTER TABLE "DriverStanding"
ADD COLUMN "racePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "sprintPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "bonusPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "polePositions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fastestLaps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "starts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dnfs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "dsqs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "bestResult" INTEGER,
ADD COLUMN "substituteStarts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tieBreak" JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE "TeamStanding"
ADD COLUMN "racePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "sprintPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "bonusPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "adjustments" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN "podiums" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "polePositions" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fastestLaps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "tieBreak" JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE TABLE "RaceAttendance" (
    "id" SERIAL NOT NULL,
    "raceId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "substituteDriverId" INTEGER,
    "representedTeamId" INTEGER,
    "submittedByUserId" INTEGER NOT NULL,
    "status" "AttendanceStatus" NOT NULL,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceAttendance_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RaceAttendance_driver_substitute_check"
        CHECK (
            "substituteDriverId" IS NULL
            OR "substituteDriverId" <> "driverId"
        )
);

CREATE TABLE "RaceResultSession" (
    "id" SERIAL NOT NULL,
    "raceId" INTEGER NOT NULL,
    "session" "ResultSession" NOT NULL,
    "lockedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceResultSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RaceResult" (
    "id" SERIAL NOT NULL,
    "resultSessionId" INTEGER NOT NULL,
    "driverId" INTEGER NOT NULL,
    "representedTeamId" INTEGER NOT NULL,
    "expectedDriverId" INTEGER,
    "position" INTEGER,
    "startingPosition" INTEGER,
    "status" "ResultStatus" NOT NULL,
    "gapToWinnerMs" INTEGER,
    "gapToPreviousMs" INTEGER,
    "totalTimeMs" INTEGER,
    "fastestLap" BOOLEAN NOT NULL DEFAULT false,
    "polePosition" BOOLEAN NOT NULL DEFAULT false,
    "lapsCompleted" INTEGER NOT NULL DEFAULT 0,
    "classifiedPercentage" DOUBLE PRECISION,
    "penaltySeconds" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT,
    "substitute" BOOLEAN NOT NULL DEFAULT false,
    "racePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "teamPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceResult_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "RaceResult_position_check"
        CHECK ("position" IS NULL OR "position" > 0),
    CONSTRAINT "RaceResult_starting_position_check"
        CHECK ("startingPosition" IS NULL OR "startingPosition" > 0),
    CONSTRAINT "RaceResult_classification_check"
        CHECK (
            "classifiedPercentage" IS NULL
            OR (
                "classifiedPercentage" >= 0
                AND "classifiedPercentage" <= 100
            )
        ),
    CONSTRAINT "RaceResult_nonnegative_values_check"
        CHECK (
            "lapsCompleted" >= 0
            AND "penaltySeconds" >= 0
            AND ("gapToWinnerMs" IS NULL OR "gapToWinnerMs" >= 0)
            AND ("gapToPreviousMs" IS NULL OR "gapToPreviousMs" >= 0)
            AND ("totalTimeMs" IS NULL OR "totalTimeMs" >= 0)
        ),
    CONSTRAINT "RaceResult_substitute_check"
        CHECK (
            (
                "substitute" = false
                AND "expectedDriverId" IS NULL
            )
            OR (
                "substitute" = true
                AND "expectedDriverId" IS NOT NULL
                AND "expectedDriverId" <> "driverId"
            )
        )
);

CREATE TABLE "ScoringConfiguration" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "fastestLapPoint" DOUBLE PRECISION NOT NULL DEFAULT 1,
    "fastestLapRequiresTopPosition" INTEGER,
    "polePositionPoint" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dnfScoresPoints" BOOLEAN NOT NULL DEFAULT false,
    "retiredScoresPoints" BOOLEAN NOT NULL DEFAULT false,
    "minimumClassifiedPercentage" DOUBLE PRECISION,
    "teamPointsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "substituteDriverPointsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "deductPenaltyPoints" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringConfiguration_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScoringConfiguration_values_check"
        CHECK (
            "fastestLapPoint" >= 0
            AND "polePositionPoint" >= 0
            AND (
                "fastestLapRequiresTopPosition" IS NULL
                OR "fastestLapRequiresTopPosition" > 0
            )
            AND (
                "minimumClassifiedPercentage" IS NULL
                OR (
                    "minimumClassifiedPercentage" >= 0
                    AND "minimumClassifiedPercentage" <= 100
                )
            )
        )
);

CREATE TABLE "ScoringPosition" (
    "id" SERIAL NOT NULL,
    "scoringConfigurationId" INTEGER NOT NULL,
    "session" "ResultSession" NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ScoringPosition_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ScoringPosition_values_check"
        CHECK ("position" > 0 AND "points" >= 0)
);

CREATE TABLE "ChampionshipAdjustment" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "target" "ChampionshipAdjustmentTarget" NOT NULL,
    "driverId" INTEGER,
    "teamId" INTEGER,
    "points" DOUBLE PRECISION NOT NULL,
    "reason" VARCHAR(1000) NOT NULL,
    "actorId" INTEGER NOT NULL,
    "raceId" INTEGER,
    "fiaTicketId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChampionshipAdjustment_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ChampionshipAdjustment_target_check"
        CHECK (
            (
                "target" = 'DRIVER'
                AND "driverId" IS NOT NULL
                AND "teamId" IS NULL
            )
            OR (
                "target" = 'TEAM'
                AND "teamId" IS NOT NULL
                AND "driverId" IS NULL
            )
        )
);

CREATE TABLE "ChampionshipAudit" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER,
    "raceId" INTEGER,
    "actorId" INTEGER,
    "action" "ChampionshipAuditAction" NOT NULL,
    "entityType" VARCHAR(80) NOT NULL,
    "entityId" INTEGER NOT NULL,
    "previousState" JSONB,
    "newState" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ChampionshipAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaceAttendance_raceId_driverId_key"
ON "RaceAttendance"("raceId", "driverId");

CREATE UNIQUE INDEX "RaceAttendance_raceId_substituteDriverId_key"
ON "RaceAttendance"("raceId", "substituteDriverId");

CREATE INDEX "RaceAttendance_raceId_status_idx"
ON "RaceAttendance"("raceId", "status");

CREATE INDEX "RaceAttendance_representedTeamId_raceId_idx"
ON "RaceAttendance"("representedTeamId", "raceId");

CREATE INDEX "RaceAttendance_submittedByUserId_idx"
ON "RaceAttendance"("submittedByUserId");

CREATE UNIQUE INDEX "RaceResultSession_raceId_session_key"
ON "RaceResultSession"("raceId", "session");

CREATE INDEX "RaceResultSession_raceId_lockedAt_idx"
ON "RaceResultSession"("raceId", "lockedAt");

CREATE UNIQUE INDEX "RaceResult_resultSessionId_driverId_key"
ON "RaceResult"("resultSessionId", "driverId");

CREATE UNIQUE INDEX "RaceResult_resultSessionId_position_key"
ON "RaceResult"("resultSessionId", "position");

CREATE UNIQUE INDEX "RaceResult_one_fastest_lap_per_session"
ON "RaceResult"("resultSessionId")
WHERE "fastestLap" = true;

CREATE UNIQUE INDEX "RaceResult_one_pole_per_session"
ON "RaceResult"("resultSessionId")
WHERE "polePosition" = true;

CREATE INDEX "RaceResult_driverId_resultSessionId_idx"
ON "RaceResult"("driverId", "resultSessionId");

CREATE INDEX "RaceResult_representedTeamId_resultSessionId_idx"
ON "RaceResult"("representedTeamId", "resultSessionId");

CREATE INDEX "RaceResult_status_position_idx"
ON "RaceResult"("status", "position");

CREATE UNIQUE INDEX "ScoringConfiguration_seasonId_key"
ON "ScoringConfiguration"("seasonId");

CREATE INDEX "ScoringConfiguration_seasonId_updatedAt_idx"
ON "ScoringConfiguration"("seasonId", "updatedAt");

CREATE UNIQUE INDEX "ScoringPosition_scoringConfigurationId_session_position_key"
ON "ScoringPosition"(
    "scoringConfigurationId",
    "session",
    "position"
);

CREATE INDEX "ScoringPosition_session_position_idx"
ON "ScoringPosition"("session", "position");

CREATE INDEX "ChampionshipAdjustment_seasonId_createdAt_idx"
ON "ChampionshipAdjustment"("seasonId", "createdAt");

CREATE INDEX "ChampionshipAdjustment_driverId_createdAt_idx"
ON "ChampionshipAdjustment"("driverId", "createdAt");

CREATE INDEX "ChampionshipAdjustment_teamId_createdAt_idx"
ON "ChampionshipAdjustment"("teamId", "createdAt");

CREATE INDEX "ChampionshipAdjustment_raceId_idx"
ON "ChampionshipAdjustment"("raceId");

CREATE INDEX "ChampionshipAdjustment_fiaTicketId_idx"
ON "ChampionshipAdjustment"("fiaTicketId");

CREATE INDEX "ChampionshipAdjustment_actorId_idx"
ON "ChampionshipAdjustment"("actorId");

CREATE INDEX "ChampionshipAudit_seasonId_createdAt_idx"
ON "ChampionshipAudit"("seasonId", "createdAt");

CREATE INDEX "ChampionshipAudit_raceId_createdAt_idx"
ON "ChampionshipAudit"("raceId", "createdAt");

CREATE INDEX "ChampionshipAudit_actorId_createdAt_idx"
ON "ChampionshipAudit"("actorId", "createdAt");

CREATE INDEX "ChampionshipAudit_action_createdAt_idx"
ON "ChampionshipAudit"("action", "createdAt");

CREATE INDEX "ChampionshipAudit_entityType_entityId_idx"
ON "ChampionshipAudit"("entityType", "entityId");

ALTER TABLE "RaceAttendance"
ADD CONSTRAINT "RaceAttendance_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceAttendance"
ADD CONSTRAINT "RaceAttendance_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceAttendance"
ADD CONSTRAINT "RaceAttendance_substituteDriverId_fkey"
FOREIGN KEY ("substituteDriverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceAttendance"
ADD CONSTRAINT "RaceAttendance_representedTeamId_fkey"
FOREIGN KEY ("representedTeamId") REFERENCES "Team"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceAttendance"
ADD CONSTRAINT "RaceAttendance_submittedByUserId_fkey"
FOREIGN KEY ("submittedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceResultSession"
ADD CONSTRAINT "RaceResultSession_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceResult"
ADD CONSTRAINT "RaceResult_resultSessionId_fkey"
FOREIGN KEY ("resultSessionId") REFERENCES "RaceResultSession"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceResult"
ADD CONSTRAINT "RaceResult_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceResult"
ADD CONSTRAINT "RaceResult_representedTeamId_fkey"
FOREIGN KEY ("representedTeamId") REFERENCES "Team"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "RaceResult"
ADD CONSTRAINT "RaceResult_expectedDriverId_fkey"
FOREIGN KEY ("expectedDriverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScoringConfiguration"
ADD CONSTRAINT "ScoringConfiguration_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScoringPosition"
ADD CONSTRAINT "ScoringPosition_scoringConfigurationId_fkey"
FOREIGN KEY ("scoringConfigurationId")
REFERENCES "ScoringConfiguration"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAdjustment"
ADD CONSTRAINT "ChampionshipAdjustment_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAdjustment"
ADD CONSTRAINT "ChampionshipAdjustment_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAdjustment"
ADD CONSTRAINT "ChampionshipAdjustment_teamId_fkey"
FOREIGN KEY ("teamId") REFERENCES "Team"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAdjustment"
ADD CONSTRAINT "ChampionshipAdjustment_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAdjustment"
ADD CONSTRAINT "ChampionshipAdjustment_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAdjustment"
ADD CONSTRAINT "ChampionshipAdjustment_fiaTicketId_fkey"
FOREIGN KEY ("fiaTicketId") REFERENCES "FiaTicket"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAudit"
ADD CONSTRAINT "ChampionshipAudit_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAudit"
ADD CONSTRAINT "ChampionshipAudit_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAudit"
ADD CONSTRAINT "ChampionshipAudit_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
