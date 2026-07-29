import { ResultSession } from "@/domain";

export type GlobalWeekendBlockReason =
  | "NO_ACTIVE_LEAGUES"
  | "RESULTS_INCOMPLETE"
  | "FIA_TICKETS_OPEN"
  | "FIA_PENALTIES_NOT_APPLIED"
  | "TEAM_ORGANIZATION_MISSING";

export function globalWeekendBlockReason(input: {
  activeLeagueIds: readonly number[];
  requiredSessions: readonly ResultSession[];
  publishedSessionKeys: ReadonlySet<string>;
  openTicketCount: number;
  unappliedPenaltyCount: number;
  unmappedTeamIds: readonly number[];
}): GlobalWeekendBlockReason | null {
  if (input.activeLeagueIds.length === 0) return "NO_ACTIVE_LEAGUES";
  const complete = input.activeLeagueIds.every((leagueId) =>
    input.requiredSessions.every((session) =>
      input.publishedSessionKeys.has(`${leagueId}:${session}`),
    ),
  );
  if (!complete) return "RESULTS_INCOMPLETE";
  if (input.openTicketCount > 0) return "FIA_TICKETS_OPEN";
  if (input.unappliedPenaltyCount > 0) {
    return "FIA_PENALTIES_NOT_APPLIED";
  }
  if (input.unmappedTeamIds.length > 0) {
    return "TEAM_ORGANIZATION_MISSING";
  }
  return null;
}

export type GlobalContributionInput = {
  organizationId: number;
  leagueId: number;
  session: ResultSession;
  points: number;
};

export type GlobalContribution = {
  organizationId: number;
  leagueId: number;
  racePoints: number;
  sprintPoints: number;
  points: number;
};

export function aggregateGlobalContributions(
  rows: readonly GlobalContributionInput[],
): GlobalContribution[] {
  const byKey = new Map<string, GlobalContribution>();
  for (const row of rows) {
    const key = `${row.organizationId}:${row.leagueId}`;
    const contribution = byKey.get(key) ?? {
      organizationId: row.organizationId,
      leagueId: row.leagueId,
      racePoints: 0,
      sprintPoints: 0,
      points: 0,
    };
    if (row.session === ResultSession.Race) {
      contribution.racePoints += row.points;
    }
    if (row.session === ResultSession.Sprint) {
      contribution.sprintPoints += row.points;
    }
    contribution.points += row.points;
    byKey.set(key, contribution);
  }
  return [...byKey.values()].sort(
    (left, right) =>
      left.organizationId - right.organizationId ||
      left.leagueId - right.leagueId,
  );
}

export type GlobalStandingAggregate = {
  organizationId: number;
  organizationName: string;
  racePoints: number;
  sprintPoints: number;
  points: number;
  leagueIds: ReadonlySet<number>;
  raceIds: ReadonlySet<number>;
};

export function rankGlobalStandings(
  rows: readonly GlobalStandingAggregate[],
): Array<GlobalStandingAggregate & { position: number }> {
  return [...rows]
    .sort(
      (left, right) =>
        right.points - left.points ||
        right.racePoints - left.racePoints ||
        left.organizationName.localeCompare(
          right.organizationName,
          "de-DE",
        ) ||
        left.organizationId - right.organizationId,
    )
    .map((row, index) => ({ ...row, position: index + 1 }));
}
