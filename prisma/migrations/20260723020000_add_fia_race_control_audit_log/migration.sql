-- Persist an immutable, chronological history for every FIA ticket.
CREATE TYPE "TicketAuditAction" AS ENUM (
    'CREATED',
    'STATUS_CHANGED',
    'EVIDENCE_ADDED',
    'DISCUSSION_MESSAGE_ADDED',
    'VOTE_RECORDED',
    'DECISION_PUBLISHED'
);

CREATE TABLE "FiaTicketAuditLog" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "actorId" INTEGER,
    "action" "TicketAuditAction" NOT NULL,
    "fromStatus" "TicketStatus",
    "toStatus" "TicketStatus",
    "details" VARCHAR(1000) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FiaTicketAuditLog_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "FiaTicketAuditLog_ticketId_createdAt_idx"
ON "FiaTicketAuditLog"("ticketId", "createdAt");

CREATE INDEX "FiaTicketAuditLog_actorId_idx"
ON "FiaTicketAuditLog"("actorId");

CREATE INDEX "FiaTicketAuditLog_action_createdAt_idx"
ON "FiaTicketAuditLog"("action", "createdAt");

ALTER TABLE "FiaTicketAuditLog"
ADD CONSTRAINT "FiaTicketAuditLog_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "FiaTicketAuditLog"
ADD CONSTRAINT "FiaTicketAuditLog_actorId_fkey"
FOREIGN KEY ("actorId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "FiaTicketAuditLog" (
    "ticketId",
    "actorId",
    "action",
    "fromStatus",
    "toStatus",
    "details",
    "createdAt",
    "updatedAt"
)
SELECT
    "id",
    "reportedByUserId",
    'CREATED'::"TicketAuditAction",
    NULL,
    'OPEN'::"TicketStatus",
    'Ticket erstellt',
    "createdAt",
    "createdAt"
FROM "FiaTicket";
