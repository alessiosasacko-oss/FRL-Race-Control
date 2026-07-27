ALTER TYPE "PenaltyType" ADD VALUE 'PENALTY_POINTS';
ALTER TYPE "PenaltyType" ADD VALUE 'QUALIFYING_BAN';
ALTER TYPE "PenaltyType" ADD VALUE 'RACE_BAN';
ALTER TYPE "PenaltyType" ADD VALUE 'SEASON_BAN';

ALTER TYPE "TicketAuditAction" ADD VALUE 'PROPOSAL_CREATED';
ALTER TYPE "TicketAuditAction" ADD VALUE 'PROPOSAL_VOTE_RECORDED';
ALTER TYPE "TicketAuditAction" ADD VALUE 'PROPOSAL_CLOSED';
ALTER TYPE "TicketAuditAction" ADD VALUE 'PROPOSAL_REVIEWED';

CREATE TYPE "DiscussionMessageType" AS ENUM (
    'NORMAL',
    'SYSTEM',
    'PENALTY_PROPOSAL'
);

CREATE TYPE "PenaltyProposalStatus" AS ENUM (
    'OPEN',
    'AWAITING_APPROVAL',
    'APPROVED',
    'REJECTED',
    'CHANGES_REQUESTED'
);

CREATE TYPE "ProposalVoteChoice" AS ENUM (
    'FOR',
    'AGAINST',
    'ABSTAIN'
);

ALTER TABLE "DiscussionMessage"
ADD COLUMN "type" "DiscussionMessageType" NOT NULL DEFAULT 'NORMAL',
ADD COLUMN "eventKey" VARCHAR(190);

CREATE UNIQUE INDEX "DiscussionMessage_eventKey_key"
ON "DiscussionMessage"("eventKey");

CREATE INDEX "DiscussionMessage_ticketId_type_createdAt_idx"
ON "DiscussionMessage"("ticketId", "type", "createdAt");

CREATE TABLE "PenaltyProposal" (
    "id" SERIAL NOT NULL,
    "ticketId" INTEGER NOT NULL,
    "messageId" INTEGER NOT NULL,
    "creatorId" INTEGER NOT NULL,
    "affectedDriverId" INTEGER NOT NULL,
    "supersedesId" INTEGER,
    "penaltyType" "PenaltyType" NOT NULL,
    "penaltyValue" DOUBLE PRECISION,
    "reason" TEXT NOT NULL,
    "closesAt" TIMESTAMP(3),
    "closeWhenAllVoted" BOOLEAN NOT NULL DEFAULT false,
    "status" "PenaltyProposalStatus" NOT NULL DEFAULT 'OPEN',
    "revision" INTEGER NOT NULL DEFAULT 1,
    "closedAt" TIMESTAMP(3),
    "closedByUserId" INTEGER,
    "reviewedAt" TIMESTAMP(3),
    "reviewedByUserId" INTEGER,
    "reviewReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PenaltyProposal_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "PenaltyProposal_revision_check" CHECK ("revision" > 0),
    CONSTRAINT "PenaltyProposal_penaltyValue_check"
        CHECK ("penaltyValue" IS NULL OR "penaltyValue" >= 0),
    CONSTRAINT "PenaltyProposal_review_state_check"
        CHECK (
            (
                "status" IN ('OPEN', 'AWAITING_APPROVAL')
                AND "reviewedAt" IS NULL
                AND "reviewedByUserId" IS NULL
            )
            OR (
                "status" IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')
                AND "reviewedAt" IS NOT NULL
                AND "reviewedByUserId" IS NOT NULL
            )
        )
);

CREATE UNIQUE INDEX "PenaltyProposal_messageId_key"
ON "PenaltyProposal"("messageId");

CREATE INDEX "PenaltyProposal_ticketId_createdAt_idx"
ON "PenaltyProposal"("ticketId", "createdAt");

CREATE INDEX "PenaltyProposal_ticketId_status_idx"
ON "PenaltyProposal"("ticketId", "status");

CREATE INDEX "PenaltyProposal_affectedDriverId_status_idx"
ON "PenaltyProposal"("affectedDriverId", "status");

CREATE INDEX "PenaltyProposal_creatorId_createdAt_idx"
ON "PenaltyProposal"("creatorId", "createdAt");

