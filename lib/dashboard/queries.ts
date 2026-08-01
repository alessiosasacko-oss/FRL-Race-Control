import "server-only";
import {
  AttendanceStatus,
  PenaltyType,
  penaltyTypeLabels,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { getRecentNotifications } from "@/lib/notifications/queries";
import { publicRaceTrack } from "@/lib/races/visibility";
import type { DashboardData } from "./types";

async function optionalDashboardData<T>(
  label: string,
  userId: number,
  load: () => PromiseLike<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch (error: unknown) {
    console.error(`[dashboard] Unable to load ${label}.`, {
      userId,
      error:
        error instanceof Error
          ? { name: error.name, message: error.message }
          : "Unknown error",
    });
    return fallback;
  }
}

export async function getDashboardData(
  userId: number,
): Promise<DashboardData> {
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      driver: {
        include: {
          league: {
            select: {
              id: true,
              code: true,
              name: true,
              currentSeasonId: true,
            },
          },
          team: {
            include: {
              season: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  let leagueId = user.driver?.league.id ?? null;

  let seasonId =
    user.driver?.team?.seasonId ??
    user.driver?.league.currentSeasonId ??
    null;
  if (!seasonId) {
    const league = await optionalDashboardData(
      "active league fallback",
      userId,
      () =>
        prisma.league.findFirst({
          where: { active: true, currentSeasonId: { not: null } },
          orderBy: { code: "asc" },
          select: { id: true, currentSeasonId: true },
        }),
      null,
    );
    seasonId = league?.currentSeasonId ?? null;
    leagueId = league?.id ?? null;
  }

  const nextSchedule = leagueId
    ? await optionalDashboardData(
        "next league race schedule",
        userId,
        () =>
          prisma.raceLeagueSchedule.findFirst({
            where: {
              leagueId,
              scheduledAt: { gte: new Date() },
              race: {
                seasonId: seasonId ?? undefined,
                status: { not: "CANCELLED" },
              },
            },
            orderBy: { scheduledAt: "asc" },
            include: {
              race: {
                include: {
                  season: { select: { id: true, name: true } },
                },
              },
            },
          }),
        null,
      )
    : null;
  const fallbackRace = !nextSchedule
    ? await optionalDashboardData(
        "next race fallback",
        userId,
        () =>
          prisma.race.findFirst({
            where: {
              seasonId: seasonId ?? undefined,
              scheduledAt: { gte: new Date() },
              status: { not: "CANCELLED" },
            },
            orderBy: { scheduledAt: "asc" },
            include: {
              season: { select: { id: true, name: true } },
            },
          }),
        null,
      )
    : null;
  const nextRace = nextSchedule?.race ?? fallbackRace;
  if (!seasonId && nextRace) seasonId = nextRace.seasonId;

  const driverId = user.driver?.id;
  const teamId =
    user.driver?.team?.seasonId === seasonId
      ? user.driver.team.id
      : null;

  const [
    attendance,
    championship,
    lastResult,
    seasonProgress,
    openTickets,
    latestDecisions,
    penalties,
    notifications,
  ] = await Promise.all([
    nextRace && driverId
      ? optionalDashboardData(
          "attendance",
          userId,
          () =>
            prisma.raceAttendance.findUnique({
              where: {
                raceId_driverId: {
                  raceId: nextRace.id,
                  driverId,
                },
              },
              select: { status: true, changedAt: true },
            }),
          null,
        )
      : null,
    seasonId && leagueId
      ? optionalDashboardData(
          "championship preview",
          userId,
          () =>
            prisma.championship.findUnique({
              where: {
                leagueId_seasonId: { leagueId, seasonId },
              },
              include: {
                driverStandings: {
                  orderBy: { position: "asc" },
                  take: 5,
                  include: {
                    driver: {
                      select: { name: true, flag: true },
                    },
                  },
                },
                teamStandings: {
                  orderBy: { position: "asc" },
                  take: 5,
                  include: {
                    team: {
                      select: {
                        name: true,
                        color: true,
                        organization: { select: { name: true, color: true } },
                      },
                    },
                  },
                },
              },
            }),
          null,
        )
      : null,
    driverId && seasonId
      ? optionalDashboardData(
          "latest race result",
          userId,
          () =>
            prisma.raceResult.findFirst({
              where: {
                driverId,
                resultSession: {
                  leagueId: leagueId ?? undefined,
                  session: "RACE",
                  race: { seasonId },
                },
              },
              orderBy: {
                resultSession: { race: { scheduledAt: "desc" } },
              },
              select: { racePoints: true, bonusPoints: true },
            }),
          null,
        )
      : null,
    seasonId
      ? optionalDashboardData(
          "season progress",
          userId,
          () =>
            prisma.season.findUnique({
              where: { id: seasonId },
              select: {
                id: true,
                name: true,
                races: { select: { status: true } },
              },
            }),
          null,
        )
      : null,
    optionalDashboardData(
      "open FIA ticket count",
      userId,
      () =>
        prisma.fiaTicket.count({
          where: {
            status: { not: "RESOLVED" },
            OR: [
              { reportedByUserId: userId },
              { stewardAssignments: { some: { userId } } },
              ...(driverId
                ? [{ drivers: { some: { driverId } } }]
                : []),
            ],
          },
        }),
      0,
    ),
    optionalDashboardData(
      "latest FIA decisions",
      userId,
      () =>
        prisma.decision.findMany({
          where: {
            ticket: {
              OR: [
                { reportedByUserId: userId },
                { stewardAssignments: { some: { userId } } },
                ...(driverId
                  ? [{ drivers: { some: { driverId } } }]
                  : []),
              ],
            },
          },
          orderBy: { decidedAt: "desc" },
          take: 3,
          include: {
            ticket: { select: { id: true, title: true } },
          },
        }),
      [],
    ),
    driverId
      ? optionalDashboardData(
          "current FIA penalties",
          userId,
          () =>
            prisma.decision.findMany({
              where: {
                penaltyType: {
                  not: "NO_FURTHER_ACTION",
                },
                ticket: { drivers: { some: { driverId } } },
              },
              orderBy: { decidedAt: "desc" },
              take: 3,
              include: {
                ticket: { select: { id: true, title: true } },
              },
            }),
          [],
        )
      : [],
    optionalDashboardData(
      "recent notifications",
      userId,
      () => getRecentNotifications(userId, 5),
      [],
    ),
  ]);

  const driverStanding =
    driverId && seasonId
      ? await optionalDashboardData(
          "driver standing",
          userId,
          () =>
            prisma.driverStanding.findFirst({
              where: {
                driverId,
                championship: {
                  seasonId,
                  leagueId: leagueId ?? undefined,
                },
              },
            }),
          null,
        )
      : null;
  const teamStanding =
    teamId && seasonId
      ? await optionalDashboardData(
          "team standing",
          userId,
          () =>
            prisma.teamStanding.findFirst({
              where: {
                teamId,
                championship: {
                  seasonId,
                  leagueId: leagueId ?? undefined,
                },
              },
            }),
          null,
        )
      : null;
  const driverLeader = seasonId
    ? await optionalDashboardData(
        "driver championship leader",
        userId,
        () =>
          prisma.driverStanding.findFirst({
            where: {
              championship: {
                seasonId,
                leagueId: leagueId ?? undefined,
              },
            },
            orderBy: { position: "asc" },
            select: { points: true },
          }),
        null,
      )
    : null;
  const teamLeader = seasonId
    ? await optionalDashboardData(
        "team championship leader",
        userId,
        () =>
          prisma.teamStanding.findFirst({
            where: {
              championship: {
                seasonId,
                leagueId: leagueId ?? undefined,
              },
            },
            orderBy: { position: "asc" },
            select: { points: true },
          }),
        null,
      )
    : null;
  const publicTrack = nextRace ? publicRaceTrack(nextRace) : null;
  const deadlinePassed = Boolean(
    (nextSchedule?.attendanceDeadline ??
      nextRace?.attendanceDeadline) &&
      (nextSchedule?.attendanceDeadline ??
        nextRace?.attendanceDeadline)! <= new Date(),
  );

  return {
    identity: {
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      driver: user.driver
        ? {
            id: user.driver.id,
            name: user.driver.name,
            number: user.driver.number,
            flag: user.driver.flag,
            team: user.driver.team
              ? {
                  id: user.driver.team.id,
                  name: user.driver.team.name,
                  color: user.driver.team.color,
                }
              : null,
            league: {
              id: user.driver.league.id,
              code: user.driver.league.code,
              name: user.driver.league.name,
            },
          }
        : null,
      season: seasonProgress
        ? { id: seasonProgress.id, name: seasonProgress.name }
        : user.driver?.team?.season ?? null,
    },
    nextRace: nextRace
      ? {
          id: nextRace.id,
          name: publicTrack?.name ?? "Mystery Track",
          circuit: publicTrack?.circuit ?? "Mystery Track",
          round: nextRace.round,
          scheduledAt: (
            nextSchedule?.scheduledAt ?? nextRace.scheduledAt
          ).toISOString(),
          timezone: nextSchedule?.timezone ?? nextRace.timezone,
          sprint: nextRace.sprint,
          mystery: nextRace.mystery,
          attendanceDeadline:
            (
              nextSchedule?.attendanceDeadline ??
              nextRace.attendanceDeadline
            )?.toISOString() ?? null,
        }
      : null,
    attendance:
      nextRace && driverId
        ? {
            status: (attendance?.status ??
              AttendanceStatus.NoResponse) as AttendanceStatus,
            changedAt: attendance?.changedAt.toISOString() ?? null,
            canChange: !deadlinePassed,
          }
        : null,
    championship: {
      driver: driverStanding
        ? {
            position: driverStanding.position,
            points: driverStanding.points,
            gapToLeader: Math.max(
              0,
              (driverLeader?.points ?? driverStanding.points) -
                driverStanding.points,
            ),
            lastRacePoints:
              (lastResult?.racePoints ?? 0) +
              (lastResult?.bonusPoints ?? 0),
          }
        : null,
      team: teamStanding
        ? {
            position: teamStanding.position,
            points: teamStanding.points,
            gapToLeader: Math.max(
              0,
              (teamLeader?.points ?? teamStanding.points) -
                teamStanding.points,
            ),
          }
        : null,
      topDrivers:
        championship?.driverStandings.map((standing) => ({
          position: standing.position,
          name: standing.driver.name,
          flag: standing.driver.flag,
          points: standing.points,
        })) ?? [],
      topTeams:
        championship?.teamStandings.map((standing) => ({
          position: standing.position,
          name: standing.team.organization?.name ?? standing.team.name,
          color: standing.team.organization?.color ?? standing.team.color,
          points: standing.points,
        })) ?? [],
    },
    seasonProgress: seasonProgress
      ? {
          completed: seasonProgress.races.filter(
            (race) => race.status === "COMPLETED",
          ).length,
          total: seasonProgress.races.length,
        }
      : null,
    fia: {
      openTickets,
      latestDecisions: latestDecisions.map((decision) => ({
        id: decision.id,
        ticketId: decision.ticket.id,
        title: decision.ticket.title,
        penalty:
          penaltyTypeLabels[decision.penaltyType as PenaltyType],
        decidedAt: decision.decidedAt.toISOString(),
      })),
      currentPenalties: penalties.map((decision) => ({
        ticketId: decision.ticket.id,
        title: decision.ticket.title,
        penalty:
          penaltyTypeLabels[decision.penaltyType as PenaltyType],
      })),
    },
    notifications,
  };
}
