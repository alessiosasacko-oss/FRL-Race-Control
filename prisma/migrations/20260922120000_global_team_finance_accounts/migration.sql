-- Team finance accounts are global per canonical TeamOrganization. League,
-- season and technical Team remain immutable metadata on ledger entries.

-- Older technical teams may predate canonical organizations. Reuse an
-- organization with the same name or create one before moving finance data.
INSERT INTO "TeamOrganization" (
    "name", "shortName", "color", "secondaryColor", "contrastColor",
    "logoUrl", "active", "archivedAt", "createdAt", "updatedAt"
)
SELECT DISTINCT ON (team."name")
    team."name", team."shortName", team."color", team."secondaryColor",
    team."contrastColor", team."logoUrl", team."active", team."archivedAt",
    CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
FROM "Team" AS team
INNER JOIN "TeamFinanceAccount" AS account ON account."teamId" = team."id"
WHERE team."organizationId" IS NULL
ORDER BY team."name", team."id"
ON CONFLICT ("name") DO NOTHING;

UPDATE "Team" AS team
SET "organizationId" = organization."id"
FROM "TeamOrganization" AS organization
WHERE team."organizationId" IS NULL
  AND team."name" = organization."name"
  AND EXISTS (
      SELECT 1 FROM "TeamFinanceAccount" AS account
      WHERE account."teamId" = team."id"
  );

ALTER TABLE "TeamFinanceAccount" ADD COLUMN "organizationId" INTEGER;

UPDATE "TeamFinanceAccount" AS account
SET "organizationId" = team."organizationId"
FROM "Team" AS team
WHERE team."id" = account."teamId";

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "TeamFinanceAccount" WHERE "organizationId" IS NULL) THEN
    RAISE EXCEPTION 'Cannot globalize team finance accounts without a canonical TeamOrganization';
  END IF;
END $$;

-- Prefer the account whose start balance was configured manually most
-- recently. If no administrator ever changed it, retain the oldest account so
-- the single automatic opening balance starts at the beginning of history.
CREATE TEMPORARY TABLE "_GlobalFinanceAccountMap" ON COMMIT DROP AS
SELECT
    account."id" AS "oldAccountId",
    account."organizationId",
    FIRST_VALUE(account."id") OVER (
      PARTITION BY account."organizationId"
      ORDER BY
        (start_entry."lastManualStartAt" IS NOT NULL) DESC,
        start_entry."lastManualStartAt" DESC NULLS LAST,
        account."createdAt" ASC,
        account."id" ASC
    ) AS "survivorAccountId"
FROM "TeamFinanceAccount" AS account
LEFT JOIN (
    SELECT "accountId", MAX("createdAt") AS "lastManualStartAt"
    FROM "TeamFinanceTransaction"
    WHERE "type" = 'START_BALANCE' AND "source" = 'MANUAL'
    GROUP BY "accountId"
) AS start_entry ON start_entry."accountId" = account."id";

-- Keep every historic row, but neutralize opening-balance chains belonging to
-- merged-away accounts. Their original values remain available in metadata;
-- therefore duplicate 100m starts never inflate the global account.
UPDATE "TeamFinanceTransaction" AS entry
SET
    "metadata" = COALESCE(entry."metadata", '{}'::jsonb) || jsonb_build_object(
      'globalAccountMigration', 'neutralized-duplicate-start-balance',
      'originalAmountEuro', entry."amountEuro"::text,
      'originalAccountId', entry."accountId"
    ),
    "description" = LEFT('Migration: neutralisierter früherer Startwert · ' || entry."description", 500),
    "type" = 'CORRECTION',
    "amountEuro" = 0
FROM "_GlobalFinanceAccountMap" AS account_map
WHERE entry."accountId" = account_map."oldAccountId"
  AND account_map."oldAccountId" <> account_map."survivorAccountId"
  AND entry."type" = 'START_BALANCE';

-- Consolidate potentially colliding settlement snapshots before repointing
-- their account foreign key.
CREATE TEMPORARY TABLE "_GlobalFinanceSnapshotMap" ON COMMIT DROP AS
SELECT
    snapshot."raceSettlementId",
    account_map."survivorAccountId" AS "accountId",
    MIN(snapshot."id") AS "keepSnapshotId",
    SUM(snapshot."participantCount")::INTEGER AS "participantCount"
FROM "RaceFinanceAccountSnapshot" AS snapshot
INNER JOIN "_GlobalFinanceAccountMap" AS account_map
  ON account_map."oldAccountId" = snapshot."accountId"
GROUP BY snapshot."raceSettlementId", account_map."survivorAccountId";

DELETE FROM "RaceFinanceAccountSnapshot" AS snapshot
USING "_GlobalFinanceAccountMap" AS account_map, "_GlobalFinanceSnapshotMap" AS merged
WHERE snapshot."accountId" = account_map."oldAccountId"
  AND merged."raceSettlementId" = snapshot."raceSettlementId"
  AND merged."accountId" = account_map."survivorAccountId"
  AND snapshot."id" <> merged."keepSnapshotId";

