import { revalidatePath } from "next/cache";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { writeSystemAudit } from "@/lib/audit/system";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { DriverImageError } from "@/lib/storage/driver-image";
import { DriverImageStorageError, ownedDriverImagePaths, removeDriverImageFiles, uploadDriverImage } from "@/lib/storage/driver-image-storage";

export const runtime = "nodejs";

const messages: Record<string, string> = {
  DRIVER_IMAGE_STORAGE_NOT_CONFIGURED: "Der Fahrerbild-Speicher ist noch nicht konfiguriert.",
  UNSUPPORTED_DRIVER_IMAGE_TYPE: "Nur PNG, WebP und JPEG sind erlaubt.",
  INVALID_DRIVER_IMAGE_SIZE: "Diese Datei ist zu groß. Maximal 3 MB.",
  DRIVER_IMAGE_EXTENSION_MISMATCH: "Dateiendung und tatsächlicher Bildtyp stimmen nicht überein.",
  INVALID_DRIVER_IMAGE_SIGNATURE: "Die Bilddatei konnte nicht gelesen werden.",
  INVALID_DRIVER_IMAGE_DIMENSIONS: "Die Bildabmessungen sind ungültig.",
  DRIVER_IMAGE_PROCESSING_FAILED: "Die Bilddatei konnte nicht verarbeitet werden.",
  DRIVER_IMAGE_UPLOAD_FAILED: "Das Fahrerbild konnte nicht gespeichert werden.",
};

type RouteParams = { params: Promise<{ id: string }> };

function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function contextFor(request: Request, context: RouteParams) {
  if (!validOrigin(request)) return { response: Response.json({ message: "Ungültige Anfrage." }, { status: 403 }) } as const;
  const user = await getCurrentUser();
  if (!user) return { response: Response.json({ message: "Anmeldung erforderlich." }, { status: 401 }) } as const;
  const driverId = Number((await context.params).id);
  if (!Number.isInteger(driverId) || driverId <= 0) return { response: Response.json({ message: "Ungültiger Fahrer." }, { status: 400 }) } as const;
  const driver = await getPrismaClient().driver.findUnique({ where: { id: driverId }, select: { id: true, userId: true, name: true, imageUrl: true } });
  if (!driver) return { response: Response.json({ message: "Fahrer wurde nicht gefunden." }, { status: 404 }) } as const;
  if (driver.userId !== user.id && !hasPermission(user.roles, Permission.ManageMasterData)) {
    return { response: Response.json({ message: "Du darfst nur dein eigenes Fahrerbild ändern." }, { status: 403 }) } as const;
  }
  return { user, driver } as const;
}

async function refresh(driverId: number) {
  for (const path of ["/dashboard", "/drivers", "/teams", "/championship", "/admin/drivers"]) revalidatePath(path);
  revalidatePath(`/drivers/${driverId}`);
  revalidatePath(`/admin/drivers/${driverId}`);
  revalidatePath("/results/[id]", "page");
  await touchAppDataRevisionSafely(getPrismaClient(), ["drivers", "results", "championship", "teams", "users"]);
}

export async function POST(request: Request, context: RouteParams) {
  const auth = await contextFor(request, context);
  if ("response" in auth) return auth.response;
  const formData = await request.formData();
  const image = formData.get("image");
  if (!(image instanceof File)) return Response.json({ message: "Keine Bilddatei ausgewählt." }, { status: 400 });
  let upload: Awaited<ReturnType<typeof uploadDriverImage>> | null = null;
  try {
    upload = await uploadDriverImage(image, auth.driver.id);
    await getPrismaClient().$transaction(async (transaction) => {
      await transaction.driver.update({ where: { id: auth.driver.id }, data: { imageUrl: upload!.imageUrl } });
      await writeSystemAudit(transaction, { actorId: auth.user.id, action: auth.driver.imageUrl ? "DRIVER_IMAGE_REPLACED" : "DRIVER_IMAGE_UPLOADED", entityType: "Driver", entityId: auth.driver.id, metadata: { driverName: auth.driver.name } });
    });
  } catch (error: unknown) {
    if (upload) try { await removeDriverImageFiles([upload.storagePath, upload.thumbnailPath]); } catch { /* best-effort cleanup */ }
    const code = error instanceof DriverImageError || error instanceof DriverImageStorageError ? error.code : "UNKNOWN";
    console.error("[driver-image] Upload failed.", { actorId: auth.user.id, driverId: auth.driver.id, code });
    return Response.json({ message: messages[code] ?? "Das Fahrerbild konnte nicht gespeichert werden." }, { status: code === "UNKNOWN" ? 500 : 400 });
  }
  try { await removeDriverImageFiles(ownedDriverImagePaths(auth.driver.imageUrl, auth.driver.id)); } catch (error: unknown) {
    console.error("[driver-image] Previous image cleanup failed.", { actorId: auth.user.id, driverId: auth.driver.id, errorName: error instanceof Error ? error.name : "UnknownError" });
  }
  await refresh(auth.driver.id);
  return Response.json({ message: "Fahrerbild wurde gespeichert.", imageUrl: upload.imageUrl }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteParams) {
  const auth = await contextFor(request, context);
  if ("response" in auth) return auth.response;
  await getPrismaClient().$transaction(async (transaction) => {
    await transaction.driver.update({ where: { id: auth.driver.id }, data: { imageUrl: null } });
    await writeSystemAudit(transaction, { actorId: auth.user.id, action: "DRIVER_IMAGE_REMOVED", entityType: "Driver", entityId: auth.driver.id, metadata: { driverName: auth.driver.name } });
  });
  try { await removeDriverImageFiles(ownedDriverImagePaths(auth.driver.imageUrl, auth.driver.id)); } catch (error: unknown) {
    console.error("[driver-image] Removed image cleanup failed.", { actorId: auth.user.id, driverId: auth.driver.id, errorName: error instanceof Error ? error.name : "UnknownError" });
  }
  await refresh(auth.driver.id);
  return Response.json({ message: "Fahrerbild wurde entfernt.", imageUrl: null });
}
