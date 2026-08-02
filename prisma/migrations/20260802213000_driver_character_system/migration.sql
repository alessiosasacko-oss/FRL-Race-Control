CREATE TABLE "TeamSuitTemplate" (
    "id" SERIAL NOT NULL,
    "organizationId" INTEGER NOT NULL,
    "name" VARCHAR(120) NOT NULL,
    "configuration" JSONB NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "archivedAt" TIMESTAMP(3),
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TeamSuitTemplate_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DriverCharacter" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "configuration" JSONB NOT NULL,
    "normalPose" VARCHAR(32) NOT NULL DEFAULT 'NEUTRAL',
    "winnerPose" VARCHAR(32) NOT NULL DEFAULT 'FIST_UP',
    "suitVariantId" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "DriverCharacter_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "RaceResult" ADD COLUMN "characterSnapshot" JSONB;
CREATE UNIQUE INDEX "TeamSuitTemplate_organizationId_name_key" ON "TeamSuitTemplate"("organizationId", "name");
CREATE INDEX "TeamSuitTemplate_organizationId_active_displayOrder_idx" ON "TeamSuitTemplate"("organizationId", "active", "displayOrder");
CREATE INDEX "TeamSuitTemplate_archivedAt_idx" ON "TeamSuitTemplate"("archivedAt");
CREATE UNIQUE INDEX "DriverCharacter_userId_key" ON "DriverCharacter"("userId");
CREATE INDEX "DriverCharacter_suitVariantId_idx" ON "DriverCharacter"("suitVariantId");
ALTER TABLE "TeamSuitTemplate" ADD CONSTRAINT "TeamSuitTemplate_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "TeamOrganization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverCharacter" ADD CONSTRAINT "DriverCharacter_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DriverCharacter" ADD CONSTRAINT "DriverCharacter_suitVariantId_fkey" FOREIGN KEY ("suitVariantId") REFERENCES "TeamSuitTemplate"("id") ON DELETE SET NULL ON UPDATE CASCADE;
