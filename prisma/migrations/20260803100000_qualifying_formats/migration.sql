-- Manual qualifying format selection. Existing qualifying sessions remain NULL
-- so an administrator must make the first deliberate selection.
CREATE TYPE "QualifyingFormat" AS ENUM ('FULL', 'SHORT');

ALTER TABLE "RaceResultSession"
  ADD COLUMN "qualifyingFormat" "QualifyingFormat",
  ADD COLUMN "lastPublicationKey" VARCHAR(190);

CREATE UNIQUE INDEX "RaceResultSession_lastPublicationKey_key"
  ON "RaceResultSession"("lastPublicationKey");

ALTER TABLE "RaceResult"
  ADD COLUMN "qualifyingTimeMs" INTEGER,
  ADD COLUMN "qualifyingLaps" INTEGER,
  ADD COLUMN "q1TimeMs" INTEGER,
  ADD COLUMN "q1Laps" INTEGER,
  ADD COLUMN "q2TimeMs" INTEGER,
  ADD COLUMN "q2Laps" INTEGER,
  ADD COLUMN "q3TimeMs" INTEGER,
  ADD COLUMN "q3Laps" INTEGER,
  ADD COLUMN "tireCompound" VARCHAR(32);
