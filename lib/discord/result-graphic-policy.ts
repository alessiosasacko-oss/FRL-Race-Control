import { DiscordChannelPurpose, ResultGraphicType } from "@/domain";

export const RESULT_GRAPHIC_DISCORD_MAX_ATTEMPTS = 3;

export function purposeForResultGraphic(type: ResultGraphicType): DiscordChannelPurpose {
  switch (type) {
    case ResultGraphicType.QualifyingClassification:
      return DiscordChannelPurpose.QualifyingResults;
    case ResultGraphicType.RaceClassification:
      return DiscordChannelPurpose.RaceResults;
    case ResultGraphicType.DriverChampionship:
      return DiscordChannelPurpose.DriverStandings;
    case ResultGraphicType.ConstructorChampionship:
      return DiscordChannelPurpose.TeamStandings;
  }
}

export function resultGraphicScopeKeys(leagueId: number): string[] {
  return [`LEAGUE:${leagueId}`];
}

export function resultGraphicDedupeKey(input: { id: number; version: number; renderingVersion: number }): string {
  return `result-graphic:${input.id}:v${input.version}:render-${input.renderingVersion}`;
}
