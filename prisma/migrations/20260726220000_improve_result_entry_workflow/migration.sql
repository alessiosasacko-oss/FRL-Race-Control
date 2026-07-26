ALTER TYPE "ResultSession" ADD VALUE 'QUALIFYING' BEFORE 'RACE';

CREATE TYPE "ResultGapMode" AS ENUM (
    'TO_LEADER',
    'TO_PREVIOUS'
);

CREATE TYPE "ResultPublicationStatus" AS ENUM (
    'DRAFT',
    'PUBLISHED'
);

CREATE TYPE "ResultPenaltySource" AS ENUM (
    'FIA',
    'MANUAL'
);

ALTER TABLE "RaceResultSession"
ADD COLUMN "gapMode" "ResultGapMode" NOT NULL DEFAULT 'TO_LEADER',
ADD COLUMN "publicationStatus" "ResultPublicationStatus" NOT NULL DEFAULT 'DRAFT',
ADD COLUMN "fiaPenaltyVersion" VARCHAR(64),
ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN "publishedAt" TIMESTAMP(3),
ADD COLUMN "publishedByUserId" INTEGER;

-- Historical result sessions were public before drafts existed.
UPDATE "RaceResultSession"
SET
    "publicationStatus" = 'PUBLISHED',
    "publishedAt" = COALESCE("lockedAt", "updatedAt");

ALTER TABLE "RaceResult"
ADD COLUMN "lapsBehind" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "fastestLapMs" INTEGER,
ADD COLUMN "effectivePenaltyMs" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN "adjustedTimeMs" INTEGER,
ADD COLUMN "finalPosition" INTEGER;

UPDATE "RaceResult"
SET
    "effectivePenaltyMs" = ROUND("penaltySeconds" * 1000)::INTEGER,
    "adjustedTimeMs" = CASE
        WHEN "gapToWinnerMs" IS NULL THEN NULL
        ELSE "gapToWinnerMs" + ROUND("penaltySeconds" * 1000)::INTEGER
    END,
    "finalPosition" = CASE
        WHEN "status" IN ('DNS', 'DSQ') THEN NULL
        ELSE "position"
    END;

CREATE TABLE "ResultPenaltyApplication" (
    "id" SERIAL NOT NULL,
    "resultId" INTEGER NOT NULL,
    "decisionId" INTEGER,
    "source" "ResultPenaltySource" NOT NULL,
    "penaltyType" "PenaltyType" NOT NULL,
    "penaltyMilliseconds" INTEGER NOT NULL DEFAULT 0,
    "disqualified" BOOLEAN NOT NULL DEFAULT false,
    "reason" VARCHAR(1000),
    "createdByUserId" INTEGER,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ResultPenaltyApplication_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "ResultPenaltyApplication_nonnegative_check"
        CHECK ("penaltyMilliseconds" >= 0),
    CONSTRAINT "ResultPenaltyApplication_source_check"
        CHECK (
            (
                "source" = 'FIA'
                AND "decisionId" IS NOT NULL
            )
            OR (
                "source" = 'MANUAL'
                AND "decisionId" IS NULL
            )
        )
);

CREATE INDEX "RaceResultSession_publicationStatus_updatedAt_idx"
ON "RaceResultSession"("publicationStatus", "updatedAt");

CREATE INDEX "RaceResultSession_publishedByUserId_idx"
ON "RaceResultSession"("publishedByUserId");

CREATE INDEX "RaceResult_resultSessionId_finalPosition_idx"
ON "RaceResult"("resultSessionId", "finalPosition");

CREATE UNIQUE INDEX "ResultPenaltyApplication_resultId_decisionId_key"
ON "ResultPenaltyApplication"("resultId", "decisionId");

CREATE UNIQUE INDEX "ResultPenaltyApplication_one_active_manual_override"
ON "ResultPenaltyApplication"("resultId")
WHERE "source" = 'MANUAL' AND "active" = true;

CREATE INDEX "ResultPenaltyApplication_resultId_source_active_idx"
ON "ResultPenaltyApplication"("resultId", "source", "active");

CREATE INDEX "ResultPenaltyApplication_decisionId_idx"
ON "ResultPenaltyApplication"("decisionId");

CREATE INDEX "ResultPenaltyApplication_createdByUserId_idx"
ON "ResultPenaltyApplication"("createdByUserId");

ALTER TABLE "RaceResultSession"
ADD CONSTRAINT "RaceResultSession_revision_check"
CHECK ("revision" > 0);

ALTER TABLE "RaceResult"
ADD CONSTRAINT "RaceResult_normalized_timing_check"
CHECK (
    "lapsBehind" >= 0
    AND "effectivePenaltyMs" >= 0
    AND ("fastestLapMs" IS NULL OR "fastestLapMs" >= 0)
    AND ("adjustedTimeMs" IS NULL OR "adjustedTimeMs" >= 0)
    AND ("finalPosition" IS NULL OR "finalPosition" > 0)
);

ALTER TABLE "RaceResultSession"
ADD CONSTRAINT "RaceResultSession_publishedByUserId_fkey"
FOREIGN KEY ("publishedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "ResultPenaltyApplication"
ADD CONSTRAINT "ResultPenaltyApplication_resultId_fkey"
FOREIGN KEY ("resultId") REFERENCES "RaceResult"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ResultPenaltyApplication"
ADD CONSTRAINT "ResultPenaltyApplication_decisionId_fkey"
FOREIGN KEY ("decisionId") REFERENCES "Decision"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ResultPenaltyApplication"
ADD CONSTRAINT "ResultPenaltyApplication_createdByUserId_fkey"
FOREIGN KEY ("createdByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
