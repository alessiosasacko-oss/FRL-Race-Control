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
  ResultGraphicType,
  ResultSession,
} from "@/domain";
import { getChampionshipPageData, getRaceResults } from "@/lib/championship/queries";

import { getPrismaClient } from "@/lib/db/prisma";
import { enqueueResultGraphicDiscord } from "@/lib/discord/result-graphics";
import { logger } from "@/lib/observability/logger";
import {
  renderResultGraphicPng,
  resultGraphicDimensions,
  RESULT_GRAPHIC_RENDERING_VERSION,
  type ResultGraphicRenderData,
} from "./result-graphic-renderer";
import { hydrateGraphicAssets, uploadResultGraphic } from "./result-graphic-storage";
import { type GraphicTemplate } from "./templates/catalog";
import { composeSessionGraphic, prepareSessionGraphic, selectGraphicSession } from "./result-graphic-data";

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
      create: { renderingVersion: RESULT_GRAPHIC_RENDERING_VERSION, type: type as PrismaResultGraphicType, leagueId: input.leagueId, raceId: input.raceId, resultSessionId: input.resultSessionId, version: input.version },
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

export async function getResultGraphicRenderData(input: {
  raceId: number;
  leagueId: number;
  type: GraphicTemplate;
  resultSessionId?: number | null;
  expectedRevision?: number;
  draft?: boolean;
}): Promise<ResultGraphicRenderData> {
  const raceResults = await getRaceResults(input.raceId, input.leagueId, false);
  if (!raceResults) throw new Error("RESULT_GRAPHIC_RACE_NOT_FOUND");
  const targetSession = selectGraphicSession(raceResults, input.type, input.resultSessionId);
  if (input.expectedRevision !== undefined && targetSession.revision !== input.expectedRevision) throw new Error("RESULT_GRAPHIC_STALE_REVISION");
  const frlLogo = await frlLogoDataUrl();
  if (input.type !== ResultGraphicType.DriverChampionship && input.type !== ResultGraphicType.ConstructorChampionship) {
    const prepared = prepareSessionGraphic(targetSession, input.type);
    const highlightedIds = new Set(prepared.highlights.map((row) => row.driverId));
    const driverIds = prepared.rows.filter((row) => input.type === "GRID" || highlightedIds.has(row.driverId)).map((row) => row.driverId);
    const renders = await getPrismaClient().driver.findMany({
      where: { id: { in: driverIds } }, select: { id: true, resultGraphicImageUrl: true },
    });
    const renderByDriver = new Map(renders.map((driver) => [driver.id, driver.resultGraphicImageUrl]));
    const hydrated = await hydrateGraphicAssets(prepared.rows.map((row) => ({ ...row, imageUrl: driverIds.includes(row.driverId) ? row.imageUrl : null, renderImageUrl: renderByDriver.get(row.driverId) ?? null })));
    return composeSessionGraphic(raceResults, targetSession, input.type, prepared, hydrated, frlLogo);
  }

  const championship = await getChampionshipPageData({ q: "", leagueId: input.leagueId, seasonId: raceResults.race.season.id, table: "drivers" });
  const driverGraphic = input.type === ResultGraphicType.DriverChampionship;
  const baseRows = driverGraphic
    ? championship.drivers.map((standing) => ({ position: standing.position, name: standing.driver.name, number: standing.driver.number, imageUrl: standing.driver.imageUrl, teamName: standing.driver.team?.name ?? "Ohne Team", teamColor: standing.driver.team?.color ?? "#168BFF", teamLogoUrl: standing.driver.team?.logoUrl ?? null, primary: `${standing.points} PTS`, secondary: `${standing.wins} S · ${standing.podiums} P` }))
    : championship.teams.map((standing) => {
        const driver = championship.drivers.find((candidate) => candidate.driver.team?.id === standing.team.id);
        return { position: standing.position, name: standing.team.name, number: driver?.driver.number ?? 0, imageUrl: driver?.driver.imageUrl ?? null, teamName: standing.team.name, teamColor: standing.team.color, teamLogoUrl: standing.team.logoUrl, primary: `${standing.points} PTS`, secondary: `${standing.wins} S · ${standing.podiums} P` };
      });
  const hydrated = await hydrateGraphicAssets(baseRows);
  const first = hydrated[0] ?? null;
  return {
    template: input.type,
    columnLabels: ["POINTS", "WINS / PODIUMS"],
    title: driverGraphic ? "DRIVERS’ CHAMPIONSHIP" : "CONSTRUCTORS’ CHAMPIONSHIP",
    subtitle: "",
    leagueCode: raceResults.race.season.league.code,
    seasonName: raceResults.race.season.name,
    raceName: "AKTUELLER SAISONSTAND",
    draft: input.draft,
    frlLogoDataUrl: frlLogo,
    leaderLabel: driverGraphic ? "LEADER" : "LEADERS",
    leader: first ? { name: first.name, number: first.number, teamName: first.teamName, teamColor: first.teamColor, teamLogoDataUrl: first.teamLogoDataUrl, imageDataUrl: first.imageDataUrl } : null,
    rows: hydrated.map((row) => ({ position: row.position, name: row.name, teamName: row.teamName, teamColor: row.teamColor, teamLogoDataUrl: row.teamLogoDataUrl, primary: row.primary, secondary: row.secondary })),
  };
}

