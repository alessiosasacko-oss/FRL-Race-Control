-- Driver images and global-season metadata are additive. Character columns and
-- snapshots intentionally remain available as legacy data.
--
-- Prisma may execute PostgreSQL migration statements with autocommit semantics.
-- Keep the whole globalization and backfill atomic and do not rely on a
-- transaction-scoped TEMP TABLE surviving between statements.
BEGIN;
SELECT 'STAGE 01 preflight' AS migration_stage;

-- A previous production attempt failed immediately after creating the first
-- helper table. Accept either a pristine database or precisely that harmless
-- early DDL state. Any later/unknown partial state aborts instead of being
-- hidden behind broad IF NOT EXISTS clauses.
DO $migration_preflight$
DECLARE
  has_rows BOOLEAN;
  current_count INTEGER;
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Driver'
      AND column_name = 'imageUrl'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Driver'
      AND column_name = 'imageUrl'
      AND data_type = 'text'
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Unexpected existing definition for Driver.imageUrl; manual review required.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Season'
      AND column_name = 'globalKey'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Season'
      AND column_name = 'globalKey'
      AND data_type = 'character varying'
      AND character_maximum_length = 190
      AND is_nullable = 'YES'
  ) THEN
    RAISE EXCEPTION 'Unexpected existing definition for Season.globalKey; manual review required.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Season'
      AND column_name = 'isCurrent'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = 'Season'
      AND column_name = 'isCurrent'
      AND data_type = 'boolean'
      AND is_nullable = 'NO'
  ) THEN
    RAISE EXCEPTION 'Unexpected existing definition for Season.isCurrent; manual review required.';
  END IF;

  IF to_regclass(format('%I.%I', current_schema(), 'SeasonGlobalizationReview')) IS NOT NULL THEN
    IF (
      SELECT COUNT(*)
      FROM information_schema.columns
      WHERE table_schema = current_schema()
        AND table_name = 'SeasonGlobalizationReview'
    ) <> 4 OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'SeasonGlobalizationReview'
        AND column_name = 'legacySeasonId' AND data_type = 'integer' AND is_nullable = 'NO'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'SeasonGlobalizationReview'
        AND column_name = 'candidateSeasonId' AND data_type = 'integer' AND is_nullable = 'YES'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'SeasonGlobalizationReview'
        AND column_name = 'reason' AND data_type = 'character varying'
        AND character_maximum_length = 500 AND is_nullable = 'NO'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = current_schema() AND table_name = 'SeasonGlobalizationReview'
        AND column_name = 'createdAt' AND data_type = 'timestamp without time zone' AND is_nullable = 'NO'
    ) OR NOT EXISTS (
      SELECT 1
      FROM pg_constraint
      WHERE conrelid = to_regclass(format('%I.%I', current_schema(), 'SeasonGlobalizationReview'))
        AND contype = 'p'
        AND pg_get_constraintdef(oid) = 'PRIMARY KEY ("legacySeasonId")'
    ) THEN
      RAISE EXCEPTION 'Unexpected existing SeasonGlobalizationReview definition; manual review required.';
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I)',
      current_schema(),
      'SeasonGlobalizationReview'
    ) INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION 'SeasonGlobalizationReview already contains rows; migration state requires manual review.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Season' AND column_name = 'globalKey'
  ) THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I IS NOT NULL AND btrim(%I) = '''')',
      current_schema(),
      'Season',
      'globalKey',
      'globalKey'
    ) INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION 'Season.globalKey contains an empty value; manual review required.';
    END IF;

    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I IS NOT NULL GROUP BY %I HAVING COUNT(*) > 1)',
      current_schema(),
      'Season',
      'globalKey',
      'globalKey'
    ) INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION 'Season.globalKey contains duplicate values; manual review required.';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = current_schema() AND table_name = 'Season' AND column_name = 'isCurrent'
  ) THEN
    EXECUTE format(
      'SELECT EXISTS (SELECT 1 FROM %I.%I WHERE %I = true AND (%I = false OR %I IS NOT NULL))',
      current_schema(),
      'Season',
      'isCurrent',
      'active',
      'archivedAt'
    ) INTO has_rows;
    IF has_rows THEN
      RAISE EXCEPTION 'An inactive or archived Season is marked isCurrent; manual review required.';
    END IF;

    EXECUTE format(
      'SELECT COUNT(*) FROM %I.%I WHERE %I = true AND %I = true AND %I IS NULL',
      current_schema(),
      'Season',
      'isCurrent',
      'active',
      'archivedAt'
    ) INTO current_count;
    IF current_count > 1 THEN
      RAISE EXCEPTION 'More than one active, non-archived Season is marked isCurrent; manual review required.';
    END IF;
  END IF;

  IF to_regclass(format('%I.%I', current_schema(), 'DriverCareerStats')) IS NOT NULL
    OR to_regclass(format('%I.%I', current_schema(), 'DriverCareerStatsAudit')) IS NOT NULL
    OR to_regclass(format('%I.%I', current_schema(), 'Season_globalKey_key')) IS NOT NULL
    OR to_regclass(format('%I.%I', current_schema(), 'Season_isCurrent_active_archivedAt_idx')) IS NOT NULL
    OR to_regclass(format('%I.%I', current_schema(), '_migration_20260923120000_season_candidates')) IS NOT NULL
    OR to_regclass(format('%I.%I', current_schema(), '_migration_20260923120000_season_merge_map')) IS NOT NULL
    OR to_regclass(format('%I.%I', current_schema(), '_migration_20260923120000_race_merge_map')) IS NOT NULL
  THEN
    RAISE EXCEPTION 'Unexpected later migration objects exist; manual review required before retry.';
  END IF;
END
$migration_preflight$;

-- These conditional creates are safe only after the strict preflight above.
SELECT 'STAGE 02 additive columns' AS migration_stage;

ALTER TABLE "Driver" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "globalKey" VARCHAR(190);
ALTER TABLE "Season" ADD COLUMN IF NOT EXISTS "isCurrent" BOOLEAN NOT NULL DEFAULT false;

-- Ambiguous legacy seasons remain intact and are recorded for a deliberate
-- follow-up instead of being guessed from a display name alone.
CREATE TABLE IF NOT EXISTS "SeasonGlobalizationReview" (
    "legacySeasonId" INTEGER NOT NULL PRIMARY KEY,
    "candidateSeasonId" INTEGER,
    "reason" VARCHAR(500) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

SELECT 'STAGE 03 season candidates' AS migration_stage;

CREATE TABLE "_migration_20260923120000_season_candidates" AS
SELECT
  season."id" AS "legacyId",
  MIN(season."id") OVER (
    PARTITION BY lower(trim(season."name")), season."startsOn", season."endsOn"
  ) AS "canonicalId"
FROM "Season" AS season;

DELETE FROM "_migration_20260923120000_season_candidates" WHERE "legacyId" = "canonicalId";

-- Only exact name/date identities without unique-key collisions are merged.
-- This deliberately avoids fuzzy name matching (for example two unrelated
-- seasons both called "Season 1") and preserves every ambiguous record.
SELECT 'STAGE 04 season merge map' AS migration_stage;

CREATE TABLE "_migration_20260923120000_season_merge_map" AS
SELECT candidate.*
FROM "_migration_20260923120000_season_candidates" AS candidate
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
FROM "_migration_20260923120000_season_candidates" AS candidate
LEFT JOIN "_migration_20260923120000_season_merge_map" AS mergeable ON mergeable."legacyId" = candidate."legacyId"
WHERE mergeable."legacyId" IS NULL;

SELECT 'STAGE 05 race merge map' AS migration_stage;

CREATE TABLE "_migration_20260923120000_race_merge_map" AS
SELECT old_race."id" AS "legacyId", new_race."id" AS "canonicalId"
FROM "_migration_20260923120000_season_merge_map" season_map
JOIN "Race" old_race ON old_race."seasonId" = season_map."legacyId"
JOIN "Race" new_race ON new_race."seasonId" = season_map."canonicalId"
  AND new_race."round" = old_race."round"
  AND lower(trim(new_race."name")) = lower(trim(old_race."name"))
  AND new_race."weekendDate" = old_race."weekendDate";

SELECT 'STAGE 06 race relation updates' AS migration_stage;

UPDATE "FiaTicket" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceAttendance" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceLeagueSchedule" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "AttendanceAudit" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceResultSession" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "ChampionshipAdjustment" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "ChampionshipAudit" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "GlobalRaceWeekend" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "GlobalTeamContribution" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "ResultGraphic" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "TeamFinanceTransaction" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceFinanceSettlement" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";
UPDATE "RaceVisual" child SET "raceId" = map."canonicalId" FROM "_migration_20260923120000_race_merge_map" map WHERE child."raceId" = map."legacyId";

DELETE FROM "Race" race USING "_migration_20260923120000_race_merge_map" map WHERE race."id" = map."legacyId";
UPDATE "Race" race SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE race."seasonId" = map."legacyId";

SELECT 'STAGE 07 season relation updates' AS migration_stage;

INSERT INTO "_SeasonParticipation" ("A", "B")
SELECT participation."A", map."canonicalId"
FROM "_SeasonParticipation" participation
JOIN "_migration_20260923120000_season_merge_map" map ON map."legacyId" = participation."B"
ON CONFLICT ("A", "B") DO NOTHING;

UPDATE "League" child SET "currentSeasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."currentSeasonId" = map."legacyId";
UPDATE "Team" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "DriverSeasonAssignment" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "TeamOrganizationSeason" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "Championship" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "ScoringConfiguration" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "ChampionshipAdjustment" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "ChampionshipAudit" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "GlobalTeamStanding" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "FiaTicket" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "FinanceRuleSet" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "TeamFinanceTransaction" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "RaceFinanceSettlement" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";
UPDATE "SeasonFinanceSettlement" child SET "seasonId" = map."canonicalId" FROM "_migration_20260923120000_season_merge_map" map WHERE child."seasonId" = map."legacyId";

DELETE FROM "Season" season USING "_migration_20260923120000_season_merge_map" map WHERE season."id" = map."legacyId";

SELECT 'STAGE 08 global season keys' AS migration_stage;

-- Every global season is selectable in every active FRL league. Existing
-- inactive/historical participation links remain untouched.
INSERT INTO "_SeasonParticipation" ("A", "B")
SELECT league."id", season."id"
FROM "League" league
CROSS JOIN "Season" season
WHERE league."active" = true
ON CONFLICT ("A", "B") DO NOTHING;

DO $global_key_preflight$
DECLARE
  has_collisions BOOLEAN;
BEGIN
  WITH missing_season_keys AS (
    SELECT
      season."id",
      concat(
        lower(regexp_replace(trim(season."name"), '[^a-zA-Z0-9]+', '-', 'g')),
        '-', to_char(season."startsOn", 'YYYYMMDD')
      ) AS "baseKey",
      COUNT(*) OVER (
        PARTITION BY lower(trim(season."name")), season."startsOn"
      ) AS "missingKeyCount"
    FROM "Season" season
    WHERE season."globalKey" IS NULL
  ), generated_keys AS (
    SELECT
      missing."id",
      CASE
        WHEN missing."missingKeyCount" = 1
          AND NOT EXISTS (
            SELECT 1 FROM "Season" existing
            WHERE existing."globalKey" = missing."baseKey"
          )
        THEN missing."baseKey"
        ELSE concat(missing."baseKey", '-legacy-', missing."id")
      END AS "globalKey"
    FROM missing_season_keys missing
  )
  SELECT EXISTS (
    SELECT 1
    FROM (
      SELECT "globalKey" FROM generated_keys
      UNION ALL
      SELECT "globalKey" FROM "Season" WHERE "globalKey" IS NOT NULL
    ) key_values
    GROUP BY "globalKey"
    HAVING COUNT(*) > 1
  ) INTO has_collisions;

  IF has_collisions THEN
    RAISE EXCEPTION 'A generated Season.globalKey would collide with an existing value; manual review required.';
  END IF;
END
$global_key_preflight$;

WITH missing_season_keys AS (
  SELECT
    season."id",
    concat(
      lower(regexp_replace(trim(season."name"), '[^a-zA-Z0-9]+', '-', 'g')),
      '-', to_char(season."startsOn", 'YYYYMMDD')
    ) AS "baseKey",
    COUNT(*) OVER (
      PARTITION BY lower(trim(season."name")), season."startsOn"
    ) AS "missingKeyCount"
  FROM "Season" season
  WHERE season."globalKey" IS NULL
), generated_keys AS (
  SELECT
    missing."id",
    CASE
      WHEN missing."missingKeyCount" = 1
        AND NOT EXISTS (
          SELECT 1 FROM "Season" existing
          WHERE existing."globalKey" = missing."baseKey"
        )
      THEN missing."baseKey"
      ELSE concat(missing."baseKey", '-legacy-', missing."id")
    END AS "globalKey"
  FROM missing_season_keys missing
)
UPDATE "Season" season
SET "globalKey" = generated."globalKey"
FROM generated_keys generated
WHERE generated."id" = season."id"
  AND season."globalKey" IS NULL;
ALTER TABLE "Season" ALTER COLUMN "globalKey" SET NOT NULL;
CREATE UNIQUE INDEX "Season_globalKey_key" ON "Season"("globalKey");
CREATE INDEX "Season_isCurrent_active_archivedAt_idx" ON "Season"("isCurrent", "active", "archivedAt");

SELECT 'STAGE 09 current season' AS migration_stage;

WITH selected AS (
  SELECT season."id"
  FROM "Season" season
  LEFT JOIN "League" league ON league."currentSeasonId" = season."id" AND league."active" = true
  WHERE season."active" = true AND season."archivedAt" IS NULL
  GROUP BY season."id", season."startsOn"
  ORDER BY COUNT(league."id") DESC, season."startsOn" DESC, season."id" DESC
  LIMIT 1
)
UPDATE "Season"
SET "isCurrent" = true
WHERE "id" = (SELECT "id" FROM selected)
  AND NOT EXISTS (
    SELECT 1 FROM "Season"
    WHERE "isCurrent" = true AND "active" = true AND "archivedAt" IS NULL
  );

UPDATE "League"
SET "currentSeasonId" = (
  SELECT "id" FROM "Season"
  WHERE "isCurrent" = true AND "active" = true AND "archivedAt" IS NULL
  LIMIT 1
)
WHERE "active" = true;

SELECT 'STAGE 10 career tables' AS migration_stage;

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

SELECT 'STAGE 11 career constraints and indexes' AS migration_stage;

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
SELECT 'STAGE 12 career backfill' AS migration_stage;

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

SELECT 'STAGE 13 cleanup' AS migration_stage;

-- The helper relations are migration-private and may be absent after an
-- interrupted/retried execution. Make only this internal cleanup idempotent.
DROP TABLE IF EXISTS "_migration_20260923120000_race_merge_map";
DROP TABLE IF EXISTS "_migration_20260923120000_season_merge_map";
DROP TABLE IF EXISTS "_migration_20260923120000_season_candidates";

ROLLBACK;
