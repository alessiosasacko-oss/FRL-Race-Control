import { hasPermission, Permission } from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { ResultSession } from "@/domain";
import { renderResultGraphicPng, resultGraphicDimensions } from "@/lib/graphics/result-graphic-renderer";
import { getResultGraphicRenderData } from "@/lib/graphics/result-graphic-service";
import { graphicTemplates, isGraphicTemplate } from "@/lib/graphics/templates/catalog";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: Request) {
  const user = await getCurrentUser();
  if (!user) return Response.json({ message: "Anmeldung erforderlich." }, { status: 401 });
  if (!hasPermission(user.roles, Permission.ManageResults)) return Response.json({ message: "Keine Berechtigung." }, { status: 403 });
  const origin = request.headers.get("origin");
  if (origin && origin !== new URL(request.url).origin) return Response.json({ message: "Ungültige Anfrage." }, { status: 403 });
  const body = await request.json().catch(() => null) as { raceId?: unknown; leagueId?: unknown; resultSessionId?: unknown; session?: unknown; type?: unknown } | null;
  const raceId = Number(body?.raceId);
  const leagueId = Number(body?.leagueId);
  const resultSessionId = body?.resultSessionId ? Number(body.resultSessionId) : null;
  const session = body?.session;
  const type = body?.type;
  if (!Number.isSafeInteger(raceId) || raceId <= 0 || !Number.isSafeInteger(leagueId) || leagueId <= 0 || (resultSessionId !== null && (!Number.isSafeInteger(resultSessionId) || resultSessionId <= 0)) || !isGraphicTemplate(type) || graphicTemplates[type].session !== session || !Object.values(ResultSession).includes(session as ResultSession)) {
    return Response.json({ message: "Ungültige Grafikdaten." }, { status: 400 });
  }
  try {
    const data = await getResultGraphicRenderData({ raceId, leagueId, resultSessionId, type });
    const png = await renderResultGraphicPng(data);
    const dimensions = resultGraphicDimensions(data);
    return new Response(new Uint8Array(png), { status: 200, headers: { "content-type": "image/png", "cache-control": "no-store", "x-content-type-options": "nosniff", "x-graphic-width": String(dimensions.width), "x-graphic-height": String(dimensions.height), "content-disposition": `inline; filename="frl-${raceId}-${leagueId}-${type.toLowerCase()}.png"` } });
  } catch (error: unknown) {
    console.error("[result-graphics] Preview failed.", { raceId, leagueId, session, errorName: error instanceof Error ? error.name : "UnknownError" });
    const messages: Record<string, string> = {
      RESULT_GRAPHIC_UNSUPPORTED_GLYPH: "Ein Name enthält ein Zeichen, das der Grafikfont nicht unterstützt. Bitte prüfe Sonderzeichen in Fahrer-, Team- und Rennnamen.",
      RESULT_GRAPHIC_SESSION_NOT_FOUND: "Für diesen Grafiktyp ist noch keine veröffentlichte Session vorhanden.",
      RESULT_GRAPHIC_NOT_PUBLISHED: "Veröffentliche zuerst die Ergebnisse dieser Session.",
      RESULT_GRAPHIC_NO_RESULTS: "Die Session enthält noch keine Ergebnisse.",
      RESULT_GRAPHIC_GRID_MISSING: "Für das Grid werden eindeutige Startpositionen für alle Teilnehmer benötigt.",
      RESULT_GRAPHIC_FASTEST_MISSING: "Keine gültige schnellste Rundenzeit in den veröffentlichten Rennresultaten vorhanden.",
      RESULT_GRAPHIC_HIGHLIGHT_MISSING: "Die benötigten klassifizierten Plätze sind noch nicht vollständig vorhanden.",
    };
    return Response.json({ message: error instanceof Error && messages[error.message] || "Die Grafik konnte nicht erzeugt werden. Bitte versuche es erneut." }, { status: 422 });
  }
}
