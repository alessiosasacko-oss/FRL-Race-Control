ALTER TABLE "Decision"
ADD COLUMN "affectedDriverId" INTEGER;

CREATE INDEX "Decision_affectedDriverId_idx"
ON "Decision"("affectedDriverId");

ALTER TABLE "Decision"
ADD CONSTRAINT "Decision_affectedDriverId_fkey"
FOREIGN KEY ("affectedDriverId") REFERENCES "Driver"("id")
ON DELETE RESTRICT ON UPDATE CASCADE;
