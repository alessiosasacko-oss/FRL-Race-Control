import { revalidatePath } from "next/cache";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { writeSystemAudit } from "@/lib/audit/system";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { TeamLogoImageError } from "@/lib/storage/team-logo-image";
import {
  ownedTeamLogoPaths,
  removeTeamLogoFiles,
  TeamLogoStorageError,
  uploadTeamLogo,
} from "@/lib/storage/team-logo-storage";

export const runtime = "nodejs";

const safeMessages: Record<string, string> = {
  TEAM_LOGO_STORAGE_NOT_CONFIGURED: "Der Teamlogo-Speicher ist noch nicht konfiguriert.",
  UNSUPPORTED_TEAM_LOGO_TYPE: "Nur PNG, WebP und JPEG sind erlaubt.",
  INVALID_TEAM_LOGO_SIZE: "Diese Datei ist zu groß. Maximal 2 MB.",
  TEAM_LOGO_EXTENSION_MISMATCH: "Dateiendung und tatsächlicher Bildtyp stimmen nicht überein.",
  INVALID_TEAM_LOGO_SIGNATURE: "Die Bilddatei konnte nicht gelesen werden.",
  INVALID_TEAM_LOGO_DIMENSIONS: "Die Bildabmessungen sind ungültig.",
  TEAM_LOGO_PROCESSING_FAILED: "Die Bilddatei konnte nicht verarbeitet werden.",
  TEAM_LOGO_UPLOAD_FAILED: "Das Logo konnte nicht gespeichert werden.",
};

type RouteParams = { params: Promise<{ id: string }> };

function validOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  return !origin || origin === new URL(request.url).origin;
}

async function authorizedUser() {
  const user = await getCurrentUser();
  if (!user) return { response: Response.json({ message: "Anmeldung erforderlich." }, { status: 401 }) } as const;
  if (!hasPermission(user.roles, Permission.ManageMasterData)) {
    return { response: Response.json({ message: "Du hast keine Berechtigung, Teamlogos zu ändern." }, { status: 403 }) } as const;
  }
  return { user } as const;
}

async function organizationIdFrom(context: RouteParams): Promise<number | null> {
  const id = Number((await context.params).id);
  return Number.isInteger(id) && id > 0 ? id : null;
}

async function refreshTeamLogoViews(): Promise<void> {
  for (const path of [
    "/admin/teams", "/teams", "/drivers", "/championship", "/admin/results",
    "/attendance", "/dashboard", "/profile/character", "/admin/design/driver-suits",
  ]) revalidatePath(path);
  revalidatePath("/teams/[id]", "page");
  revalidatePath("/drivers/[id]", "page");
  revalidatePath("/results/[id]", "page");
  await touchAppDataRevisionSafely(getPrismaClient(), ["teams", "drivers", "championship", "results", "attendance", "users"]);
}

export async function POST(request: Request, context: RouteParams) {
  if (!validOrigin(request)) return Response.json({ message: "Ungültige Anfrage." }, { status: 403 });
  const auth = await authorizedUser();
  if ("response" in auth) return auth.response;
  const organizationId = await organizationIdFrom(context);
  if (!organizationId) return Response.json({ message: "Ungültiges Team." }, { status: 400 });

  const prisma = getPrismaClient();
  const organization = await prisma.teamOrganization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, logoUrl: true, archivedAt: true },
  });
  if (!organization) return Response.json({ message: "Team wurde nicht gefunden." }, { status: 404 });
  if (organization.archivedAt) return Response.json({ message: "Archivierte Teams können nicht verändert werden." }, { status: 409 });

  const formData = await request.formData();
  const logo = formData.get("logo");
  if (!(logo instanceof File)) return Response.json({ message: "Keine Bilddatei ausgewählt." }, { status: 400 });

  let upload: Awaited<ReturnType<typeof uploadTeamLogo>> | null = null;
  try {
    upload = await uploadTeamLogo(logo, organizationId);
    await prisma.$transaction(async (transaction) => {
      await transaction.teamOrganization.update({ where: { id: organizationId }, data: { logoUrl: upload!.logoUrl } });
      await transaction.team.updateMany({ where: { organizationId }, data: { logoUrl: upload!.logoUrl } });
      await writeSystemAudit(transaction, {
        actorId: auth.user.id,
        action: organization.logoUrl ? "TEAM_LOGO_REPLACED" : "TEAM_LOGO_UPLOADED",
        entityType: "TeamOrganization",
        entityId: organizationId,
        metadata: { organizationName: organization.name },
      });
    });
  } catch (error: unknown) {
    if (upload) {
      try { await removeTeamLogoFiles([upload.storagePath, upload.thumbnailPath]); } catch { /* orphan cleanup is logged below */ }
    }
    const code = error instanceof TeamLogoImageError || error instanceof TeamLogoStorageError ? error.code : "UNKNOWN";
    console.error("[team-logo] Upload failed.", { actorId: auth.user.id, organizationId, code });
    const suffix = organization.logoUrl ? " Das bisherige Logo wurde beibehalten." : "";
    return Response.json({ message: `${safeMessages[code] ?? "Das Logo konnte nicht gespeichert werden."}${suffix}` }, { status: code === "UNKNOWN" ? 500 : 400 });
  }

  const oldPaths = ownedTeamLogoPaths(organization.logoUrl, organizationId);
  try { await removeTeamLogoFiles(oldPaths); } catch (error: unknown) {
    console.error("[team-logo] Previous file cleanup failed.", { actorId: auth.user.id, organizationId, errorName: error instanceof Error ? error.name : "UnknownError" });
  }
  await refreshTeamLogoViews();
  return Response.json({ message: "Logo wurde erfolgreich hochgeladen.", logoUrl: upload.logoUrl }, { status: 201 });
}

export async function DELETE(request: Request, context: RouteParams) {
  if (!validOrigin(request)) return Response.json({ message: "Ungültige Anfrage." }, { status: 403 });
  const auth = await authorizedUser();
  if ("response" in auth) return auth.response;
  const organizationId = await organizationIdFrom(context);
  if (!organizationId) return Response.json({ message: "Ungültiges Team." }, { status: 400 });

  const prisma = getPrismaClient();
  const organization = await prisma.teamOrganization.findUnique({
    where: { id: organizationId },
    select: { id: true, name: true, logoUrl: true, archivedAt: true },
  });
  if (!organization) return Response.json({ message: "Team wurde nicht gefunden." }, { status: 404 });
  if (organization.archivedAt) return Response.json({ message: "Archivierte Teams können nicht verändert werden." }, { status: 409 });

  await prisma.$transaction(async (transaction) => {
    await transaction.teamOrganization.update({ where: { id: organizationId }, data: { logoUrl: null } });
    await transaction.team.updateMany({ where: { organizationId }, data: { logoUrl: null } });
    await writeSystemAudit(transaction, {
      actorId: auth.user.id,
      action: "TEAM_LOGO_REMOVED",
      entityType: "TeamOrganization",
      entityId: organizationId,
      metadata: { organizationName: organization.name },
    });
  });

  try { await removeTeamLogoFiles(ownedTeamLogoPaths(organization.logoUrl, organizationId)); } catch (error: unknown) {
    console.error("[team-logo] Removed logo cleanup failed.", { actorId: auth.user.id, organizationId, errorName: error instanceof Error ? error.name : "UnknownError" });
  }
  await refreshTeamLogoViews();
  return Response.json({ message: "Logo wurde entfernt.", logoUrl: null });
}
