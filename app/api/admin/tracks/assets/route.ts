import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import {
  BrandingStorageError,
  uploadBrandingAsset,
} from "@/lib/storage/branding-storage";

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
  if (!hasPermission(user.roles, Permission.ManageBranding)) {
    return Response.json({ message: "Keine Berechtigung." }, { status: 403 });
  }

  const formData = await request.formData();
  const asset = formData.get("asset");
  if (!(asset instanceof File)) {
    return Response.json({ message: "Keine Datei ausgewählt." }, { status: 400 });
  }

  try {
    const url = await uploadBrandingAsset(asset);
    return Response.json({ url });
  } catch (error: unknown) {
    const code = error instanceof BrandingStorageError ? error.code : "UNKNOWN";
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