UPDATE "RaceFinanceAccountSnapshot" AS snapshot
SET
    "accountId" = merged."accountId",
    "participantCount" = merged."participantCount"
FROM "_GlobalFinanceSnapshotMap" AS merged
WHERE snapshot."id" = merged."keepSnapshotId";

UPDATE "TeamFinanceTransaction" AS entry
SET "accountId" = account_map."survivorAccountId"
FROM "_GlobalFinanceAccountMap" AS account_map
WHERE entry."accountId" = account_map."oldAccountId"
  AND account_map."oldAccountId" <> account_map."survivorAccountId";

DELETE FROM "TeamFinanceAccount" AS account
USING "_GlobalFinanceAccountMap" AS account_map
WHERE account."id" = account_map."oldAccountId"
  AND account_map."oldAccountId" <> account_map."survivorAccountId";

-- Snapshots drive percentage participation fees during later corrections.
-- Rebuild them from the merged global ledger as it stood before each snapshot.
UPDATE "RaceFinanceAccountSnapshot" AS snapshot
SET "openingBalanceEuro" = COALESCE((
    SELECT SUM(entry."amountEuro")
    FROM "TeamFinanceTransaction" AS entry
    WHERE entry."accountId" = snapshot."accountId"
      AND (
        entry."createdAt" < snapshot."createdAt"
        OR (
          entry."type" = 'START_BALANCE'
          AND entry."source" = 'AUTOMATIC'
          AND entry."sourceKey" LIKE '%:initial'
        )
      )
), 0);

-- Cached totals are projections of the immutable ledger and must be rebuilt
-- after account merging and start-balance neutralization.
UPDATE "TeamFinanceAccount" AS account
SET
    "balanceEuro" = totals."balanceEuro",
    "totalIncomeEuro" = totals."totalIncomeEuro",
    "totalExpensesEuro" = totals."totalExpensesEuro",
    "ledgerRevision" = totals."ledgerRevision",
    "lastTransactionAt" = totals."lastTransactionAt",
    "updatedAt" = CURRENT_TIMESTAMP
FROM (
    SELECT
      survivor."id" AS "accountId",
      COALESCE(SUM(entry."amountEuro"), 0) AS "balanceEuro",
      COALESCE(SUM(CASE WHEN entry."amountEuro" > 0 THEN entry."amountEuro" ELSE 0 END), 0) AS "totalIncomeEuro",
      COALESCE(SUM(CASE WHEN entry."amountEuro" < 0 THEN -entry."amountEuro" ELSE 0 END), 0) AS "totalExpensesEuro",
      COUNT(entry."id")::INTEGER AS "ledgerRevision",
      MAX(entry."createdAt") AS "lastTransactionAt"
    FROM "TeamFinanceAccount" AS survivor
    LEFT JOIN "TeamFinanceTransaction" AS entry ON entry."accountId" = survivor."id"
    GROUP BY survivor."id"
) AS totals
WHERE account."id" = totals."accountId";

DROP INDEX "TeamFinanceAccount_teamId_key";
DROP INDEX "TeamFinanceAccount_leagueId_seasonId_balanceEuro_idx";
DROP INDEX "TeamFinanceAccount_seasonId_lastTransactionAt_idx";
ALTER TABLE "TeamFinanceAccount" DROP CONSTRAINT "TeamFinanceAccount_teamId_fkey";
ALTER TABLE "TeamFinanceAccount" DROP CONSTRAINT "TeamFinanceAccount_leagueId_fkey";
ALTER TABLE "TeamFinanceAccount" DROP CONSTRAINT "TeamFinanceAccount_seasonId_fkey";
ALTER TABLE "TeamFinanceAccount" DROP COLUMN "teamId";
ALTER TABLE "TeamFinanceAccount" DROP COLUMN "leagueId";
ALTER TABLE "TeamFinanceAccount" DROP COLUMN "seasonId";
ALTER TABLE "TeamFinanceAccount" ALTER COLUMN "organizationId" SET NOT NULL;

CREATE UNIQUE INDEX "TeamFinanceAccount_organizationId_key" ON "TeamFinanceAccount"("organizationId");
CREATE INDEX "TeamFinanceAccount_balanceEuro_idx" ON "TeamFinanceAccount"("balanceEuro");
CREATE INDEX "TeamFinanceAccount_lastTransactionAt_idx" ON "TeamFinanceAccount"("lastTransactionAt");
ALTER TABLE "TeamFinanceAccount" ADD CONSTRAINT "TeamFinanceAccount_organizationId_fkey"
  FOREIGN KEY ("organizationId") REFERENCES "TeamOrganization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
