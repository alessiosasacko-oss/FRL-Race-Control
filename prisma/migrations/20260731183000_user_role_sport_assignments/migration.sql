CREATE TYPE "DriverLineupStatus" AS ENUM ('PRIMARY', 'SUBSTITUTE');

CREATE TABLE "DriverSeasonAssignment" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "organizationId" INTEGER,
    "lineupStatus" "DriverLineupStatus" NOT NULL DEFAULT 'PRIMARY',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DriverSeasonAssignment_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverSeasonAssignment_driverId_seasonId_key"
ON "DriverSeasonAssignment"("driverId", "seasonId");

CREATE INDEX "DriverSeasonAssignment_seasonId_leagueId_organizationId_lineupStatus_active_idx"
ON "DriverSeasonAssignment"("seasonId", "leagueId", "organizationId", "lineupStatus", "active");

CREATE INDEX "DriverSeasonAssignment_organizationId_seasonId_leagueId_idx"
ON "DriverSeasonAssignment"("organizationId", "seasonId", "leagueId");

ALTER TABLE "DriverSeasonAssignment"
ADD CONSTRAINT "DriverSeasonAssignment_driverId_fkey"
FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "DriverSeasonAssignment"
ADD CONSTRAINT "DriverSeasonAssignment_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DriverSeasonAssignment"
ADD CONSTRAINT "DriverSeasonAssignment_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "DriverSeasonAssignment"
ADD CONSTRAINT "DriverSeasonAssignment_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "TeamOrganization"("id") ON DELETE SET NULL ON UPDATE CASCADE;

UPDATE "Driver"
SET "countryCode" = UPPER(BTRIM("countryCode"))
WHERE BTRIM("countryCode") ~* '^[a-z]{2}$';

INSERT INTO "DriverSeasonAssignment" (
    "driverId",
    "seasonId",
    "leagueId",
    "organizationId",
    "lineupStatus",
    "active",
    "createdAt",
    "updatedAt"
)
SELECT
    driver."id",
    COALESCE(team."seasonId", league."currentSeasonId"),
    driver."leagueId",
    team."organizationId",
    'PRIMARY'::"DriverLineupStatus",
    driver."active",
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Driver" driver
LEFT JOIN "Team" team ON team."id" = driver."teamId"
JOIN "League" league ON league."id" = driver."leagueId"
WHERE COALESCE(team."seasonId", league."currentSeasonId") IS NOT NULL
ON CONFLICT ("driverId", "seasonId") DO NOTHING;
