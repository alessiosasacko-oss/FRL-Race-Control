ALTER TYPE "ChampionshipAuditAction"
ADD VALUE 'GLOBAL_WEEKEND_FINALIZED';

ALTER TYPE "ChampionshipAuditAction"
ADD VALUE 'GLOBAL_WEEKEND_INVALIDATED';

ALTER TYPE "ChampionshipAuditAction"
ADD VALUE 'GLOBAL_STANDINGS_REBUILT';

CREATE TYPE "GlobalWeekendStatus" AS ENUM (
    'PENDING',
    'FINALIZED',
    'INVALIDATED'
);

CREATE TABLE "TeamOrganization" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "shortName" VARCHAR(12) NOT NULL,
    "color" CHAR(7) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamOrganization_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "TeamOrganization_name_key"
ON "TeamOrganization"("name");

CREATE INDEX "TeamOrganization_shortName_idx"
ON "TeamOrganization"("shortName");

CREATE INDEX "TeamOrganization_active_name_idx"
ON "TeamOrganization"("active", "name");

ALTER TABLE "Team"
ADD COLUMN "organizationId" INTEGER;

INSERT INTO "TeamOrganization" (
    "name",
    "shortName",
    "color",
    "active",
    "createdAt",
    "updatedAt"
)
SELECT
    MIN("name"),
    MIN("shortName"),
    MIN("color"),
    BOOL_OR("active"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Team"
GROUP BY LOWER(TRIM("name"));

UPDATE "Team" AS team
SET "organizationId" = organization."id"
FROM "TeamOrganization" AS organization
WHERE LOWER(TRIM(team."name")) = LOWER(TRIM(organization."name"));

CREATE INDEX "Team_organizationId_seasonId_idx"
ON "Team"("organizationId", "seasonId");

ALTER TABLE "Team"
ADD CONSTRAINT "Team_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "TeamOrganization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "TeamOrganizationSeason" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "principalUserId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamOrganizationSeason_pkey" PRIMARY KEY ("id")
);

INSERT INTO "TeamOrganizationSeason" (
    "organizationId",
    "seasonId",
    "principalUserId",
    "createdAt",
    "updatedAt"
)
SELECT
    "organizationId",
    "seasonId",
    MIN("principalUserId"),
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM "Team"
WHERE "organizationId" IS NOT NULL
GROUP BY "organizationId", "seasonId";

CREATE UNIQUE INDEX "TeamOrganizationSeason_organizationId_seasonId_key"
ON "TeamOrganizationSeason"("organizationId", "seasonId");

CREATE INDEX "TeamOrganizationSeason_seasonId_principalUserId_idx"
ON "TeamOrganizationSeason"("seasonId", "principalUserId");

CREATE INDEX "TeamOrganizationSeason_principalUserId_idx"
ON "TeamOrganizationSeason"("principalUserId");

ALTER TABLE "TeamOrganizationSeason"
ADD CONSTRAINT "TeamOrganizationSeason_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "TeamOrganization"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "TeamOrganizationSeason"
ADD CONSTRAINT "TeamOrganizationSeason_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "TeamOrganizationSeason"
ADD CONSTRAINT "TeamOrganizationSeason_principalUserId_fkey"
FOREIGN KEY ("principalUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE "GlobalRaceWeekend" (
    "id" SERIAL NOT NULL,
    "raceId" INTEGER NOT NULL,
    "status" "GlobalWeekendStatus" NOT NULL DEFAULT 'PENDING',
    "reason" VARCHAR(1000),
    "version" INTEGER NOT NULL DEFAULT 1,
    "finalizedAt" TIMESTAMP(3),
    "invalidatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalRaceWeekend_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlobalRaceWeekend_raceId_key"
ON "GlobalRaceWeekend"("raceId");

CREATE INDEX "GlobalRaceWeekend_status_updatedAt_idx"
ON "GlobalRaceWeekend"("status", "updatedAt");

ALTER TABLE "GlobalRaceWeekend"
ADD CONSTRAINT "GlobalRaceWeekend_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

CREATE TABLE "GlobalTeamContribution" (
    "id" SERIAL NOT NULL,
    "raceId" INTEGER NOT NULL,
    "leagueId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "racePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sprintPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalTeamContribution_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlobalTeamContribution_raceId_leagueId_organizationId_key"
ON "GlobalTeamContribution"("raceId", "leagueId", "organizationId");

CREATE INDEX "GlobalTeamContribution_organizationId_raceId_idx"
ON "GlobalTeamContribution"("organizationId", "raceId");

CREATE INDEX "GlobalTeamContribution_leagueId_raceId_idx"
ON "GlobalTeamContribution"("leagueId", "raceId");

ALTER TABLE "GlobalTeamContribution"
ADD CONSTRAINT "GlobalTeamContribution_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GlobalTeamContribution"
ADD CONSTRAINT "GlobalTeamContribution_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "GlobalTeamContribution"
ADD CONSTRAINT "GlobalTeamContribution_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "TeamOrganization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "GlobalTeamStanding" (
    "id" SERIAL NOT NULL,
    "seasonId" INTEGER NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "position" INTEGER NOT NULL,
    "points" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "racePoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sprintPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "leagueCount" INTEGER NOT NULL DEFAULT 0,
    "finalizedWeekendCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "GlobalTeamStanding_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "GlobalTeamStanding_seasonId_organizationId_key"
ON "GlobalTeamStanding"("seasonId", "organizationId");

CREATE UNIQUE INDEX "GlobalTeamStanding_seasonId_position_key"
ON "GlobalTeamStanding"("seasonId", "position");

CREATE INDEX "GlobalTeamStanding_organizationId_idx"
ON "GlobalTeamStanding"("organizationId");

CREATE INDEX "GlobalTeamStanding_seasonId_points_idx"
ON "GlobalTeamStanding"("seasonId", "points");

ALTER TABLE "GlobalTeamStanding"
ADD CONSTRAINT "GlobalTeamStanding_seasonId_fkey"
FOREIGN KEY ("seasonId") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "GlobalTeamStanding"
ADD CONSTRAINT "GlobalTeamStanding_organizationId_fkey"
FOREIGN KEY ("organizationId") REFERENCES "TeamOrganization"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
