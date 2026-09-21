import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  BrandingStorageError,
  uploadBrandingAsset,
} from "@/lib/storage/branding-storage";
import { RaceHeroImageError, type RaceHeroVariant } from "@/lib/storage/race-hero-image";
import { RaceHeroStorageError, uploadRaceHero } from "@/lib/storage/race-hero-storage";

export const runtime = "nodejs";

const safeMessages: Record<string, string> = {
  BRANDING_STORAGE_NOT_CONFIGURED:
    "Der Branding-Speicher ist noch nicht konfiguriert.",
  UNSUPPORTED_ASSET_TYPE: "Erlaubt sind SVG, PNG und WebP.",
  INVALID_ASSET_SIZE: "Die Datei muss zwischen 1 Byte und 4 MB groß sein.",
  INVALID_PNG_SIGNATURE: "Die PNG-Datei ist ungültig.",
  INVALID_WEBP_SIGNATURE: "Die WebP-Datei ist ungültig.",
  UNSAFE_SVG: "Das SVG enthält nicht erlaubte aktive oder externe Inhalte.",
  BRANDING_ASSET_UPLOAD_FAILED: "Das Asset konnte nicht gespeichert werden.",
  RACE_HERO_STORAGE_NOT_CONFIGURED: "Der Bildspeicher ist noch nicht konfiguriert.",
  UNSUPPORTED_RACE_HERO_TYPE: "Erlaubt sind JPG, PNG und WebP.",
  INVALID_RACE_HERO_SIZE: "Das Bild muss zwischen 1 Byte und 10 MB groß sein.",
  RACE_HERO_EXTENSION_MISMATCH: "Dateiendung und Bildformat passen nicht zusammen.",
  INVALID_RACE_HERO_SIGNATURE: "Die Bilddatei ist ungültig.",
  INVALID_RACE_HERO_DIMENSIONS: "Die Bildabmessungen konnten nicht gelesen werden.",
  INVALID_DESKTOP_HERO_DIMENSIONS: "Desktop-Bilder benötigen mindestens 1280 × 640 Pixel.",
  INVALID_MOBILE_HERO_DIMENSIONS: "Mobile Bilder benötigen mindestens 720 × 900 Pixel.",
  INVALID_DESKTOP_HERO_RATIO: "Desktop-Bilder müssen ein breites Querformat besitzen.",
  INVALID_MOBILE_HERO_RATIO: "Mobile Bilder müssen Hochformat oder nahezu quadratisch sein.",
  RACE_HERO_PROCESSING_FAILED: "Das Bild konnte nicht verarbeitet werden.",
  RACE_HERO_UPLOAD_FAILED: "Das Bild konnte nicht gespeichert werden.",
};

export async function POST(request: Request) {
  const requestOrigin = request.headers.get("origin");
  if (requestOrigin && requestOrigin !== new URL(request.url).origin) {
    return Response.json({ message: "Ungültige Anfrage." }, { status: 403 });
  }

  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ message: "Anmeldung erforderlich." }, { status: 401 });
  }

  const formData = await request.formData();
  const asset = formData.get("asset");
  const kind = formData.get("kind");
  const isRaceHero = kind === "desktop" || kind === "mobile";
  const canUpload = hasPermission(user.roles, Permission.ManageBranding) ||
    (isRaceHero && hasPermission(user.roles, Permission.ManageMasterData));
  if (!canUpload) {
    return Response.json({ message: "Keine Berechtigung." }, { status: 403 });
  }
  if (!(asset instanceof File)) {
    return Response.json({ message: "Keine Datei ausgewählt." }, { status: 400 });
  }

  try {
    if (isRaceHero) {
      const uploaded = await uploadRaceHero(asset, kind satisfies RaceHeroVariant);
      return Response.json(uploaded);
    }
    const url = await uploadBrandingAsset(asset);
    return Response.json({ url });
  } catch (error: unknown) {
    const code = error instanceof BrandingStorageError || error instanceof RaceHeroImageError || error instanceof RaceHeroStorageError
      ? error.code
      : "UNKNOWN";
    console.error("[branding-storage] Track asset upload failed.", {
      code,
      actorId: user.id,
    });
    return Response.json(
      { message: safeMessages[code] ?? "Das Asset konnte nicht hochgeladen werden." },
      { status: code === "UNKNOWN" ? 500 : 400 },
    );
  }
}
