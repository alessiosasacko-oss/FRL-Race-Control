-- Track visuals keep the existing heroAsset/mobileHeroAsset columns as reusable
-- defaults. Only the optional accessible description is new.
ALTER TABLE "TrackVisual" ADD COLUMN "heroAltText" VARCHAR(300);

-- A race can override either responsive track default independently.
CREATE TABLE "RaceVisual" (
    "id" SERIAL NOT NULL,
    "raceId" INTEGER NOT NULL,
    "desktopHeroAsset" TEXT,
    "mobileHeroAsset" TEXT,
    "heroAltText" VARCHAR(300),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RaceVisual_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "RaceVisual_raceId_key" ON "RaceVisual"("raceId");

ALTER TABLE "RaceVisual"
ADD CONSTRAINT "RaceVisual_raceId_fkey"
FOREIGN KEY ("raceId") REFERENCES "Race"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
