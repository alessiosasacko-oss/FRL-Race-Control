import "server-only";

import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import {
  GraphicRenderStatus,
  Prisma,
  ResultGraphicType as PrismaResultGraphicType,
} from "@/generated/prisma/client";
import {
  QualifyingFormat,
  ResultGraphicType,
  ResultSession,
  ResultStatus,
  qualifyingFormatLabels,
} from "@/domain";
import { getChampionshipPageData, getRaceResults } from "@/lib/championship/queries";
import { formatTiming } from "@/lib/championship/result-engine";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  renderResultGraphicPng,
  RESULT_GRAPHIC_HEIGHT,
  RESULT_GRAPHIC_RENDERING_VERSION,
  RESULT_GRAPHIC_WIDTH,
  type GraphicDriver,
  type ResultGraphicRenderData,
} from "./result-graphic-renderer";
import { safeGraphicAssetDataUrl, uploadResultGraphic } from "./result-graphic-storage";

export function graphicTypesForSession(session: ResultSession): ResultGraphicType[] {
  if (session === ResultSession.Qualifying) return [ResultGraphicType.QualifyingClassification];
  if (session === ResultSession.Race) return [
    ResultGraphicType.RaceClassification,
    ResultGraphicType.DriverChampionship,
    ResultGraphicType.ConstructorChampionship,
  ];
  return [];
}

export async function enqueuePublishedResultGraphics(
  transaction: Prisma.TransactionClient,
  input: { raceId: number; leagueId: number; resultSessionId: number; session: ResultSession; version: number },
) {
  const ids: number[] = [];
  for (const type of graphicTypesForSession(input.session)) {
    const graphic = await transaction.resultGraphic.upsert({
      where: { type_leagueId_raceId_version: { type: type as PrismaResultGraphicType, leagueId: input.leagueId, raceId: input.raceId, version: input.version } },
      update: { resultSessionId: input.resultSessionId, renderStatus: GraphicRenderStatus.PENDING, errorMessage: null },
      create: { type: type as PrismaResultGraphicType, leagueId: input.leagueId, raceId: input.raceId, resultSessionId: input.resultSessionId, version: input.version },
      select: { id: true },
    });
    ids.push(graphic.id);
  }
  return ids;
}

async function frlLogoDataUrl() {
  try {
    const bytes = await readFile(path.join(process.cwd(), "public", "images", "frl-logo.png"));
    return `data:image/png;base64,${bytes.toString("base64")}`;
  } catch {
    return null;
  }
}

async function hydrateLogos<T extends { teamLogoUrl: string | null }>(rows: readonly T[]) {
  const unique = [...new Set(rows.flatMap((row) => row.teamLogoUrl ? [row.teamLogoUrl] : []))];
  const loaded = await Promise.all(unique.map(async (url) => [url, await safeGraphicAssetDataUrl(url).catch(() => null)] as const));
  const byUrl = new Map(loaded);
  return rows.map((row) => ({ ...row, teamLogoDataUrl: row.teamLogoUrl ? byUrl.get(row.teamLogoUrl) ?? null : null }));
}

