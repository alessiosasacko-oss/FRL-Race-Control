import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { ResultGraphicType, ResultSession } from "@/domain";
import { renderResultGraphicPng } from "@/lib/graphics/result-graphic-renderer";
import { getResultGraphicRenderData } from "@/lib/graphics/result-graphic-service";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Anmeldung erforderlich." }, { status: 401 });
  if (!hasPermission(user.roles, Permission.ManageResults)) return Response.json({ message: "Keine Berechtigung." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Ungültige Anfrage." }, { status: 403 });
  const body = await request.json().catch(() => null) as { raceId?: unknown; leagueId?: unknown; resultSessionId?: unknown; session?: unknown } | null;
  const raceId = Number(body?.raceId);
  const leagueId = Number(body?.leagueId);
  const resultSessionId = body?.resultSessionId ? Number(body.resultSessionId) : null;
  const session = body?.session;
  if (!Number.isInteger(raceId) || raceId <= 0 || !Number.isInteger(leagueId) || leagueId <= 0 || !Object.values(ResultSession).includes(session as ResultSession)) {
    return Response.json({ message: "Ungültige Grafikdaten." }, { status: 400 });
  }
  const type = session === ResultSession.Qualifying ? ResultGraphicType.QualifyingClassification : ResultGraphicType.RaceClassification;
  try {
    const data = await getResultGraphicRenderData({ raceId, leagueId, resultSessionId, type, draft: true });
    const png = await renderResultGraphicPng(data);
    return new Response(new Uint8Array(png), { status: 200, headers: { "content-type": "image/png", "cache-control": "no-store", "content-disposition": `inline; filename="preview-${leagueId}-${session}.png"` } });
  } catch (error: unknown) {
    console.error("[result-graphics] Preview failed.", { raceId, leagueId, session, errorName: error instanceof Error ? error.name : "UnknownError" });
    return Response.json({ message: "Die Grafikvorschau konnte nicht erzeugt werden. Speichere zuerst den aktuellen Entwurf." }, { status: 422 });
  }
}
