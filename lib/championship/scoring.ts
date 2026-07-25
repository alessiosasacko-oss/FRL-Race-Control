import {
  ResultSession,
  ResultStatus,
} from "@/domain";

export const DEFAULT_RACE_POINTS = [
  25, 18, 15, 12, 10, 8, 6, 4, 2, 1,
] as const;

export const DEFAULT_SPRINT_POINTS = [8, 7, 6, 5, 4, 3, 2, 1] as const;

export type ScoringRuleSet = {
  fastestLapPoint: number;
  fastestLapRequiresTopPosition: number | null;
  polePositionPoint: number;
  dnfScoresPoints: boolean;
  retiredScoresPoints: boolean;
  minimumClassifiedPercentage: number | null;
  teamPointsEnabled: boolean;
  substituteDriverPointsEnabled: boolean;
};

export type ScorableResult = {
  position: number | null;
  status: ResultStatus;
  fastestLap: boolean;
  polePosition: boolean;
  classifiedPercentage: number | null;
  substitute: boolean;
};

export type AwardedPoints = {
  driverBase: number;
  driverBonus: number;
  teamBase: number;
  teamBonus: number;
};

export function defaultPositionRows(): Array<{
  session: ResultSession;
  position: number;
  points: number;
}> {
  return [
    ...DEFAULT_RACE_POINTS.map((points, index) => ({
      session: ResultSession.Race,
      position: index + 1,
      points,
    })),
    ...DEFAULT_SPRINT_POINTS.map((points, index) => ({
      session: ResultSession.Sprint,
      position: index + 1,
      points,
    })),
  ];
}

export function scoringPositionKey(
  session: ResultSession,
  position: number,
): string {
  return `${session}:${position}`;
}

function resultCanScore(
  result: ScorableResult,
  rules: ScoringRuleSet,
): boolean {
  if (
    result.status === ResultStatus.Dsq ||
    result.status === ResultStatus.Dns
  ) {
    return false;
  }

  if (result.status === ResultStatus.Dnf && !rules.dnfScoresPoints) {
    return false;
  }

  if (
    result.status === ResultStatus.Retired &&
    !rules.retiredScoresPoints
  ) {
    return false;
  }

  return !(
    rules.minimumClassifiedPercentage !== null &&
    (result.classifiedPercentage ?? 0) <
      rules.minimumClassifiedPercentage
  );
}

export function calculateResultPoints(
  result: ScorableResult,
  session: ResultSession,
  rules: ScoringRuleSet,
  positionPoints: ReadonlyMap<string, number>,
  doublePoints: boolean,
): AwardedPoints {
  const canScore = resultCanScore(result, rules);
  const multiplier = doublePoints ? 2 : 1;
  const base =
    canScore && result.position
      ? (positionPoints.get(
          scoringPositionKey(session, result.position),
        ) ?? 0) * multiplier
      : 0;
  const fastestLapEligible =
    canScore &&
    result.fastestLap &&
    (!rules.fastestLapRequiresTopPosition ||
      (result.position !== null &&
        result.position <= rules.fastestLapRequiresTopPosition));
  const bonus =
    ((fastestLapEligible ? rules.fastestLapPoint : 0) +
      (canScore && result.polePosition
        ? rules.polePositionPoint
        : 0)) *
    multiplier;
  const driverEligible =
    !result.substitute || rules.substituteDriverPointsEnabled;

  return {
    driverBase: driverEligible ? base : 0,
    driverBonus: driverEligible ? bonus : 0,
    teamBase: rules.teamPointsEnabled ? base : 0,
    teamBonus: rules.teamPointsEnabled ? bonus : 0,
  };
}

export function parsePointsList(value: string): number[] {
  if (!value.trim()) return [];

  return value.split(",").map((item) => {
    const points = Number(item.trim());

    if (!Number.isFinite(points) || points < 0) {
      throw new Error("INVALID_POINTS_LIST");
    }

    return points;
  });
}
