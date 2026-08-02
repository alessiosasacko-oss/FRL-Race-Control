import { defaultDriverCharacter, neutralFrlSuit, parseCharacterConfiguration, parseSuitConfiguration, type TeamSuitConfiguration } from "./schema";
import type { DriverCharacterView, TeamSuitView } from "./types";

export function fallbackTeamSuit(colors?: { color: string; secondaryColor?: string | null; contrastColor?: string | null }): TeamSuitConfiguration {
  if (!colors) return neutralFrlSuit;
  return {
    ...neutralFrlSuit,
    primaryColor: colors.color,
    secondaryColor: colors.secondaryColor ?? "#111827",
    accentColor: colors.contrastColor ?? "#F8FAFC",
    collarColor: colors.contrastColor ?? "#F8FAFC",
  };
}

export function characterView(record: { id: number; configuration: unknown; normalPose: string; winnerPose: string; version: number; suitVariantId: number | null } | null | undefined): DriverCharacterView {
  return record ? {
    id: record.id,
    configuration: parseCharacterConfiguration(record.configuration),
    normalPose: (record.normalPose || "NEUTRAL") as DriverCharacterView["normalPose"],
    winnerPose: (record.winnerPose || "FIST_UP") as DriverCharacterView["winnerPose"],
    version: record.version,
    suitVariantId: record.suitVariantId,
    customized: true,
  } : { id: null, configuration: defaultDriverCharacter, normalPose: "NEUTRAL", winnerPose: "FIST_UP", version: 1, suitVariantId: null, customized: false };
}

export function suitView(record: { id: number; organizationId: number; name: string; configuration: unknown } | null | undefined, organization?: { id: number; color: string; secondaryColor?: string | null; contrastColor?: string | null } | null): TeamSuitView {
  return record ? { id: record.id, organizationId: record.organizationId, name: record.name, configuration: parseSuitConfiguration(record.configuration, fallbackTeamSuit(organization ?? undefined)) } : { id: null, organizationId: organization?.id ?? null, name: organization ? "Teamfarben" : "FRL Standard", configuration: fallbackTeamSuit(organization ?? undefined) };
}
