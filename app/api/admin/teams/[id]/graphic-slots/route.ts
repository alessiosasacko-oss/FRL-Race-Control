import { z } from "zod";
import { getPrismaClient } from "@/lib/db/prisma";
import { writeSystemAudit } from "@/lib/audit/system";
import { refreshTeamRenders, teamRenderAdminContext } from "@/lib/graphics/team-render-admin";

export const runtime = "nodejs";
const schema = z.object({ seasonId: z.number().int().positive(), leagueId: z.number().int().positive(), driverOneId: z.number().int().positive().nullable(), driverTwoId: z.number().int().positive().nullable() }).refine((value) => value.driverOneId === null || value.driverOneId !== value.driverTwoId);

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = await teamRenderAdminContext(request, (await context.params).id);
  if ("response" in auth) return auth.response;
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Bitte zwei unterschiedliche Stammfahrer auswählen." }, { status: 400 });
  const input = parsed.data;
  try {
    await getPrismaClient().$transaction(async (transaction) => {
      const team = await transaction.teamOrganization.findFirst({ where: { id: auth.team.id, active: true, archivedAt: null }, select: { id: true } });
      if (!team) throw new Error("TEAM_UNAVAILABLE");
      const assignments = await transaction.driverSeasonAssignment.findMany({
        where: { organizationId: auth.team.id, seasonId: input.seasonId, leagueId: input.leagueId, active: true, lineupStatus: "PRIMARY", driver: { active: true }, season: { active: true, archivedAt: null } },
        select: { id: true, driverId: true, graphicSlot: true },
      });
      const ids = [input.driverOneId, input.driverTwoId].filter((id) => id !== null);
      if (ids.some((id) => !assignments.some((assignment) => assignment.driverId === id))) throw new Error("ASSIGNMENT_CHANGED");
      const changes = assignments.map((row) => ({ ...row, next: row.driverId === input.driverOneId ? 1 : row.driverId === input.driverTwoId ? 2 : null })).filter((row) => row.next !== row.graphicSlot);
      // Release only changed slots first, allowing an atomic swap without changing
      // the start date of assignments the admin left untouched.
      await transaction.driverSeasonAssignment.updateMany({ where: { id: { in: changes.map((row) => row.id) } }, data: { graphicSlot: null } });
      for (const row of changes) if (row.next !== null) await transaction.driverSeasonAssignment.update({ where: { id: row.id }, data: { graphicSlot: row.next } });
      await writeSystemAudit(transaction, { actorId: auth.user.id, action: "TEAM_GRAPHIC_SLOTS_ASSIGNED", entityType: "TeamOrganization", entityId: auth.team.id, metadata: { ...input, previous: assignments.map(({ driverId, graphicSlot }) => ({ driverId, graphicSlot })) } });
    }, { isolationLevel: "Serializable" });
  } catch {
    return Response.json({ message: "Zuordnung nicht gespeichert. Bitte Seite neu laden und die aktuellen Stammfahrer prüfen." }, { status: 409 });
  }
  await refreshTeamRenders();
  return Response.json({ message: "Fahrer-Slots gespeichert. Bestehende Ergebnis-Snapshots bleiben unverändert." });
}
