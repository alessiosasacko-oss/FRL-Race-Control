ALTER TABLE "FiaTicket"
ADD COLUMN "submissionKey" VARCHAR(36);

CREATE UNIQUE INDEX "FiaTicket_submissionKey_key"
ON "FiaTicket"("submissionKey");
