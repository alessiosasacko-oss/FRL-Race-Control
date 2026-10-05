import "server-only";
import { revalidatePath } from "next/cache";
import { getCurrentUser } from "@/lib/auth/session";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";

export async function teamRenderAdminContext(request: Request, id: string) {
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return { response: Response.json({ message: "Ungültige Anfrage." }, { status: 403 }) } as const;
  const user = await getCurrentUser();
  if (!user) return { response: Response.json({ message: "Anmeldung erforderlich." }, { status: 401 }) } as const;
  if (!hasPermission(user.roles, Permission.ManageMasterData)) return { response: Response.json({ message: "Keine Berechtigung." }, { status: 403 }) } as const;
  const organizationId = Number(id);
  if (!Number.isSafeInteger(organizationId) || organizationId <= 0) return { response: Response.json({ message: "Ungültiges Team." }, { status: 400 }) } as const;
  const team = await getPrismaClient().teamOrganization.findUnique({ where: { id: organizationId }, select: { id: true, active: true, archivedAt: true, driverOneGraphicImageUrl: true, driverTwoGraphicImageUrl: true } });
  if (!team || !team.active || team.archivedAt) return { response: Response.json({ message: "Team ist nicht verfügbar oder archiviert." }, { status: 404 }) } as const;
  return { user, team } as const;
}

export async function refreshTeamRenders() {
  revalidatePath("/admin/teams");
  revalidatePath("/admin/results");
  await touchAppDataRevisionSafely(getPrismaClient(), ["teams", "drivers", "results"]);
}
