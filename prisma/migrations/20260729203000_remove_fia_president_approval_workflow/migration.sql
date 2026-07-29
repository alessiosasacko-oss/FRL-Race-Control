ALTER TYPE "PenaltyProposalStatus" ADD VALUE 'CLOSED';
ALTER TYPE "PenaltyProposalStatus" ADD VALUE 'CANCELLED';

CREATE TYPE "DecisionOutcome" AS ENUM (
    'NO_FURTHER_INVESTIGATION',
    'NO_OFFENSE',
    'WARNING',
    'PENALTY',
    'RACING_INCIDENT',
    'INADMISSIBLE',
    'WITHDRAWN'
);

ALTER TABLE "PenaltyProposal"
DROP CONSTRAINT IF EXISTS "PenaltyProposal_review_state_check";

UPDATE "PenaltyProposal"
SET "status" = 'CLOSED'
WHERE "status" IN ('AWAITING_APPROVAL', 'CHANGES_REQUESTED');

ALTER TABLE "PenaltyProposal"
ADD CONSTRAINT "PenaltyProposal_review_state_check"
CHECK (
    (
        "status" IN ('OPEN', 'CLOSED', 'CANCELLED', 'AWAITING_APPROVAL')
    )
    OR (
        "status" IN ('APPROVED', 'REJECTED', 'CHANGES_REQUESTED')
        AND "reviewedAt" IS NOT NULL
        AND "reviewedByUserId" IS NOT NULL
    )
);

ALTER TABLE "Decision"
ADD COLUMN "outcome" "DecisionOutcome" NOT NULL DEFAULT 'PENALTY';

UPDATE "Decision"
SET "outcome" = CASE
    WHEN "penaltyType" = 'NO_FURTHER_ACTION'
        THEN 'NO_FURTHER_INVESTIGATION'::"DecisionOutcome"
    WHEN "penaltyType" = 'WARNING'
        THEN 'WARNING'::"DecisionOutcome"
    ELSE 'PENALTY'::"DecisionOutcome"
END;

CREATE INDEX "Decision_outcome_decidedAt_idx"
ON "Decision"("outcome", "decidedAt");

CREATE TABLE "DecisionPenalty" (
    "id" SERIAL NOT NULL,
    "decisionId" INTEGER NOT NULL,
    "penaltyType" "PenaltyType" NOT NULL,
    "penaltyValue" DOUBLE PRECISION,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DecisionPenalty_pkey" PRIMARY KEY ("id")
);

INSERT INTO "DecisionPenalty" (
    "decisionId",
    "penaltyType",
    "penaltyValue"
)
SELECT
    "id",
    "penaltyType",
    "penaltyValue"
FROM "Decision"
WHERE "penaltyType" <> 'NO_FURTHER_ACTION';

CREATE UNIQUE INDEX "DecisionPenalty_decisionId_penaltyType_key"
ON "DecisionPenalty"("decisionId", "penaltyType");

CREATE INDEX "DecisionPenalty_penaltyType_idx"
ON "DecisionPenalty"("penaltyType");

ALTER TABLE "DecisionPenalty"
ADD CONSTRAINT "DecisionPenalty_decisionId_fkey"
FOREIGN KEY ("decisionId") REFERENCES "Decision"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
