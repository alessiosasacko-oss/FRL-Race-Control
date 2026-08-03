import { DiscordChannelPurpose } from "@/domain";

export const resultChannelPurposes = [
  DiscordChannelPurpose.QualifyingResults,
  DiscordChannelPurpose.RaceResults,
  DiscordChannelPurpose.SprintResults,
] as const;

export const standingsChannelPurposes = [
  DiscordChannelPurpose.DriverStandings,
  DiscordChannelPurpose.TeamStandings,
] as const;

export type DiscordChannelOption = {
  id: string;
  name: string;
  categoryId: string | null;
  categoryName: string;
  kind: "TEXT" | "ANNOUNCEMENT" | "UNSUPPORTED";
  visible: boolean;
  canSend: boolean;
  canAttach: boolean;
  selectable: boolean;
  unavailableReason: string | null;
};

export type DiscordChannelCatalog = {
  guildId: string;
  guildName: string;
  channels: DiscordChannelOption[];
  loadedAt: string;
};

export type DiscordChannelCatalogState = {
  status: "success" | "error";
  message: string;
  catalog: DiscordChannelCatalog | null;
};

export type ChannelMappingSummaryInput = {
  leagueId: number | null;
  purpose: DiscordChannelPurpose;
  channelId: string;
  enabled: boolean;
};

export type LeagueChannelMatrixRow = {
  leagueId: number;
  leagueCode: string;
  leagueName: string;
  resultChannelId: string | null;
  standingsChannelId: string | null;
  resultInconsistent: boolean;
  standingsInconsistent: boolean;
  resultPurposeCount: number;
  standingsPurposeCount: number;
  suggestedResultChannelId: string | null;
  suggestedStandingsChannelId: string | null;
};

export type DiscordChannelMatrixData = {
  guildSettingsId: number | null;
  guildName: string | null;
  rows: LeagueChannelMatrixRow[];
  channelState: DiscordChannelCatalogState;
};

function summarizePurposeGroup(
  mappings: readonly ChannelMappingSummaryInput[],
  leagueId: number,
  purposes: readonly DiscordChannelPurpose[],
) {
  const group = mappings.filter(
    (mapping) =>
      mapping.enabled &&
      mapping.leagueId === leagueId &&
      purposes.includes(mapping.purpose),
  );
  const channelIds = [...new Set(group.map((mapping) => mapping.channelId))];
  return {
    channelId: channelIds.length === 1 ? channelIds[0] : null,
    inconsistent: channelIds.length > 1,
    purposeCount: new Set(group.map((mapping) => mapping.purpose)).size,
  };
}

function normalizeChannelName(value: string): string {
  return value.toLocaleLowerCase("de-DE").replace(/[^a-z0-9]/g, "");
}

export function suggestLeagueChannel(
  channels: readonly DiscordChannelOption[],
  leagueCode: string,
  kind: "RESULT" | "STANDINGS",
): string | null {
  const code = normalizeChannelName(leagueCode);
  const keywords = kind === "RESULT"
    ? ["ergebnisse", "results", "rennergebnisse", "resultate"]
    : ["tabellen", "wm", "standings", "wertung"];
  const candidates = channels
    .filter((channel) => channel.selectable)
    .map((channel) => {
      const name = normalizeChannelName(channel.name);
      const keywordIndex = keywords.findIndex((keyword) => name.includes(keyword));
      const hasLeague = name.includes(code);
      return {
        id: channel.id,
        score:
          (hasLeague ? 100 : 0) +
          (keywordIndex >= 0 ? 30 - keywordIndex : 0) +
          (name.startsWith(code) ? 10 : 0),
      };
    })
    .filter((candidate) => candidate.score >= 130)
    .sort((left, right) => right.score - left.score || left.id.localeCompare(right.id));
  return candidates[0]?.id ?? null;
}

export function buildLeagueChannelMatrixRows(
  leagues: readonly { id: number; code: string; name: string }[],
  mappings: readonly ChannelMappingSummaryInput[],
  channels: readonly DiscordChannelOption[],
): LeagueChannelMatrixRow[] {
  return leagues.map((league) => {
    const result = summarizePurposeGroup(mappings, league.id, resultChannelPurposes);
    const standings = summarizePurposeGroup(mappings, league.id, standingsChannelPurposes);
    return {
      leagueId: league.id,
      leagueCode: league.code,
      leagueName: league.name,
      resultChannelId: result.channelId,
      standingsChannelId: standings.channelId,
      resultInconsistent: result.inconsistent,
      standingsInconsistent: standings.inconsistent,
      resultPurposeCount: result.purposeCount,
      standingsPurposeCount: standings.purposeCount,
      suggestedResultChannelId: result.channelId || result.inconsistent
        ? null
        : suggestLeagueChannel(channels, league.code, "RESULT"),
      suggestedStandingsChannelId: standings.channelId || standings.inconsistent
        ? null
        : suggestLeagueChannel(channels, league.code, "STANDINGS"),
    };
  });
}

export function groupSelectableChannels(channels: readonly DiscordChannelOption[]) {
  const groups = new Map<string, DiscordChannelOption[]>();
  for (const channel of channels.filter((candidate) => candidate.kind !== "UNSUPPORTED" && candidate.visible)) {
    const group = groups.get(channel.categoryName) ?? [];
    group.push(channel);
    groups.set(channel.categoryName, group);
  }
  return [...groups.entries()]
    .sort(([left], [right]) => left.localeCompare(right, "de"))
    .map(([category, entries]) => ({
      category,
      channels: entries.sort((left, right) => left.name.localeCompare(right.name, "de")),
    }));
}

export function searchDiscordChannels(
  channels: readonly DiscordChannelOption[],
  search: string,
): DiscordChannelOption[] {
  const query = search.trim().toLocaleLowerCase("de-DE");
  if (!query) return [...channels];
  return channels.filter((channel) =>
    `${channel.name} ${channel.categoryName} ${channel.id}`.toLocaleLowerCase("de-DE").includes(query),
  );
}
