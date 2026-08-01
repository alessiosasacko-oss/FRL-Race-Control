-- Team records are preserved for historical results and may be restored later.
ALTER TABLE "Team" ADD COLUMN "archivedAt" TIMESTAMP(3);

-- Existing inactive teams become explicitly archived instead of remaining in
-- an ambiguous inactive state.
UPDATE "Team"
SET "archivedAt" = "updatedAt"
WHERE "active" = false;

-- Archived identities must not block a new active team with the same name or
-- abbreviation. PostgreSQL partial indexes still prevent active duplicates
-- under concurrent requests.
DROP INDEX "Team_leagueId_seasonId_name_key";
DROP INDEX "Team_leagueId_seasonId_shortName_key";

CREATE UNIQUE INDEX "Team_active_leagueId_seasonId_name_key"
ON "Team"("leagueId", "seasonId", LOWER("name"))
WHERE "archivedAt" IS NULL;

CREATE UNIQUE INDEX "Team_active_leagueId_seasonId_shortName_key"
ON "Team"("leagueId", "seasonId", UPPER("shortName"))
WHERE "archivedAt" IS NULL;

CREATE INDEX "Team_archivedAt_idx" ON "Team"("archivedAt");
