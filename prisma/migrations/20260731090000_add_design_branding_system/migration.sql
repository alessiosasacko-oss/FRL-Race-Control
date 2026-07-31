CREATE TYPE "DesignPreset" AS ENUM (
  'FRL_RACING_BLUE',
  'MIDNIGHT_MOTORSPORT',
  'RACING_RED',
  'CHAMPIONSHIP_GOLD',
  'NEON_RACE_CONTROL',
  'CLEAN_LIGHT',
  'CUSTOM'
);

CREATE TYPE "ThemeMode" AS ENUM ('DARK', 'LIGHT', 'SYSTEM');
CREATE TYPE "DisplayDensity" AS ENUM ('COMPACT', 'STANDARD', 'COMFORTABLE');

ALTER TABLE "League" ADD COLUMN "color" CHAR(7);

ALTER TABLE "Team"
  ADD COLUMN "secondaryColor" CHAR(7),
  ADD COLUMN "contrastColor" CHAR(7),
  ADD COLUMN "logoUrl" TEXT,
  ADD COLUMN "backgroundGradient" VARCHAR(120);

ALTER TABLE "UserSettings"
  ADD COLUMN "displayDensity" "DisplayDensity" NOT NULL DEFAULT 'STANDARD',
  ADD COLUMN "reducedMotion" BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE "DesignTheme" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "preset" "DesignPreset" NOT NULL,
  "defaultMode" "ThemeMode" NOT NULL DEFAULT 'DARK',
  "allowDarkMode" BOOLEAN NOT NULL DEFAULT true,
  "allowLightMode" BOOLEAN NOT NULL DEFAULT false,
  "allowSystemMode" BOOLEAN NOT NULL DEFAULT false,
  "allowUserModeOverride" BOOLEAN NOT NULL DEFAULT false,
  "darkTokens" JSONB NOT NULL,
  "lightTokens" JSONB NOT NULL,
  "pageAccents" JSONB NOT NULL,
  "componentSettings" JSONB NOT NULL,
  "navigationSettings" JSONB NOT NULL,
  "isDraft" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT false,
  "createdById" INTEGER NOT NULL,
  "updatedById" INTEGER NOT NULL,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "DesignTheme_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "DesignThemeVersion" (
  "id" SERIAL NOT NULL,
  "themeId" INTEGER NOT NULL,
  "version" INTEGER NOT NULL,
  "snapshot" JSONB NOT NULL,
  "createdById" INTEGER NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "DesignThemeVersion_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Track" (
  "id" SERIAL NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "countryCode" CHAR(2) NOT NULL,
  "lengthKm" DOUBLE PRECISION,
  "lapCount" INTEGER,
  "totalDistanceKm" DOUBLE PRECISION,
  "sectorCount" INTEGER NOT NULL DEFAULT 3,
  "drsZones" INTEGER,
  "overtakePoints" INTEGER,
  "longestStraightM" INTEGER,
  "poleSide" VARCHAR(32),
  "pitLaneLossSeconds" DOUBLE PRECISION,
  "notes" TEXT,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Track_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "TrackVisual" (
  "id" SERIAL NOT NULL,
  "trackId" INTEGER NOT NULL,
  "layoutAsset" TEXT,
  "layoutMimeType" VARCHAR(80),
  "heroAsset" TEXT,
  "mobileHeroAsset" TEXT,
  "trackLogoAsset" TEXT,
  "primaryColor" CHAR(7) NOT NULL DEFAULT '#3B82F6',
  "secondaryColor" CHAR(7) NOT NULL DEFAULT '#22D3EE',
  "overlayStrength" INTEGER NOT NULL DEFAULT 65,
  "imagePosition" VARCHAR(32) NOT NULL DEFAULT 'center',
  "imageCrop" VARCHAR(32) NOT NULL DEFAULT 'cover',
  "lightBannerText" BOOLEAN NOT NULL DEFAULT true,
  "useThemeLayoutColor" BOOLEAN NOT NULL DEFAULT true,
  "layoutColor" CHAR(7),
  "lineWidth" INTEGER NOT NULL DEFAULT 3,
  "showStartFinish" BOOLEAN NOT NULL DEFAULT true,
  "showSectors" BOOLEAN NOT NULL DEFAULT false,
  "showDrsZones" BOOLEAN NOT NULL DEFAULT false,
  "showOvertakePoints" BOOLEAN NOT NULL DEFAULT false,
  "showCornerNumbers" BOOLEAN NOT NULL DEFAULT false,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "TrackVisual_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "Race" ADD COLUMN "trackId" INTEGER;

CREATE UNIQUE INDEX "DesignThemeVersion_themeId_version_key" ON "DesignThemeVersion"("themeId", "version");
CREATE INDEX "DesignTheme_isActive_publishedAt_idx" ON "DesignTheme"("isActive", "publishedAt");
CREATE INDEX "DesignTheme_isDraft_updatedAt_idx" ON "DesignTheme"("isDraft", "updatedAt");
CREATE INDEX "DesignTheme_createdById_idx" ON "DesignTheme"("createdById");
CREATE INDEX "DesignTheme_updatedById_idx" ON "DesignTheme"("updatedById");
CREATE INDEX "DesignThemeVersion_themeId_createdAt_idx" ON "DesignThemeVersion"("themeId", "createdAt");
CREATE INDEX "DesignThemeVersion_createdById_idx" ON "DesignThemeVersion"("createdById");
CREATE UNIQUE INDEX "Track_name_key" ON "Track"("name");
CREATE INDEX "Track_active_name_idx" ON "Track"("active", "name");
CREATE INDEX "Track_countryCode_idx" ON "Track"("countryCode");
CREATE UNIQUE INDEX "TrackVisual_trackId_key" ON "TrackVisual"("trackId");
CREATE INDEX "TrackVisual_primaryColor_idx" ON "TrackVisual"("primaryColor");
CREATE INDEX "Race_trackId_idx" ON "Race"("trackId");

ALTER TABLE "DesignTheme" ADD CONSTRAINT "DesignTheme_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignTheme" ADD CONSTRAINT "DesignTheme_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "DesignThemeVersion" ADD CONSTRAINT "DesignThemeVersion_themeId_fkey" FOREIGN KEY ("themeId") REFERENCES "DesignTheme"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "DesignThemeVersion" ADD CONSTRAINT "DesignThemeVersion_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "TrackVisual" ADD CONSTRAINT "TrackVisual_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Race" ADD CONSTRAINT "Race_trackId_fkey" FOREIGN KEY ("trackId") REFERENCES "Track"("id") ON DELETE SET NULL ON UPDATE CASCADE;
