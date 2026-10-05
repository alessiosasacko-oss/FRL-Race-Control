import { QualifyingFormat, ResultGraphicType, ResultPublicationStatus, ResultStatus } from "@/domain/enums";
import { formatTiming } from "@/lib/championship/result-engine";
import type { RaceResultsView, ResultRowView, ResultSessionView } from "@/lib/championship/types";
import { graphicTemplates, type GraphicTemplate } from "./templates/catalog";
import { qualifyingFormatLabels } from "@/domain/labels";
import type { GraphicDriver, ResultGraphicRenderData } from "./templates/types";

export function selectGraphicSession(race: RaceResultsView, type: GraphicTemplate, sessionId?: number | null) {
  const expected = graphicTemplates[type].session;
  const session = race.sessions.find((value) => value.session === expected && (!sessionId || value.id === sessionId));
  if (!session) throw new Error("RESULT_GRAPHIC_SESSION_NOT_FOUND");
  if (session.publicationStatus !== ResultPublicationStatus.Published) throw new Error("RESULT_GRAPHIC_NOT_PUBLISHED");
  if (!session.results.length) throw new Error("RESULT_GRAPHIC_NO_RESULTS");
  return session;
}

function qualifyingTime(row: ResultRowView, session: ResultSessionView) {
  return session.qualifyingFormat === QualifyingFormat.Full ? row.q3TimeMs ?? row.q2TimeMs ?? row.q1TimeMs : row.qualifyingTimeMs;
}
function qualifyingStage(row: ResultRowView, session: ResultSessionView) {
  return session.qualifyingFormat !== QualifyingFormat.Full ? 0 : row.q3TimeMs !== null ? 3 : row.q2TimeMs !== null ? 2 : 1;
}
const timing = (value: number | null) => value !== null && value > 0 ? formatTiming(value) : "—";

