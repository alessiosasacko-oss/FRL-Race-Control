-- Extend the existing Discord channel map for qualifying graphics.
ALTER TYPE "DiscordChannelPurpose" ADD VALUE IF NOT EXISTS 'QUALIFYING_RESULTS';

-- Link deliveries to the immutable rendered graphic version without changing
-- or removing any existing queue records.
ALTER TABLE "DiscordDelivery"
ADD COLUMN "resultGraphicId" INTEGER,
ADD COLUMN "renderingVersion" INTEGER;

ALTER TABLE "DiscordDelivery"
ADD CONSTRAINT "DiscordDelivery_resultGraphicId_fkey"
FOREIGN KEY ("resultGraphicId") REFERENCES "ResultGraphic"("id")
ON DELETE SET NULL ON UPDATE CASCADE;

CREATE INDEX "DiscordDelivery_resultGraphicId_renderingVersion_idx"
ON "DiscordDelivery"("resultGraphicId", "renderingVersion");