export async function getResultGraphicRenderData(input: {
  raceId: number;
  leagueId: number;
  type: ResultGraphicType;
  resultSessionId?: number | null;
  draft?: boolean;
}): Promise<ResultGraphicRenderData> {
  const raceResults = await getRaceResults(input.raceId, input.leagueId, true);
  if (!raceResults) throw new Error("RESULT_GRAPHIC_RACE_NOT_FOUND");
  const frlLogo = await frlLogoDataUrl();
  const isQualifying = input.type === ResultGraphicType.QualifyingClassification;
  const isRace = input.type === ResultGraphicType.RaceClassification;
  if (isQualifying || isRace) {
    const targetSession = input.resultSessionId
      ? raceResults.sessions.find((session) => session.id === input.resultSessionId)
      : raceResults.sessions.find((session) => session.session === (isQualifying ? ResultSession.Qualifying : ResultSession.Race));
    if (!targetSession) throw new Error("RESULT_GRAPHIC_SESSION_NOT_FOUND");
    const hydrated = await hydrateLogos(targetSession.results.map((result) => ({
      position: result.finalPosition ?? result.position ?? 0,
      name: result.driver.name,
      number: result.driver.number,
      character: result.driver.character.configuration,
      teamName: result.representedTeam.name,
      teamColor: result.representedTeam.color,
      teamLogoUrl: result.representedTeam.logoUrl,
      primary: isQualifying
        ? formatTiming(targetSession.qualifyingFormat === QualifyingFormat.Full ? result.q3TimeMs ?? result.q2TimeMs ?? result.q1TimeMs : result.qualifyingTimeMs)
        : result.position === 1 ? formatTiming(result.totalTimeMs) || "SIEGER" : result.lapsBehind ? `+${result.lapsBehind} R` : `+${formatTiming(result.gapToWinnerMs)}`,
      secondary: isQualifying
        ? result.q3TimeMs !== null ? "Q3" : result.q2TimeMs !== null ? "Q2 AUS" : "Q1 AUS"
        : `${result.racePoints + result.bonusPoints} PTS · ${result.lapsCompleted} RD`,
      status: result.status,
    })));
    const leaderRow = hydrated.find((row) => row.position === 1) ?? hydrated[0] ?? null;
    const leader: GraphicDriver | null = leaderRow ? { name: leaderRow.name, number: leaderRow.number, teamName: leaderRow.teamName, teamColor: leaderRow.teamColor, teamLogoDataUrl: leaderRow.teamLogoDataUrl, character: leaderRow.character } : null;
    return {
      title: isQualifying ? "QUALIFYING CLASSIFICATION" : "RACE CLASSIFICATION",
      subtitle: "",
      leagueCode: raceResults.race.season.league.code,
      seasonName: raceResults.race.season.name,
      raceName: raceResults.race.name,
      formatLabel: targetSession.qualifyingFormat ? qualifyingFormatLabels[targetSession.qualifyingFormat] : null,
      draft: input.draft,
      frlLogoDataUrl: frlLogo,
      leaderLabel: isQualifying ? "POLE" : "WINNER",
      leader,
      rows: hydrated.map((row) => ({ position: row.position, name: row.name, teamName: row.teamName, teamColor: row.teamColor, teamLogoDataUrl: row.teamLogoDataUrl, primary: row.status === ResultStatus.Dsq ? "DSQ" : row.status === ResultStatus.Dns ? "DNS" : row.status === ResultStatus.Dnf ? "DNF" : row.primary || "–", secondary: row.secondary, status: row.status })),
    };
  }

  const championship = await getChampionshipPageData({ q: "", leagueId: input.leagueId, seasonId: raceResults.race.season.id, table: "drivers" });
  const driverGraphic = input.type === ResultGraphicType.DriverChampionship;
  const baseRows = driverGraphic
    ? championship.drivers.map((standing) => ({ position: standing.position, name: standing.driver.name, number: standing.driver.number, character: standing.driver.character.configuration, teamName: standing.driver.team?.name ?? "Ohne Team", teamColor: standing.driver.team?.color ?? "#168BFF", teamLogoUrl: standing.driver.team?.logoUrl ?? null, primary: `${standing.points} PTS`, secondary: `${standing.wins} S · ${standing.podiums} P` }))
    : championship.teams.map((standing) => {
        const driver = championship.drivers.find((candidate) => candidate.driver.team?.id === standing.team.id);
        return { position: standing.position, name: standing.team.name, number: driver?.driver.number ?? 0, character: driver?.driver.character.configuration ?? null, teamName: standing.team.name, teamColor: standing.team.color, teamLogoUrl: standing.team.logoUrl, primary: `${standing.points} PTS`, secondary: `${standing.wins} S · ${standing.podiums} P` };
      });
  const hydrated = await hydrateLogos(baseRows);
  const first = hydrated[0] ?? null;
  return {
    title: driverGraphic ? "DRIVERS’ CHAMPIONSHIP" : "CONSTRUCTORS’ CHAMPIONSHIP",
    subtitle: "",
    leagueCode: raceResults.race.season.league.code,
    seasonName: raceResults.race.season.name,
    raceName: `STAND NACH ${raceResults.race.name.toUpperCase()}`,
    draft: input.draft,
    frlLogoDataUrl: frlLogo,
    leaderLabel: driverGraphic ? "LEADER" : "LEADERS",
    leader: first ? { name: first.name, number: first.number, teamName: first.teamName, teamColor: first.teamColor, teamLogoDataUrl: first.teamLogoDataUrl, character: first.character } : null,
    rows: hydrated.map((row) => ({ position: row.position, name: row.name, teamName: row.teamName, teamColor: row.teamColor, teamLogoDataUrl: row.teamLogoDataUrl, primary: row.primary, secondary: row.secondary })),
  };
}

export async function processResultGraphic(graphicId: number) {
  const prisma = getPrismaClient();
  const graphic = await prisma.resultGraphic.update({ where: { id: graphicId }, data: { renderStatus: GraphicRenderStatus.RENDERING, errorMessage: null } });
  try {
    const type = graphic.type as ResultGraphicType;
    const data = await getResultGraphicRenderData({ raceId: graphic.raceId, leagueId: graphic.leagueId, type, resultSessionId: graphic.resultSessionId });
    const png = await renderResultGraphicPng(data);
    const slug = type === ResultGraphicType.QualifyingClassification ? "qualifying" : type === ResultGraphicType.RaceClassification ? "race" : type === ResultGraphicType.DriverChampionship ? "drivers" : "teams";
    const race = await prisma.race.findUniqueOrThrow({ where: { id: graphic.raceId }, select: { seasonId: true } });
    const storagePath = `season-${race.seasonId}/race-${graphic.raceId}/league-${graphic.leagueId}/${slug}-v${graphic.version}.png`;
    const publicUrl = await uploadResultGraphic(storagePath, png);
    return await prisma.resultGraphic.update({ where: { id: graphic.id }, data: { renderStatus: GraphicRenderStatus.COMPLETED, storagePath, publicUrl, checksum: createHash("sha256").update(png).digest("hex"), width: RESULT_GRAPHIC_WIDTH, height: RESULT_GRAPHIC_HEIGHT, renderingVersion: RESULT_GRAPHIC_RENDERING_VERSION, generatedAt: new Date(), errorMessage: null } });
  } catch (error: unknown) {
    await prisma.resultGraphic.update({ where: { id: graphic.id }, data: { renderStatus: GraphicRenderStatus.FAILED, errorMessage: error instanceof Error ? error.name.slice(0, 1000) : "UnknownError" } });
    throw error;
  }
}

export async function processResultGraphics(graphicIds: readonly number[]) {
  return Promise.allSettled(graphicIds.map((id) => processResultGraphic(id)));
}