/** Only canonical, published classifications are accepted. Never infer missing times or grid positions. */
export function prepareSessionGraphic(session: ResultSessionView, type: GraphicTemplate) {
  if (session.publicationStatus !== ResultPublicationStatus.Published) throw new Error("RESULT_GRAPHIC_NOT_PUBLISHED");
  if (session.session !== graphicTemplates[type].session) throw new Error("RESULT_GRAPHIC_SESSION_NOT_FOUND");
  if (!session.results.length) throw new Error("RESULT_GRAPHIC_NO_RESULTS");
  const qualifying = graphicTemplates[type].session === "QUALIFYING";
  const classified = [...session.results].sort((a, b) => (a.finalPosition ?? a.position ?? Infinity) - (b.finalPosition ?? b.position ?? Infinity) || a.driverId - b.driverId);
  let selected = classified;
  if (type === "GRID") {
    if (classified.some((row) => !row.startingPosition) || new Set(classified.map((row) => row.startingPosition)).size !== classified.length) throw new Error("RESULT_GRAPHIC_GRID_MISSING");
    selected = [...classified].sort((a, b) => a.startingPosition! - b.startingPosition!);
  }
  if (type === "FASTEST_LAP") {
    const timed = classified.filter((row) => row.fastestLapMs !== null && row.fastestLapMs > 0 && ![ResultStatus.Dsq, ResultStatus.Dns].includes(row.status));
    const min = Math.min(...timed.map((row) => row.fastestLapMs!));
    selected = timed.filter((row) => row.fastestLapMs === min);
    if (!selected.length) throw new Error("RESULT_GRAPHIC_FASTEST_MISSING");
  }
  const valid = classified.filter((row) => ![ResultStatus.Dsq, ResultStatus.Dns].includes(row.status));
  const count = type === "FRONT_ROW" ? 2 : type === "PODIUM" ? 3 : 1;
  const highlights = type === "FASTEST_LAP" ? selected : valid.filter((row) => (row.finalPosition ?? row.position ?? 0) >= 1 && (row.finalPosition ?? row.position ?? Infinity) <= count);
  if (["POLE", "WINNER", "FRONT_ROW", "PODIUM"].includes(type) && highlights.length !== count) throw new Error("RESULT_GRAPHIC_HIGHLIGHT_MISSING");
  const map = (row: ResultRowView) => {
    const position = type === "GRID" ? row.startingPosition! : row.finalPosition ?? row.position ?? 0;
    const qTime = qualifyingTime(row, session);
    const comparable = classified.filter((other) => qualifyingStage(other, session) === qualifyingStage(row, session) && qualifyingTime(other, session) !== null && ![ResultStatus.Dsq, ResultStatus.Dns].includes(other.status));
    const best = Math.min(...comparable.map((other) => qualifyingTime(other, session)!));
    const primary = type === "FASTEST_LAP" ? timing(row.fastestLapMs) : qualifying ? timing(qTime)
      : position === 1 ? timing(row.adjustedTimeMs ?? row.totalTimeMs)
      : row.lapsBehind ? `+${row.lapsBehind} LAP${row.lapsBehind === 1 ? "" : "S"}`
      : row.gapToWinnerMs !== null ? `+${formatTiming(row.gapToWinnerMs)}` : "—";
    return { driverId: row.driverId, position, name: row.driver.name, number: row.driver.number, imageUrl: row.driver.imageUrl,
      grid: row.startingPosition !== null && row.startingPosition > 0 ? String(row.startingPosition) : "—", bestLap: timing(row.fastestLapMs),
      teamName: row.representedTeam.name, teamColor: row.representedTeam.color, teamLogoUrl: row.representedTeam.logoUrl,
      primary, secondary: qualifying ? qTime === null ? "—" : `${session.qualifyingFormat === QualifyingFormat.Full ? `Q${qualifyingStage(row, session)} · ` : ""}+${formatTiming(Math.max(0, qTime - best))}` : `${row.racePoints + row.bonusPoints} PTS`, status: row.status };
  };
  return {
    rows: selected.map(map), highlights: highlights.map(map),
    columnLabels: (qualifying ? ["TIME", "GAP / SESSION"] : ["TIME / GAP", "POINTS"]) as [string, string],
    subtitle: type === "GRID" ? "Confirmed starting positions" : qualifying && session.qualifyingFormat === QualifyingFormat.Full ? "Gap within Q1 / Q2 / Q3" : "",
    isQualifying: qualifying,
    isClassification: type === ResultGraphicType.QualifyingClassification || type === ResultGraphicType.RaceClassification,
  };
}

/** Shared by the real query/storage service and the production-like render tests. */
export function composeSessionGraphic(
  race: RaceResultsView, session: ResultSessionView, type: GraphicTemplate,
  prepared: ReturnType<typeof prepareSessionGraphic>,
  rows: Array<ReturnType<typeof prepareSessionGraphic>["rows"][number] & Pick<GraphicDriver, "imageDataUrl" | "teamLogoDataUrl" | "imageKind">>,
  frlLogoDataUrl: string | null,
): ResultGraphicRenderData {
  const highlights = prepared.highlights.map((row) => rows.find((candidate) => candidate.driverId === row.driverId)).filter((row) => row !== undefined);
  return {
    template: type, title: graphicTemplates[type].label, subtitle: prepared.subtitle,
    leagueCode: race.race.season.league.code, seasonName: race.race.season.name,
    raceName: race.race.name, circuit: race.race.circuit, round: race.race.round, sessionLabel: session.session,
    formatLabel: session.qualifyingFormat ? qualifyingFormatLabels[session.qualifyingFormat] : null,
    draft: false, frlLogoDataUrl,
    leaderLabel: type === "FASTEST_LAP" ? "FASTEST LAP" : prepared.isQualifying ? "POLE" : "WINNER",
    leader: highlights[0] ?? null, highlights, rows, columnLabels: prepared.columnLabels,
  };
}
