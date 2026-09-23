-- Driver images and global-season metadata are additive. Character columns and
-- snapshots intentionally remain available as legacy data.
ALTER TABLE "Driver" ADD COLUMN "imageUrl" TEXT;
ALTER TABLE "Season" ADD COLUMN "globalKey" VARCHAR(190);
ALTER TABLE "Season" ADD COLUMN "isCurrent" BOOLEAN NOT NULL DEFAULT false;

-- Ambiguous legacy seasons remain intact and are recorded for a deliberate
-- follow-up instead of being guessed from a display name alone.
CREATE TABLE "SeasonGlobalizationReview" (
    "legacySeasonId" INTEGER NOT NULL PRIMARY KEY,
    "candidateSeasonId" INTEGER,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TEMP TABLE "_season_candidates" ON COMMIT DROP AS
SELECT
  season."id" AS "legacyId",
  MIN(season."id") OVER (
    PARTITION BY lower(trim(season."name")), season."startsOn", season."endsOn"
  ) AS "canonicalId"
FROM "Season" AS season;

DELETE FROM "_season_candidates" WHERE "legacyId" = "canonicalId";

-- Only exact name/date identities without unique-key collisions are merged.
-- This deliberately avoids fuzzy name matching (for example two unrelated
-- seasons both called "Season 1") and preserves every ambiguous record.
CREATE TEMP TABLE "_season_merge_map" ON COMMIT DROP AS
SELECT candidate.*
FROM "_season_candidates" AS candidate
WHERE NOT EXISTS (
  SELECT 1 FROM "Championship" old_row
  JOIN "Championship" new_row
    ON new_row."seasonId" = candidate."canonicalId"
   AND new_row."leagueId" = old_row."leagueId"
  WHERE old_row."seasonId" = candidate."legacyId"
)
AND NOT EXISTS (
  SELECT 1 FROM "ScoringConfiguration" old_row
  JOIN "ScoringConfiguration" new_row
    ON new_row."seasonId" = candidate."canonicalId"
   AND new_row."leagueId" = old_row."leagueId"
  WHERE old_row."seasonId" = candidate."legacyId"
)
AND NOT EXISTS (
  SELECT 1 FROM "DriverSeasonAssignment" old_row
  JOIN "DriverSeasonAssignment" new_row
    ON new_row."seasonId" = candidate."canonicalId"
   AND new_row."driverId" = old_row."driverId"
  WHERE old_row."seasonId" = candidate."legacyId"
)
AND NOT EXISTS (
  SELECT 1 FROM "TeamOrganizationSeason" old_row
  JOIN "TeamOrganizationSeason" new_row
    ON new_row."seasonId" = candidate."canonicalId"
   AND new_row."organizationId" = old_row."organizationId"
  WHERE old_row."seasonId" = candidate."legacyId"
)
AND NOT EXISTS (
  SELECT 1 FROM "GlobalTeamStanding" old_row
  JOIN "GlobalTeamStanding" new_row
    ON new_row."seasonId" = candidate."canonicalId"
   AND (new_row."organizationId" = old_row."organizationId" OR new_row."position" = old_row."position")
  WHERE old_row."seasonId" = candidate."legacyId"
)
AND NOT EXISTS (
  SELECT 1 FROM "FinanceRuleSet" old_row
  JOIN "FinanceRuleSet" new_row
    ON new_row."seasonId" = candidate."canonicalId"
   AND new_row."leagueId" = old_row."leagueId"
   AND new_row."version" = old_row."version"
  WHERE old_row."seasonId" = candidate."legacyId"
)
AND NOT EXISTS (
  SELECT 1 FROM "SeasonFinanceSettlement" old_row
  JOIN "SeasonFinanceSettlement" new_row
    ON new_row."seasonId" = candidate."canonicalId"
   AND new_row."leagueId" = old_row."leagueId"
  WHERE old_row."seasonId" = candidate."legacyId"
)
AND NOT EXISTS (
  SELECT 1
  FROM "Race" old_race
  JOIN "Race" new_race ON new_race."seasonId" = candidate."canonicalId"
    AND (new_race."round" = old_race."round" OR lower(trim(new_race."name")) = lower(trim(old_race."name")))
  WHERE old_race."seasonId" = candidate."legacyId"
    AND NOT (
      new_race."round" = old_race."round"
      AND lower(trim(new_race."name")) = lower(trim(old_race."name"))
      AND new_race."weekendDate" = old_race."weekendDate"
    )
)
AND NOT EXISTS (
  SELECT 1
  FROM "Race" old_race
  JOIN "Race" new_race ON new_race."seasonId" = candidate."canonicalId"
    AND new_race."round" = old_race."round"
    AND lower(trim(new_race."name")) = lower(trim(old_race."name"))
    AND new_race."weekendDate" = old_race."weekendDate"
  WHERE old_race."seasonId" = candidate."legacyId"
    AND (
      (EXISTS (SELECT 1 FROM "RaceVisual" WHERE "raceId" = old_race."id") AND EXISTS (SELECT 1 FROM "RaceVisual" WHERE "raceId" = new_race."id"))
      OR (EXISTS (SELECT 1 FROM "GlobalRaceWeekend" WHERE "raceId" = old_race."id") AND EXISTS (SELECT 1 FROM "GlobalRaceWeekend" WHERE "raceId" = new_race."id"))
      OR EXISTS (
        SELECT 1 FROM "RaceLeagueSchedule" old_child
        JOIN "RaceLeagueSchedule" new_child ON new_child."raceId" = new_race."id" AND new_child."leagueId" = old_child."leagueId"
        WHERE old_child."raceId" = old_race."id"
      )
      OR EXISTS (
        SELECT 1 FROM "RaceResultSession" old_child
        JOIN "RaceResultSession" new_child ON new_child."raceId" = new_race."id" AND new_child."leagueId" = old_child."leagueId" AND new_child."session" = old_child."session"
        WHERE old_child."raceId" = old_race."id"
      )
      OR EXISTS (
        SELECT 1 FROM "RaceAttendance" old_child
        JOIN "RaceAttendance" new_child ON new_child."raceId" = new_race."id" AND (new_child."driverId" = old_child."driverId" OR (new_child."substituteDriverId" IS NOT NULL AND new_child."substituteDriverId" = old_child."substituteDriverId"))
        WHERE old_child."raceId" = old_race."id"
      )
      OR EXISTS (
        SELECT 1 FROM "GlobalTeamContribution" old_child
        JOIN "GlobalTeamContribution" new_child ON new_child."raceId" = new_race."id" AND new_child."leagueId" = old_child."leagueId" AND new_child."organizationId" = old_child."organizationId"
        WHERE old_child."raceId" = old_race."id"
      )
      OR EXISTS (
        SELECT 1 FROM "ResultGraphic" old_child
        JOIN "ResultGraphic" new_child ON new_child."raceId" = new_race."id" AND new_child."leagueId" = old_child."leagueId" AND new_child."type" = old_child."type" AND new_child."version" = old_child."version"
        WHERE old_child."raceId" = old_race."id"
      )
      OR EXISTS (
        SELECT 1 FROM "RaceFinanceSettlement" old_child
        JOIN "RaceFinanceSettlement" new_child ON new_child."raceId" = new_race."id" AND new_child."leagueId" = old_child."leagueId"
        WHERE old_child."raceId" = old_race."id"
      )
    )
);

INSERT INTO "SeasonGlobalizationReview" ("legacySeasonId", "candidateSeasonId", "reason")
SELECT candidate."legacyId", candidate."canonicalId", 'Automatische Zusammenführung wegen mehrdeutiger oder kollidierender Abhängigkeiten ausgelassen.'
FROM "_season_candidates" AS candidate
LEFT JOIN "_season_merge_map" AS mergeable ON mergeable."legacyId" = candidate."legacyId"
WHERE mergeable."legacyId" IS NULL;

CREATE TEMP TABLE "_race_merge_map" ON COMMIT DROP AS
SELECT old_race."id" AS "legacyId", new_race."id" AS "canonicalId"
FROM "_season_merge_map" season_map
JOIN "Race" old_race ON old_race."seasonId" = season_map."legacyId"
JOIN "Race" new_race ON new_race."seasonId" = season_map."canonicalId"
  AND new_race."round" = old_race."round"
  AND lower(trim(new_race."name")) = lower(trim(old_race."name"))
  AND new_race."weekendDate" = old_race."weekendDate";

UPDATE "FiaTicket" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceAttendance" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceLeagueSchedule" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "AttendanceAudit" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceResultSession" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "ChampionshipAdjustment" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "ChampionshipAudit" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "GlobalRaceWeekend" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "GlobalTeamContribution" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "ResultGraphic" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "TeamFinanceTransaction" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceFinanceSettlement" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceVisual" child SET "raceId" = map."canonicalId" FROM "_race_merge_map" map WHERE child."raceId" = map."legacyId";

DELETE FROM "Race" race USING "_race_merge_map" map WHERE race."id" = map."legacyId";
UPDATE "Race" race SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE race."seasonId" = map."legacyId";

INSERT INTO "_SeasonParticipation" ("A", "B")
SELECT participation."A", map."canonicalId"
FROM "_SeasonParticipation" participation
JOIN "_season_merge_map" map ON map."legacyId" = participation."B"
ON CONFLICT ("A", "B") DO NOTHING;

UPDATE "League" child SET "currentSeasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."currentSeasonId" = map."legacyId";
UPDATE "Team" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "DriverSeasonAssignment" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "TeamOrganizationSeason" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "Championship" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "ScoringConfiguration" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "ChampionshipAdjustment" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "ChampionshipAudit" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "GlobalTeamStanding" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "FiaTicket" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "FinanceRuleSet" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "TeamFinanceTransaction" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "RaceFinanceSettlement" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "SeasonFinanceSettlement" child SET "seasonId" = map."canonicalId" FROM "_season_merge_map" map WHERE child."seasonId" = map."legacyId";

DELETE FROM "Season" season USING "_season_merge_map" map WHERE season."id" = map."legacyId";

-- Every global season is selectable in every active FRL league. Existing
-- inactive/historical participation links remain untouched.
INSERT INTO "_SeasonParticipation" ("A", "B")
SELECT league."id", season."id"
FROM "League" league
CROSS JOIN "Season" season
WHERE league."active" = true
ON CONFLICT ("A", "B") DO NOTHING;

WITH season_keys AS (
  SELECT
    "id",
    concat(
      lower(regexp_replace(trim("name"), '[^a-zA-Z0-9]+', '-', 'g')),
      '-', to_char("startsOn", 'YYYYMMDD')
    ) AS "baseKey",
    row_number() OVER (
      PARTITION BY lower(trim("name")), "startsOn"
      ORDER BY "id"
    ) AS "keyOrdinal"
  FROM "Season"
)
UPDATE "Season" season
SET "globalKey" = CASE
  WHEN keys."keyOrdinal" = 1 THEN keys."baseKey"
  ELSE concat(keys."baseKey", '-', season."id")
END
FROM season_keys keys
WHERE keys."id" = season."id";
ALTER TABLE "Season" ALTER COLUMN "globalKey" SET NOT NULL;
CREATE UNIQUE INDEX "Season_globalKey_key" ON "Season"("globalKey");
CREATE INDEX "Season_isCurrent_active_archivedAt_idx" ON "Season"("isCurrent", "active", "archivedAt");

WITH selected AS (
  SELECT season."id"
  FROM "Season" season
  LEFT JOIN "League" league ON league."currentSeasonId" = season."id" AND league."active" = true
  WHERE season."active" = true AND season."archivedAt" IS NULL
  GROUP BY season."id", season."startsOn"
  ORDER BY COUNT(league."id") DESC, season."startsOn" DESC, season."id" DESC
  LIMIT 1
)
UPDATE "Season" SET "isCurrent" = ("id" = (SELECT "id" FROM selected));

UPDATE "League"
SET "currentSeasonId" = (SELECT "id" FROM "Season" WHERE "isCurrent" = true LIMIT 1)
WHERE "active" = true
  AND EXISTS (SELECT 1 FROM "Season" WHERE "isCurrent" = true);

CREATE TABLE "DriverCareerStats" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "autoRaceStarts" INTEGER NOT NULL DEFAULT 0,
    "autoWins" INTEGER NOT NULL DEFAULT 0,
    "autoPodiums" INTEGER NOT NULL DEFAULT 0,
    "autoPoles" INTEGER NOT NULL DEFAULT 0,
    "autoFastestLaps" INTEGER NOT NULL DEFAULT 0,
    "autoPoints" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "manualRaceStartsAdjustment" INTEGER NOT NULL DEFAULT 0,
    "manualWinsAdjustment" INTEGER NOT NULL DEFAULT 0,
    "manualPodiumsAdjustment" INTEGER NOT NULL DEFAULT 0,
    "manualPolesAdjustment" INTEGER NOT NULL DEFAULT 0,
    "manualFastestLapsAdjustment" INTEGER NOT NULL DEFAULT 0,
    "manualPointsAdjustment" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "autoFirstGrandPrix" VARCHAR(240),
    "manualFirstGrandPrix" VARCHAR(240),
    "autoPastTeams" JSONB NOT NULL DEFAULT '[]',
    "manualPastTeams" JSONB NOT NULL DEFAULT '[]',
    "reconciledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriverCareerStats_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriverCareerStatsAudit" (
    "id" SERIAL NOT NULL,
    "driverId" INTEGER NOT NULL,
    "actorId" INTEGER NOT NULL,
    "action" VARCHAR(48) NOT NULL,
    "previousState" JSONB NOT NULL,
    "newState" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DriverCareerStatsAudit_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "DriverCareerStats_driverId_key" ON "DriverCareerStats"("driverId");
CREATE INDEX "DriverCareerStats_reconciledAt_idx" ON "DriverCareerStats"("reconciledAt");
CREATE INDEX "DriverCareerStatsAudit_driverId_createdAt_idx" ON "DriverCareerStatsAudit"("driverId", "createdAt");
CREATE INDEX "DriverCareerStatsAudit_actorId_createdAt_idx" ON "DriverCareerStatsAudit"("actorId", "createdAt");

ALTER TABLE "DriverCareerStats" ADD CONSTRAINT "DriverCareerStats_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverCareerStatsAudit" ADD CONSTRAINT "DriverCareerStatsAudit_driverId_fkey" FOREIGN KEY ("driverId") REFERENCES "Driver"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverCareerStatsAudit" ADD CONSTRAINT "DriverCareerStatsAudit_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Materialize all existing published history once. Result rows win for a
-- season; a standing contributes points only when that driver has no
-- published race/sprint rows for the same season.
WITH result_stats AS (
  SELECT
    result."driverId",
    COUNT(*) FILTER (WHERE session."session" = 'RACE' AND result."baseStatus" <> 'DNS')::INTEGER AS starts,
    COUNT(*) FILTER (WHERE session."session" = 'RACE' AND result."baseStatus" NOT IN ('DNS', 'DSQ') AND COALESCE(result."finalPosition", result."position") = 1)::INTEGER AS wins,
    COUNT(*) FILTER (WHERE session."session" = 'RACE' AND result."baseStatus" NOT IN ('DNS', 'DSQ') AND COALESCE(result."finalPosition", result."position") BETWEEN 1 AND 3)::INTEGER AS podiums,
    COUNT(*) FILTER (WHERE session."session" = 'QUALIFYING' AND result."baseStatus" NOT IN ('DNS', 'DSQ') AND COALESCE(result."finalPosition", result."position") = 1)::INTEGER AS poles,
    COUNT(*) FILTER (WHERE session."session" = 'RACE' AND result."baseStatus" NOT IN ('DNS', 'DSQ') AND result."fastestLap" = true)::INTEGER AS fastest_laps,
    COALESCE(SUM(result."racePoints" + result."bonusPoints") FILTER (WHERE session."session" IN ('RACE', 'SPRINT')), 0) AS points
  FROM "RaceResult" result
  JOIN "RaceResultSession" session ON session."id" = result."resultSessionId" AND session."publicationStatus" = 'PUBLISHED'
  GROUP BY result."driverId"
), standing_fallback AS (
  SELECT standing."driverId", COALESCE(SUM(standing."points"), 0) AS points
  FROM "DriverStanding" standing
  JOIN "Championship" championship ON championship."id" = standing."championshipId"
  WHERE NOT EXISTS (
    SELECT 1
    FROM "RaceResult" result
    JOIN "RaceResultSession" session ON session."id" = result."resultSessionId"
    JOIN "Race" race ON race."id" = session."raceId"
    WHERE result."driverId" = standing."driverId"
      AND race."seasonId" = championship."seasonId"
      AND session."publicationStatus" = 'PUBLISHED'
      AND session."session" IN ('RACE', 'SPRINT')
  )
  GROUP BY standing."driverId"
), first_grand_prix AS (
  SELECT DISTINCT ON (result."driverId")
    result."driverId",
    concat(season."name", ' R', race."round", ' ', race."name") AS label
  FROM "RaceResult" result
  JOIN "RaceResultSession" session ON session."id" = result."resultSessionId"
  JOIN "Race" race ON race."id" = session."raceId"
  JOIN "Season" season ON season."id" = race."seasonId"
  WHERE session."publicationStatus" = 'PUBLISHED'
    AND session."session" = 'RACE'
    AND result."baseStatus" <> 'DNS'
  ORDER BY result."driverId", race."scheduledAt" ASC, race."id" ASC
), past_teams AS (
  SELECT
    result."driverId",
    COALESCE(jsonb_agg(DISTINCT COALESCE(organization."name", represented_team."name")) FILTER (
      WHERE COALESCE(organization."name", represented_team."name") IS DISTINCT FROM COALESCE(current_organization."name", current_team."name")
    ), '[]'::jsonb) AS teams
  FROM "RaceResult" result
  JOIN "RaceResultSession" session ON session."id" = result."resultSessionId" AND session."publicationStatus" = 'PUBLISHED'
  JOIN "Team" represented_team ON represented_team."id" = result."representedTeamId"
  LEFT JOIN "TeamOrganization" organization ON organization."id" = represented_team."organizationId"
  JOIN "Driver" driver ON driver."id" = result."driverId"
  LEFT JOIN "Team" current_team ON current_team."id" = driver."teamId"
  LEFT JOIN "TeamOrganization" current_organization ON current_organization."id" = current_team."organizationId"
  GROUP BY result."driverId"
)
INSERT INTO "DriverCareerStats" (
  "driverId", "autoRaceStarts", "autoWins", "autoPodiums", "autoPoles",
  "autoFastestLaps", "autoPoints", "autoFirstGrandPrix", "autoPastTeams",
  "reconciledAt", "updatedAt"
)
SELECT
  driver."id",
  COALESCE(result_stats.starts, 0),
  COALESCE(result_stats.wins, 0),
  COALESCE(result_stats.podiums, 0),
  COALESCE(result_stats.poles, 0),
  COALESCE(result_stats.fastest_laps, 0),
  COALESCE(result_stats.points, 0) + COALESCE(standing_fallback.points, 0),
  first_grand_prix.label,
  COALESCE(past_teams.teams, '[]'::jsonb),
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Driver" driver
LEFT JOIN result_stats ON result_stats."driverId" = driver."id"
LEFT JOIN standing_fallback ON standing_fallback."driverId" = driver."id"
LEFT JOIN first_grand_prix ON first_grand_prix."driverId" = driver."id"
LEFT JOIN past_teams ON past_teams."driverId" = driver."id";
