import { ResultSession, ResultStatus } from "@/generated/prisma/client";

export type CareerResultInput = {
  position: number | null;
  finalPosition: number | null;
  baseStatus: ResultStatus;
  fastestLap: boolean;
  racePoints: number;
  bonusPoints: number;
  representedTeam: { name: string; organization: { id: number; name: string } | null };
  resultSession: {
    session: ResultSession;
    race: { seasonId: number; round: number; name: string; season: { name: string } };
  };
};

export type CareerAssignmentInput = {
  active: boolean;
  organization: { id: number; name: string } | null;
};

export function calculateAutomaticCareerStats(input: {
  results: readonly CareerResultInput[];
  standings: readonly { points: number; seasonId: number }[];
  assignments: readonly CareerAssignmentInput[];
  currentOrganizationId: number | null;
  currentTeamName: string | null;
}) {
  const races = input.results.filter((result) => result.resultSession.session === ResultSession.RACE);
  const starts = races.filter((result) => result.baseStatus !== ResultStatus.DNS);
  const classificationEligible = starts.filter((result) => result.baseStatus !== ResultStatus.DSQ);
  const pointResults = input.results.filter((result) =>
    result.resultSession.session === ResultSession.RACE || result.resultSession.session === ResultSession.SPRINT,
  );
  const seasonsWithPublishedResults = new Set(pointResults.map((result) => result.resultSession.race.seasonId));
  const fallbackStandingPoints = input.standings
    .filter((standing) => !seasonsWithPublishedResults.has(standing.seasonId))
    .reduce((sum, standing) => sum + standing.points, 0);
  const finishingPosition = (result: CareerResultInput) => result.finalPosition ?? result.position;

  const teamNames = new Map<number | string, string>();
  for (const result of input.results) {
    const organization = result.representedTeam.organization;
    teamNames.set(organization?.id ?? `team:${result.representedTeam.name}`, organization?.name ?? result.representedTeam.name);
  }
  for (const assignment of input.assignments) {
    if (assignment.organization) teamNames.set(assignment.organization.id, assignment.organization.name);
  }
  if (input.currentOrganizationId !== null) teamNames.delete(input.currentOrganizationId);
  if (input.currentTeamName) {
    for (const [key, value] of teamNames) if (value === input.currentTeamName) teamNames.delete(key);
  }

  const firstStart = starts[0];
  return {
    autoRaceStarts: starts.length,
    autoWins: classificationEligible.filter((result) => finishingPosition(result) === 1).length,
    autoPodiums: classificationEligible.filter((result) => {
      const position = finishingPosition(result);
      return position !== null && position >= 1 && position <= 3;
    }).length,
    autoPoles: input.results.filter((result) => result.resultSession.session === ResultSession.QUALIFYING && result.baseStatus !== ResultStatus.DNS && result.baseStatus !== ResultStatus.DSQ && finishingPosition(result) === 1).length,
    autoFastestLaps: races.filter((result) => result.fastestLap && result.baseStatus !== ResultStatus.DNS && result.baseStatus !== ResultStatus.DSQ).length,
    autoPoints: pointResults.reduce((sum, result) => sum + result.racePoints + result.bonusPoints, 0) + fallbackStandingPoints,
    autoFirstGrandPrix: firstStart
      ? `${firstStart.resultSession.race.season.name} R${firstStart.resultSession.race.round} ${firstStart.resultSession.race.name}`
      : null,
    autoPastTeams: [...teamNames.values()].sort((a, b) => a.localeCompare(b, "de")),
  };
}
