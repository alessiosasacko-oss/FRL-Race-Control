-- Make race track details nullable so unrevealed mystery tracks contain no
-- sensitive values at rest.
ALTER TABLE "Race"
ALTER COLUMN "circuit" DROP NOT NULL,
ALTER COLUMN "countryCode" DROP NOT NULL;

-- Multiple leagues may point to the same current shared season.
DROP INDEX "League_currentSeasonId_key";
CREATE INDEX "League_currentSeasonId_idx"
ON "League"("currentSeasonId");

-- Team identities are season- and league-specific in a shared season.
DROP INDEX "Team_seasonId_name_key";
DROP INDEX "Team_seasonId_shortName_key";
CREATE UNIQUE INDEX "Team_leagueId_seasonId_name_key"
ON "Team"("leagueId", "seasonId", "name");
CREATE UNIQUE INDEX "Team_leagueId_seasonId_shortName_key"
ON "Team"("leagueId", "seasonId", "shortName");

-- Seasons retain their existing owner league for backwards compatibility,
-- while calendar availability is represented independently for every league.
CREATE TABLE "_SeasonParticipation" (
    "A" INTEGER NOT NULL,
    "B" INTEGER NOT NULL,
    CONSTRAINT "_SeasonParticipation_AB_pkey" PRIMARY KEY ("A", "B")
);

CREATE INDEX "_SeasonParticipation_B_index"
ON "_SeasonParticipation"("B");

ALTER TABLE "_SeasonParticipation"
ADD CONSTRAINT "_SeasonParticipation_A_fkey"
FOREIGN KEY ("A") REFERENCES "League"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_SeasonParticipation"
ADD CONSTRAINT "_SeasonParticipation_B_fkey"
FOREIGN KEY ("B") REFERENCES "Season"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

-- Every existing season remains available to its historical league. Active
-- seasons are shared with all active leagues without copying race records.
INSERT INTO "_SeasonParticipation" ("A", "B")
SELECT "leagueId", "id" FROM "Season";

INSERT INTO "_SeasonParticipation" ("A", "B")
SELECT league."id", season."id"
FROM "League" AS league
CROSS JOIN "Season" AS season
WHERE league."active" = true
  AND season."active" = true
ON CONFLICT ("A", "B") DO NOTHING;

-- Results, scoring and standings need an explicit league context now that a
-- race can be used by more than one league.
ALTER TABLE "RaceResultSession" ADD COLUMN "leagueId" INTEGER;
ALTER TABLE "Championship" ADD COLUMN "leagueId" INTEGER;
ALTER TABLE "ScoringConfiguration" ADD COLUMN "leagueId" INTEGER;
ALTER TABLE "ChampionshipAdjustment" ADD COLUMN "leagueId" INTEGER;
ALTER TABLE "ChampionshipAudit" ADD COLUMN "leagueId" INTEGER;

UPDATE "RaceResultSession" AS result_session
SET "leagueId" = season."leagueId"
FROM "Race" AS race
JOIN "Season" AS season ON season."id" = race."seasonId"
WHERE result_session."raceId" = race."id";

UPDATE "Championship" AS championship
SET "leagueId" = season."leagueId"
FROM "Season" AS season
WHERE championship."seasonId" = season."id";

UPDATE "ScoringConfiguration" AS scoring
SET "leagueId" = season."leagueId"
FROM "Season" AS season
WHERE scoring."seasonId" = season."id";

UPDATE "ChampionshipAdjustment" AS adjustment
SET "leagueId" = season."leagueId"
FROM "Season" AS season
WHERE adjustment."seasonId" = season."id";

UPDATE "ChampionshipAudit" AS audit
SET "leagueId" = season."leagueId"
FROM "Season" AS season
WHERE audit."seasonId" = season."id";

ALTER TABLE "RaceResultSession" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "Championship" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "ScoringConfiguration" ALTER COLUMN "leagueId" SET NOT NULL;
ALTER TABLE "ChampionshipAdjustment" ALTER COLUMN "leagueId" SET NOT NULL;

DROP INDEX "RaceResultSession_raceId_session_key";
DROP INDEX "Championship_seasonId_key";
DROP INDEX "ScoringConfiguration_seasonId_key";

CREATE UNIQUE INDEX "RaceResultSession_raceId_leagueId_session_key"
ON "RaceResultSession"("raceId", "leagueId", "session");
CREATE INDEX "RaceResultSession_leagueId_raceId_idx"
ON "RaceResultSession"("leagueId", "raceId");

CREATE UNIQUE INDEX "Championship_leagueId_seasonId_key"
ON "Championship"("leagueId", "seasonId");
CREATE INDEX "Championship_seasonId_idx" ON "Championship"("seasonId");
CREATE INDEX "Championship_leagueId_idx" ON "Championship"("leagueId");

CREATE UNIQUE INDEX "ScoringConfiguration_leagueId_seasonId_key"
ON "ScoringConfiguration"("leagueId", "seasonId");
CREATE INDEX "ScoringConfiguration_leagueId_updatedAt_idx"
ON "ScoringConfiguration"("leagueId", "updatedAt");

CREATE INDEX "ChampionshipAdjustment_leagueId_seasonId_createdAt_idx"
ON "ChampionshipAdjustment"("leagueId", "seasonId", "createdAt");
CREATE INDEX "ChampionshipAudit_leagueId_seasonId_createdAt_idx"
ON "ChampionshipAudit"("leagueId", "seasonId", "createdAt");

ALTER TABLE "RaceResultSession"
ADD CONSTRAINT "RaceResultSession_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Championship"
ADD CONSTRAINT "Championship_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ScoringConfiguration"
ADD CONSTRAINT "ScoringConfiguration_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAdjustment"
ADD CONSTRAINT "ChampionshipAdjustment_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "ChampionshipAudit"
ADD CONSTRAINT "ChampionshipAudit_leagueId_fkey"
FOREIGN KEY ("leagueId") REFERENCES "League"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