CREATE INDEX "PenaltyProposal_closedByUserId_idx"
ON "PenaltyProposal"("closedByUserId");

CREATE INDEX "PenaltyProposal_reviewedByUserId_idx"
ON "PenaltyProposal"("reviewedByUserId");

CREATE INDEX "PenaltyProposal_supersedesId_idx"
ON "PenaltyProposal"("supersedesId");

ALTER TABLE "Vote"
ADD COLUMN "proposalId" INTEGER,
ADD COLUMN "choice" "ProposalVoteChoice";

ALTER TABLE "Vote"
ALTER COLUMN "penaltyType" DROP NOT NULL,
ALTER COLUMN "reason" DROP NOT NULL;

DROP INDEX "Vote_ticketId_voterId_key";

CREATE UNIQUE INDEX "Vote_proposalId_voterId_key"
ON "Vote"("proposalId", "voterId");

CREATE UNIQUE INDEX "Vote_legacy_ticketId_voterId_key"
ON "Vote"("ticketId", "voterId")
WHERE "proposalId" IS NULL;

CREATE INDEX "Vote_proposalId_choice_idx"
ON "Vote"("proposalId", "choice");

ALTER TABLE "Vote"
ADD CONSTRAINT "Vote_payload_shape_check"
CHECK (
    (
        "proposalId" IS NULL
        AND "choice" IS NULL
        AND "penaltyType" IS NOT NULL
        AND "reason" IS NOT NULL
    )
    OR (
        "proposalId" IS NOT NULL
        AND "choice" IS NOT NULL
    )
);

CREATE TABLE "VoteChange" (
    "id" SERIAL NOT NULL,
    "voteId" INTEGER NOT NULL,
    "changedByUserId" INTEGER NOT NULL,
    "fromChoice" "ProposalVoteChoice",
    "toChoice" "ProposalVoteChoice" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "VoteChange_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "VoteChange_voteId_createdAt_idx"
ON "VoteChange"("voteId", "createdAt");

CREATE INDEX "VoteChange_changedByUserId_createdAt_idx"
ON "VoteChange"("changedByUserId", "createdAt");

CREATE TABLE "PenaltyProposalEvidence" (
    "proposalId" INTEGER NOT NULL,
    "evidenceId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PenaltyProposalEvidence_pkey"
        PRIMARY KEY ("proposalId", "evidenceId")
);

CREATE INDEX "PenaltyProposalEvidence_evidenceId_proposalId_idx"
ON "PenaltyProposalEvidence"("evidenceId", "proposalId");

ALTER TABLE "Decision"
ADD COLUMN "proposalId" INTEGER;

CREATE UNIQUE INDEX "Decision_proposalId_key"
ON "Decision"("proposalId");

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_ticketId_fkey"
FOREIGN KEY ("ticketId") REFERENCES "FiaTicket"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_messageId_fkey"
FOREIGN KEY ("messageId") REFERENCES "DiscussionMessage"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_creatorId_fkey"
FOREIGN KEY ("creatorId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_affectedDriverId_fkey"
FOREIGN KEY ("affectedDriverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_supersedesId_fkey"
FOREIGN KEY ("supersedesId") REFERENCES "PenaltyProposal"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_closedByUserId_fkey"
FOREIGN KEY ("closedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_reviewedByUserId_fkey"
FOREIGN KEY ("reviewedByUserId") REFERENCES "User"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Vote"
ADD CONSTRAINT "Vote_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "PenaltyProposal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoteChange"
ADD CONSTRAINT "VoteChange_voteId_fkey"
FOREIGN KEY ("voteId") REFERENCES "Vote"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "VoteChange"
ADD CONSTRAINT "VoteChange_changedByUserId_fkey"
FOREIGN KEY ("changedByUserId") REFERENCES "User"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposalEvidence"
ADD CONSTRAINT "PenaltyProposalEvidence_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "PenaltyProposal"("id")
ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "PenaltyProposalEvidence"
ADD CONSTRAINT "PenaltyProposalEvidence_evidenceId_fkey"
FOREIGN KEY ("evidenceId") REFERENCES "Evidence"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Decision"
ADD CONSTRAINT "Decision_proposalId_fkey"
FOREIGN KEY ("proposalId") REFERENCES "PenaltyProposal"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
