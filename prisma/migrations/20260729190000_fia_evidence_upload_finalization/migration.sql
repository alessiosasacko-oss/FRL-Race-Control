CREATE TYPE "EvidenceUploadStatus" AS ENUM (
  'PREPARED',
  'FINALIZING',
  'COMPLETED',
  'FAILED',
  'ORPHANED'
);

CREATE TABLE "EvidenceUpload" (
  "id" UUID NOT NULL,
  "userId" INTEGER NOT NULL,
  "ticketId" INTEGER,
  "evidenceId" INTEGER,
  "submissionKey" VARCHAR(36),
  "storagePath" VARCHAR(500) NOT NULL,
  "originalFilename" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "fileSize" INTEGER NOT NULL,
  "label" VARCHAR(160),
  "status" "EvidenceUploadStatus" NOT NULL DEFAULT 'PREPARED',
  "failureCode" VARCHAR(80),
  "uploadedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EvidenceUpload_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "EvidenceUpload_evidenceId_key"
ON "EvidenceUpload"("evidenceId");

CREATE UNIQUE INDEX "EvidenceUpload_storagePath_key"
ON "EvidenceUpload"("storagePath");

CREATE INDEX "EvidenceUpload_userId_status_idx"
ON "EvidenceUpload"("userId", "status");

CREATE INDEX "EvidenceUpload_submissionKey_status_idx"
ON "EvidenceUpload"("submissionKey", "status");

CREATE INDEX "EvidenceUpload_ticketId_status_idx"
ON "EvidenceUpload"("ticketId", "status");

CREATE INDEX "EvidenceUpload_expiresAt_status_idx"
ON "EvidenceUpload"("expiresAt", "status");

ALTER TABLE "EvidenceUpload"
ADD CONSTRAINT "EvidenceUpload_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "EvidenceUpload"
ADD CONSTRAINT "EvidenceUpload_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "EvidenceUpload"
ADD CONSTRAINT "EvidenceUpload_evidenceId_fkey"
FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id")
ON DELETE SET NULL ON UPDATE CASCADE;