export async function processResultGraphic(graphicId: number) {
  const prisma = getPrismaClient();
  const graphic = await prisma.resultGraphic.update({ where: { id: graphicId }, data: { renderStatus: GraphicRenderStatus.RENDERING, renderingVersion: { increment: 1 }, errorMessage: null } });
  try {
    const type = graphic.type as ResultGraphicType;
    const data = await getResultGraphicRenderData({ raceId: graphic.raceId, leagueId: graphic.leagueId, type, resultSessionId: graphic.resultSessionId, expectedRevision: graphic.version });
    const png = await renderResultGraphicPng(data);
    const dimensions = resultGraphicDimensions(data);
    const slug = type === ResultGraphicType.QualifyingClassification ? "qualifying" : type === ResultGraphicType.RaceClassification ? "race" : type === ResultGraphicType.DriverChampionship ? "drivers" : "teams";
    const race = await prisma.race.findUniqueOrThrow({ where: { id: graphic.raceId }, select: { seasonId: true } });
    const storagePath = `season-${race.seasonId}/race-${graphic.raceId}/league-${graphic.leagueId}/${slug}-v${graphic.version}-r${graphic.renderingVersion}.png`;
    const publicUrl = await uploadResultGraphic(storagePath, png);
    const completed = await prisma.resultGraphic.update({ where: { id: graphic.id }, data: { renderStatus: GraphicRenderStatus.COMPLETED, storagePath, publicUrl, checksum: createHash("sha256").update(png).digest("hex"), width: dimensions.width, height: dimensions.height, generatedAt: new Date(), errorMessage: null } });
    await prisma.systemAuditLog.create({
      data: { action: "RESULT_GRAPHIC_RENDERED", entityType: "ResultGraphic", entityId: completed.id, metadata: { type: completed.type, leagueId: completed.leagueId, raceId: completed.raceId, version: completed.version, renderingVersion: completed.renderingVersion } },
    });
    await enqueueResultGraphicDiscord(prisma, completed).catch((error: unknown) => {
      logger.error("Result graphic Discord delivery could not be queued", error, { graphicId: completed.id });
    });
    return completed;
  } catch (error: unknown) {
    await prisma.resultGraphic.update({ where: { id: graphic.id }, data: { renderStatus: GraphicRenderStatus.FAILED, errorMessage: error instanceof Error ? error.name.slice(0, 1000) : "UnknownError" } });
    await prisma.systemAuditLog.create({
      data: { action: "RESULT_GRAPHIC_RENDER_FAILED", entityType: "ResultGraphic", entityId: graphic.id, metadata: { type: graphic.type, leagueId: graphic.leagueId, raceId: graphic.raceId, version: graphic.version } },
    }).catch(() => undefined);
    throw error;
  }
}

export async function processResultGraphics(graphicIds: readonly number[]) {
  return Promise.allSettled(graphicIds.map((id) => processResultGraphic(id)));
}

export async function processPendingResultGraphics(limit = 4) {
  const graphics = await getPrismaClient().resultGraphic.findMany({
    where: { renderStatus: GraphicRenderStatus.PENDING },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 10),
    select: { id: true },
  });
  const outcomes = await processResultGraphics(graphics.map(({ id }) => id));
  return {
    rendered: outcomes.filter(({ status }) => status === "fulfilled").length,
    failed: outcomes.filter(({ status }) => status === "rejected").length,
  };
}
