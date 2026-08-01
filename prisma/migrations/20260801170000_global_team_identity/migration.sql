-- TeamOrganization is the only user-visible team identity. Legacy Team rows
-- remain intact as technical season/division slots for historical relations.
ALTER TABLE "TeamOrganization"
ADD COLUMN "secondaryColor" CHAR(7),
ADD COLUMN "contrastColor" CHAR(7),
ADD COLUMN "logoUrl" TEXT,
ADD COLUMN "archivedAt" TIMESTAMP(3);

ALTER TABLE "Team"
ADD COLUMN "systemManaged" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN "internalSlotKey" VARCHAR(96);

-- Linked legacy teams are known slots. Independent unlinked teams are not
-- guessed or merged automatically and keep all existing relations unchanged.
UPDATE "Team"
SET "systemManaged" = true
WHERE "organizationId" IS NOT NULL;

-- Adopt existing branding without changing any result, standing, attendance,
-- FIA or driver foreign key. The oldest linked slot is the deterministic source.
UPDATE "TeamOrganization" AS organization
SET
  "secondaryColor" = (
    SELECT team."secondaryColor" FROM "Team" AS team
    WHERE team."organizationId" = organization."id"
    ORDER BY team."createdAt" ASC, team."id" ASC LIMIT 1
  ),
  "contrastColor" = (
    SELECT team."contrastColor" FROM "Team" AS team
    WHERE team."organizationId" = organization."id"
    ORDER BY team."createdAt" ASC, team."id" ASC LIMIT 1
  ),
  "logoUrl" = (
    SELECT team."logoUrl" FROM "Team" AS team
    WHERE team."organizationId" = organization."id"
    ORDER BY team."createdAt" ASC, team."id" ASC LIMIT 1
  )
WHERE EXISTS (
  SELECT 1 FROM "Team" AS team
  WHERE team."organizationId" = organization."id"
);

UPDATE "TeamOrganization"
SET "archivedAt" = "updatedAt"
WHERE "active" = false;

-- Only one existing slot per organization/season/division receives the stable
-- key. Unexpected duplicates remain readable and are deliberately not merged.
UPDATE "Team" AS team
SET "internalSlotKey" = CONCAT(
  'organization:', team."organizationId",
  ':season:', team."seasonId",
  ':league:', team."leagueId"
)
WHERE team."organizationId" IS NOT NULL
  AND team."id" = (
    SELECT MIN(candidate."id")
    FROM "Team" AS candidate
    WHERE candidate."organizationId" = team."organizationId"
      AND candidate."seasonId" = team."seasonId"
      AND candidate."leagueId" = team."leagueId"
  );

CREATE UNIQUE INDEX "Team_internalSlotKey_key"
ON "Team"("internalSlotKey");

CREATE INDEX "Team_organizationId_seasonId_leagueId_systemManaged_idx"
ON "Team"("organizationId", "seasonId", "leagueId", "systemManaged");

CREATE INDEX "TeamOrganization_archivedAt_idx"
ON "TeamOrganization"("archivedAt");

-- PostgreSQL partial uniqueness allows historical archived identities to remain
-- while concurrent active team creation stays safe and case-insensitive.
CREATE UNIQUE INDEX "TeamOrganization_active_shortName_key"
ON "TeamOrganization"(UPPER("shortName"))
WHERE "archivedAt" IS NULL;
