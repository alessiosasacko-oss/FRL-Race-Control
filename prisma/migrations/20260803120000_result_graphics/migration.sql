CREATE TYPE "ResultGraphicType" AS ENUM ('QUALIFYING_CLASSIFICATION', 'RACE_CLASSIFICATION', 'DRIVER_CHAMPIONSHIP', 'CONSTRUCTOR_CHAMPIONSHIP');
CREATE TYPE "GraphicRenderStatus" AS ENUM ('PENDING', 'RENDERING', 'COMPLETED', 'FAILED');

CREATE TABLE "ResultGraphic" (
  "id" SERIAL NOT NULL,
  "type" "ResultGraphicType" NOT NULL,
  "leagueId" INTEGER NOT NULL,
  "raceId" INTEGER NOT NULL,
  "resultSessionId" INTEGER,
  "version" INTEGER NOT NULL DEFAULT 1,
  "renderingVersion" INTEGER NOT NULL DEFAULT 1,
  "renderStatus" "GraphicRenderStatus" NOT NULL DEFAULT 'PENDING',
  "storagePath" TEXT,
  "publicUrl" TEXT,
  "checksum" VARCHAR(64),
  "width" INTEGER NOT NULL DEFAULT 1920,
  "height" INTEGER NOT NULL DEFAULT 1080,
  "generatedAt" TIMESTAMP(3),
  "errorMessage" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "ResultGraphic_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "ResultGraphic_type_leagueId_raceId_version_key" ON "ResultGraphic"("type", "leagueId", "raceId", "version");
CREATE INDEX "ResultGraphic_renderStatus_createdAt_idx" ON "ResultGraphic"("renderStatus", "createdAt");
CREATE INDEX "ResultGraphic_resultSessionId_type_idx" ON "ResultGraphic"("resultSessionId", "type");
CREATE INDEX "ResultGraphic_leagueId_raceId_type_idx" ON "ResultGraphic"("leagueId", "raceId", "type");
ALTER TABLE "ResultGraphic" ADD CONSTRAINT "ResultGraphic_leagueId_fkey" FOREIGN KEY ("leagueId") REFERENCES "League"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultGraphic" ADD CONSTRAINT "ResultGraphic_raceId_fkey" FOREIGN KEY ("raceId") REFERENCES "Race"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "ResultGraphic" ADD CONSTRAINT "ResultGraphic_resultSessionId_fkey" FOREIGN KEY ("resultSessionId") REFERENCES "RaceResultSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
