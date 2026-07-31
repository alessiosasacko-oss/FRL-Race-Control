-- The former DRS value is intentionally not copied: SM Straight Mode is a
-- separate FRL concept and legacy data must not be guessed.
ALTER TABLE "Track" ADD COLUMN "smStraightModeZones" INTEGER;

ALTER TABLE "Track"
ADD CONSTRAINT "Track_smStraightModeZones_check"
CHECK ("smStraightModeZones" IS NULL OR ("smStraightModeZones" >= 0 AND "smStraightModeZones" <= 20));
