-- A Driver is the durable global person identity. Season, league and team
-- participation are represented exclusively by DriverSeasonAssignment.
ALTER TABLE "Driver" ALTER COLUMN "leagueId" DROP NOT NULL;
