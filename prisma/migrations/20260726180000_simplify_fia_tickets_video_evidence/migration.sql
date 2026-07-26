-- Preserve the legacy FiaTicket.corner column and PRACTICE enum value so
-- historical tickets remain readable. New FIA input no longer writes them.

DROP INDEX "FiaTicket_status_priority_createdAt_idx";

ALTER TABLE "FiaTicket"
DROP COLUMN "priority";

DROP TYPE "TicketPriority";

ALTER TYPE "TicketAuditAction"
ADD VALUE 'EVIDENCE_REMOVED';

ALTER TABLE "Evidence"
ALTER COLUMN "url" DROP NOT NULL,
ADD COLUMN "storagePath" VARCHAR(500),
ADD COLUMN "originalFilename" VARCHAR(255),
ADD COLUMN "mimeType" VARCHAR(120),
ADD COLUMN "fileSize" INTEGER;

CREATE INDEX "FiaTicket_status_createdAt_idx"
ON "FiaTicket"("status", "createdAt");

CREATE UNIQUE INDEX "Evidence_storagePath_key"
ON "Evidence"("storagePath");

CREATE TABLE "EvidenceStorageCleanup" (
    "id" SERIAL NOT NULL,
    "storagePath" VARCHAR(500) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EvidenceStorageCleanup_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceStorageCleanup_storagePath_key"
ON "EvidenceStorageCleanup"("storagePath");

CREATE INDEX "EvidenceStorageCleanup_createdAt_idx"
ON "EvidenceStorageCleanup"("createdAt");

CREATE FUNCTION "queueEvidenceStorageCleanup"()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF OLD."storagePath" IS NOT NULL THEN
    INSERT INTO "EvidenceStorageCleanup" ("storagePath")
    VALUES (OLD."storagePath")
    ON CONFLICT ("storagePath") DO UPDATE
    SET "updatedAt" = CURRENT_TIMESTAMP;
  END IF;
  RETURN OLD;
END;
$$;

CREATE TRIGGER "Evidence_queue_storage_cleanup"
AFTER DELETE ON "Evidence"
FOR EACH ROW
EXECUTE FUNCTION "queueEvidenceStorageCleanup"();
