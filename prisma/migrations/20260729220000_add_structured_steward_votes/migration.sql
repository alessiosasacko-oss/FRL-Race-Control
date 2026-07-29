CREATE TYPE "ProposalKind" AS ENUM ('PENALTY', 'GENERAL');

ALTER TABLE "PenaltyProposal"
ADD COLUMN "kind" "ProposalKind" NOT NULL DEFAULT 'PENALTY',
ADD COLUMN "title" VARCHAR(160) NOT NULL DEFAULT 'Strafenvorschlag',
ADD COLUMN "proposedOutcome" "DecisionOutcome" NOT NULL DEFAULT 'PENALTY';

UPDATE "PenaltyProposal"
SET "title" = 'Strafenvorschlag #' || "id";
