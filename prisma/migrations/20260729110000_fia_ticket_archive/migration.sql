ALTER TYPE "TicketAuditAction" ADD VALUE IF NOT EXISTS 'ARCHIVED';
ALTER TYPE "TicketAuditAction" ADD VALUE IF NOT EXISTS 'RESTORED';

ALTER TABLE "FiaTicket"
ADD COLUMN "archivedAt" TIMESTAMP(3),
ADD COLUMN "archivedById" INTEGER;

ALTER TABLE "FiaTicket"
ADD CONSTRAINT "FiaTicket_archivedById_fkey"
FOREIGN KEY ("archivedById") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "FiaTicket_archivedAt_idx"
ON "FiaTicket"("archivedAt");

CREATE INDEX "FiaTicket_archivedById_idx"
ON "FiaTicket"("archivedById");
