import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { BackgroundImageError } from "@/lib/storage/background-image";
import { uploadBackgroundImage } from "@/lib/storage/background-storage";

export const runtime = "nodejs";

const safeMessages: Record<string, string> = {
  UNSUPPORTED_BACKGROUND_TYPE: "Erlaubt sind JPG, JPEG, PNG und WebP.",
  INVALID_BACKGROUND_SIZE: "Die Datei muss zwischen 1 Byte und 10 MB groß sein.",
  BACKGROUND_EXTENSION_MISMATCH: "Dateiendung und Bildformat stimmen nicht überein.",
  INVALID_BACKGROUND_SIGNATURE: "Der tatsächliche Bildinhalt ist ungültig.",
  INVALID_BACKGROUND_DIMENSIONS: "Das Bild muss zwischen 320 × 320 und 10.000 × 10.000 Pixel groß sein.",
};

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Ungültige Anfrage." }, { status: 403 });
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Anmeldung erforderlich." }, { status: 401 });
  if (!hasPermission(user.roles, Permission.ManageBranding)) return Response.json({ message: "Keine Berechtigung." }, { status: 403 });

  const formData = await request.formData();
  const image = formData.get("image");
  const rawThemeId = Number(formData.get("themeId"));
  const themeId = Number.isInteger(rawThemeId) && rawThemeId > 0 ? rawThemeId : null;
  if (!(image instanceof File)) return Response.json({ message: "Keine Bilddatei ausgewählt." }, { status: 400 });
  try {
    return Response.json(await uploadBackgroundImage(image, themeId), { status: 201 });
  } catch (error: unknown) {
    const code = error instanceof BackgroundImageError ? error.code : error instanceof Error ? error.message : "UNKNOWN";
    console.error("[design-background] Upload failed.", { actorId: user.id, code });
    return Response.json({ message: safeMessages[code] ?? "Das Hintergrundbild konnte nicht gespeichert werden." }, { status: code in safeMessages ? 400 : 500 });
  }
}
