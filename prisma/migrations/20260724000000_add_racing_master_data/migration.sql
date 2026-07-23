CREATE TYPE "RaceStatus" AS ENUM (
    'SCHEDULED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
);

ALTER TABLE "Season"
ADD COLUMN "archivedAt" TIMESTAMP(3);

UPDATE "Season"
SET "archivedAt" = "updatedAt"
WHERE "active" = false;

CREATE INDEX "Season_leagueId_archivedAt_idx"
ON "Season"("leagueId", "archivedAt");

ALTER TABLE "Race"
ADD COLUMN "timezone" VARCHAR(64) NOT NULL DEFAULT 'Europe/Berlin',
ADD COLUMN "status" "RaceStatus" NOT NULL DEFAULT 'SCHEDULED',
ADD COLUMN "sprint" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "doublePoints" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "mystery" BOOLEAN NOT NULL DEFAULT false;

UPDATE "Race"
SET "status" = CASE
    WHEN "completed" THEN 'COMPLETED'::"RaceStatus"
    ELSE 'SCHEDULED'::"RaceStatus"
END;

DROP INDEX "Race_completed_scheduledAt_idx";
ALTER TABLE "Race" DROP COLUMN "completed";
CREATE INDEX "Race_status_scheduledAt_idx"
ON "Race"("status", "scheduledAt");

ALTER TABLE "Team"
ADD COLUMN "seasonId" INTEGER,
ADD COLUMN "principalUserId" INTEGER;

UPDATE "Team"
SET "seasonId" = "League"."currentSeasonId"
FROM "League"
WHERE "Team"."leagueId" = "League"."id";

ALTER TABLE "Team"
ALTER COLUMN "seasonId" SET NOT NULL;

DROP INDEX "Team_leagueId_name_key";
DROP INDEX "Team_leagueId_shortName_key";
DROP INDEX "Team_leagueId_active_idx";

CREATE UNIQUE INDEX "Team_seasonId_name_key"
ON "Team"("seasonId", "name");

CREATE UNIQUE INDEX "Team_seasonId_shortName_key"
ON "Team"("seasonId", "shortName");

CREATE INDEX "Team_leagueId_seasonId_active_idx"
ON "Team"("leagueId", "seasonId", "active");

CREATE INDEX "Team_principalUserId_idx"
ON "Team"("principalUserId");

ALTER TABLE "Team"
ADD CONSTRAINT "Team_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Team"
ADD CONSTRAINT "Team_principalUserId_fkey"
FOREIGN KEY ("principalUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
