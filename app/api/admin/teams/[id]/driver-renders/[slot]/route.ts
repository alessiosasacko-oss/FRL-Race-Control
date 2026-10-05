import { getPrismaClient } from "@/lib/db/prisma";
import { writeSystemAudit } from "@/lib/audit/system";
import { refreshTeamRenders, teamRenderAdminContext } from "@/lib/graphics/team-render-admin";
import { DriverImageError, DRIVER_IMAGE_MAX_BYTES } from "@/lib/storage/driver-image";
import { DriverImageStorageError, ownedTeamDriverRenderPaths, removeDriverImageFiles, uploadTeamDriverRender } from "@/lib/storage/driver-image-storage";

export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; slot: string }> };

async function mutate(request: Request, context: Context, remove: boolean) {
  const { id, slot: rawSlot } = await context.params;
  const auth = await teamRenderAdminContext(request, id);
  if ("response" in auth) return auth.response;
  if (rawSlot !== "1" && rawSlot !== "2") return Response.json({ message: "Ungültiger Fahrer-Slot." }, { status: 400 });
  const slot = rawSlot === "1" ? 1 : 2;
  const field = slot === 1 ? "driverOneGraphicImageUrl" : "driverTwoGraphicImageUrl";
  const previous = auth.team[field];
  let upload: Awaited<ReturnType<typeof uploadTeamDriverRender>> | null = null;
  try {
    if (!remove) {
      if (Number(request.headers.get("content-length")) > DRIVER_IMAGE_MAX_BYTES + 65536) return Response.json({ message: "Maximal 3 MB pro Bild." }, { status: 413 });
      const form = await request.formData();
      const image = form.get("image");
      if (!(image instanceof File)) return Response.json({ message: "Bitte ein Bild auswählen." }, { status: 400 });
      upload = await uploadTeamDriverRender(image, auth.team.id, slot);
    }
    await getPrismaClient().$transaction(async (transaction) => {
      const changed = await transaction.teamOrganization.updateMany({
        where: { id: auth.team.id, active: true, archivedAt: null, [field]: previous },
        data: { [field]: upload?.imageUrl ?? null },
      });
      if (changed.count !== 1) throw new Error("TEAM_RENDER_CONFLICT");
      await writeSystemAudit(transaction, { actorId: auth.user.id, action: remove ? "TEAM_DRIVER_RENDER_REMOVED" : "TEAM_DRIVER_RENDER_SAVED", entityType: "TeamOrganization", entityId: auth.team.id, metadata: { slot } });
    });
  } catch (error: unknown) {
    if (upload) await removeDriverImageFiles([upload.storagePath, upload.thumbnailPath]).catch(() => undefined);
    const conflict = error instanceof Error && error.message === "TEAM_RENDER_CONFLICT";
    const invalid = error instanceof DriverImageError;
    console.error("[team-render] Save failed", { organizationId: auth.team.id, slot, errorName: error instanceof Error ? error.name : "UnknownError", code: error instanceof DriverImageStorageError || invalid ? error.code : undefined });
    return Response.json({ message: conflict ? "Team wurde zwischenzeitlich geändert. Bitte neu laden." : invalid ? "Ungültiges Bild. PNG, JPEG oder WebP, maximal 3 MB und 10000 × 10000 Pixel." : "Bild konnte nicht gespeichert werden. Bitte die Storage-Konfiguration prüfen." }, { status: conflict ? 409 : invalid ? 400 : 500 });
  }
  await removeDriverImageFiles(ownedTeamDriverRenderPaths(previous, auth.team.id, slot)).catch(() => undefined);
  await refreshTeamRenders();
  return Response.json({ imageUrl: upload?.imageUrl ?? null, message: remove ? "Renderbild entfernt." : "Renderbild gespeichert." }, { status: remove ? 200 : 201 });
}

export async function POST(request: Request, context: Context) { return mutate(request, context, false); }
export async function DELETE(request: Request, context: Context) { return mutate(request, context, true); }
