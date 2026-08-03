import "server-only";

import type { Prisma, PrismaClient, ResultGraphic } from "@/generated/prisma/client";
import { ResultGraphicType } from "@/domain";
import { enqueueDiscordDelivery } from "./outbox";
import { purposeForResultGraphic, resultGraphicDedupeKey } from "./result-graphic-policy";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const copy: Record<ResultGraphicType, { title: string; description: string; file: string }> = {
  [ResultGraphicType.QualifyingClassification]: {
    title: "Qualifying-Ergebnis veröffentlicht",
    description: "Die offizielle Qualifying-Klassifikation ist verfügbar.",
    file: "frl-qualifying.png",
  },
  [ResultGraphicType.RaceClassification]: {
    title: "Rennergebnis veröffentlicht",
    description: "Die offizielle Rennklassifikation ist verfügbar.",
    file: "frl-race-result.png",
  },
  [ResultGraphicType.DriverChampionship]: {
    title: "Fahrerwertung aktualisiert",
    description: "Der aktuelle Stand der Fahrermeisterschaft ist verfügbar.",
    file: "frl-drivers-championship.png",
  },
  [ResultGraphicType.ConstructorChampionship]: {
    title: "Teamwertung aktualisiert",
    description: "Der aktuelle Stand der Teammeisterschaft ist verfügbar.",
    file: "frl-team-championship.png",
  },
};

export async function enqueueResultGraphicDiscord(
  database: DatabaseClient,
  graphic: Pick<ResultGraphic, "id" | "type" | "leagueId" | "raceId" | "version" | "renderingVersion" | "publicUrl">,
): Promise<number> {
  if (!graphic.publicUrl) throw new Error("RESULT_GRAPHIC_URL_MISSING");
  const type = graphic.type as ResultGraphicType;
  const message = copy[type];
  return enqueueDiscordDelivery(database, {
    purpose: purposeForResultGraphic(type),
    leagueId: graphic.leagueId,
    resultGraphicId: graphic.id,
    renderingVersion: graphic.renderingVersion,
    dedupeKey: resultGraphicDedupeKey(graphic),
    payload: {
      title: graphic.version > 1 ? `KORRIGIERTE VERSION · ${message.title}` : message.title,
      description: graphic.version > 1 ? `${message.description} Stand: Version ${graphic.version}.` : message.description,
      href: `/results/${graphic.raceId}?leagueId=${graphic.leagueId}`,
      attachmentUrl: graphic.publicUrl,
      attachmentName: message.file,
      fields: [{ name: "Version", value: String(graphic.version), inline: true }],
    },
  });
}
