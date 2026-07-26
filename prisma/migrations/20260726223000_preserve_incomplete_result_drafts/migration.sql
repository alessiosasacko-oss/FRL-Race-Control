ALTER TABLE "RaceResultSession"
ADD COLUMN "draftPayload" JSONB;

ALTER TABLE "RaceResult"
ADD COLUMN "baseStatus" "ResultStatus";

-- Preserve the original status semantics for every historical result.
UPDATE "RaceResult"
SET "baseStatus" = "status";

ALTER TABLE "RaceResult"
ALTER COLUMN "baseStatus" SET NOT NULL;
