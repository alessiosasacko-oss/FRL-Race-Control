import "server-only";

import {
  Prisma,
  ResultPublicationStatus,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { calculateAutomaticCareerStats } from "./career-stats-calculation";

type CareerStatsDatabase = Pick<Prisma.TransactionClient, "driver" | "raceResult" | "driverCareerStats">;

export type DriverCareerStatsView = {
  raceStarts: number;
  wins: number;
  podiums: number;
  poles: number;
  fastestLaps: number;
  points: number;
  firstGrandPrix: string | null;
  pastTeams: string[];
  automatic: {
    raceStarts: number;
    wins: number;
    podiums: number;
    poles: number;
    fastestLaps: number;
    points: number;
    firstGrandPrix: string | null;
    pastTeams: string[];
  };
  adjustments: {
    raceStarts: number;
    wins: number;
    podiums: number;
    poles: number;
    fastestLaps: number;
    points: number;
  };
  manualFirstGrandPrix: string | null;
  manualPastTeams: string[];
  reconciledAt: string | null;
};

function stringList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))];
}

function nonNegative(value: number): number {
  return Math.max(0, value);
}

export function careerStatsView(stats: {
  autoRaceStarts: number;
  autoWins: number;
  autoPodiums: number;
  autoPoles: number;
  autoFastestLaps: number;
  autoPoints: number;
  manualRaceStartsAdjustment: number;
  manualWinsAdjustment: number;
  manualPodiumsAdjustment: number;
  manualPolesAdjustment: number;
  manualFastestLapsAdjustment: number;
  manualPointsAdjustment: number;
  autoFirstGrandPrix: string | null;
  manualFirstGrandPrix: string | null;
  autoPastTeams: unknown;
  manualPastTeams: unknown;
  reconciledAt: Date | null;
} | null | undefined): DriverCareerStatsView {
  const automatic = {
    raceStarts: stats?.autoRaceStarts ?? 0,
    wins: stats?.autoWins ?? 0,
    podiums: stats?.autoPodiums ?? 0,
    poles: stats?.autoPoles ?? 0,
    fastestLaps: stats?.autoFastestLaps ?? 0,
    points: stats?.autoPoints ?? 0,
    firstGrandPrix: stats?.autoFirstGrandPrix ?? null,
    pastTeams: stringList(stats?.autoPastTeams),
  };
  const adjustments = {
    raceStarts: stats?.manualRaceStartsAdjustment ?? 0,
    wins: stats?.manualWinsAdjustment ?? 0,
    podiums: stats?.manualPodiumsAdjustment ?? 0,
    poles: stats?.manualPolesAdjustment ?? 0,
    fastestLaps: stats?.manualFastestLapsAdjustment ?? 0,
    points: stats?.manualPointsAdjustment ?? 0,
  };
  const manualPastTeams = stringList(stats?.manualPastTeams);
  return {
    raceStarts: nonNegative(automatic.raceStarts + adjustments.raceStarts),
    wins: nonNegative(automatic.wins + adjustments.wins),
    podiums: nonNegative(automatic.podiums + adjustments.podiums),
    poles: nonNegative(automatic.poles + adjustments.poles),
    fastestLaps: nonNegative(automatic.fastestLaps + adjustments.fastestLaps),
    points: nonNegative(automatic.points + adjustments.points),
    firstGrandPrix: automatic.firstGrandPrix ?? stats?.manualFirstGrandPrix ?? null,
    pastTeams: [...new Set([...automatic.pastTeams, ...manualPastTeams])].sort((a, b) => a.localeCompare(b, "de")),
    automatic,
    adjustments,
    manualFirstGrandPrix: stats?.manualFirstGrandPrix ?? null,
    manualPastTeams,
    reconciledAt: stats?.reconciledAt?.toISOString() ?? null,
  };
}

export async function reconcileDriverCareerStats(
  driverId: number,
  database: CareerStatsDatabase = getPrismaClient(),
) {
  const [driver, results] = await Promise.all([
    database.driver.findUnique({
      where: { id: driverId },
      select: {
        id: true,
        team: { select: { organizationId: true, name: true, organization: { select: { id: true, name: true } } } },
        seasonAssignments: {
          orderBy: { season: { startsOn: "asc" } },
          select: { active: true, organization: { select: { id: true, name: true } } },
        },
        standings: { select: { points: true, championship: { select: { seasonId: true } } } },
      },
    }),
    database.raceResult.findMany({
      where: {
        driverId,
        resultSession: { publicationStatus: ResultPublicationStatus.PUBLISHED },
      },
      orderBy: { resultSession: { race: { scheduledAt: "asc" } } },
      select: {
        position: true,
        finalPosition: true,
        baseStatus: true,
        fastestLap: true,
        racePoints: true,
        bonusPoints: true,
        representedTeam: { select: { name: true, organization: { select: { id: true, name: true } } } },
        resultSession: {
          select: {
            session: true,
            race: { select: { seasonId: true, round: true, name: true, scheduledAt: true, season: { select: { name: true } } } },
          },
        },
      },
    }),
  ]);
  if (!driver) return null;

  const currentOrganizationId = driver.team?.organizationId ?? driver.seasonAssignments.find((assignment) => assignment.active)?.organization?.id ?? null;
  const currentTeamName = driver.team?.organization?.name ?? driver.team?.name ?? null;
  const automatic = {
    ...calculateAutomaticCareerStats({
      results,
      standings: driver.standings.map((standing) => ({ points: standing.points, seasonId: standing.championship.seasonId })),
      assignments: driver.seasonAssignments,
      currentOrganizationId,
      currentTeamName,
    }),
    reconciledAt: new Date(),
  };

  return database.driverCareerStats.upsert({
    where: { driverId },
    create: { driverId, ...automatic },
    update: automatic,
  });
}

export async function reconcileDriverCareerStatsMany(driverIds: readonly number[]) {
  const unique = [...new Set(driverIds.filter((id) => Number.isInteger(id) && id > 0))];
  await Promise.all(unique.map((driverId) => reconcileDriverCareerStats(driverId)));
}
