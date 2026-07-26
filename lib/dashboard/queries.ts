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
    const league = await prisma.league.findFirst({
      where: { active: true, currentSeasonId: { not: null } },
      orderBy: { code: "asc" },
      select: { id: true, currentSeasonId: true },
    });
    seasonId = league?.currentSeasonId ?? null;
    leagueId = league?.id ?? null;
  }

  const nextRace = await prisma.race.findFirst({
    where: {
      seasonId: seasonId ?? undefined,
      scheduledAt: { gte: new Date() },
      status: { not: "CANCELLED" },
    },
    orderBy: { scheduledAt: "asc" },
    include: {
      season: { select: { id: true, name: true } },
    },
  });
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
      ? prisma.raceAttendance.findUnique({
          where: {
            raceId_driverId: {
              raceId: nextRace.id,
              driverId,
            },
          },
          select: { status: true, changedAt: true },
        })
      : null,
    seasonId && leagueId
      ? prisma.championship.findUnique({
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
                  select: { name: true, color: true },
                },
              },
            },
          },
        })
      : null,
    driverId && seasonId
      ? prisma.raceResult.findFirst({
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
        })
      : null,
    seasonId
      ? prisma.season.findUnique({
          where: { id: seasonId },
          select: {
            id: true,
            name: true,
            races: { select: { status: true } },
          },
        })
      : null,
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
    driverId
      ? prisma.decision.findMany({
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
        })
      : [],
    getRecentNotifications(userId, 5),
  ]);

  const driverStanding =
    driverId && seasonId
      ? await prisma.driverStanding.findFirst({
          where: {
            driverId,
            championship: {
              seasonId,
              leagueId: leagueId ?? undefined,
            },
          },
        })
      : null;
  const teamStanding =
    teamId && seasonId
      ? await prisma.teamStanding.findFirst({
          where: {
            teamId,
            championship: {
              seasonId,
              leagueId: leagueId ?? undefined,
            },
          },
        })
      : null;
  const driverLeader =
    seasonId
      ? await prisma.driverStanding.findFirst({
          where: {
            championship: {
              seasonId,
              leagueId: leagueId ?? undefined,
            },
          },
          orderBy: { position: "asc" },
          select: { points: true },
        })
      : null;
  const teamLeader =
    seasonId
      ? await prisma.teamStanding.findFirst({
          where: {
            championship: {
              seasonId,
              leagueId: leagueId ?? undefined,
            },
          },
          orderBy: { position: "asc" },
          select: { points: true },
        })
      : null;
  const publicTrack = nextRace ? publicRaceTrack(nextRace) : null;
  const deadlinePassed = Boolean(
    nextRace?.attendanceDeadline &&
      nextRace.attendanceDeadline <= new Date(),
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
          scheduledAt: nextRace.scheduledAt.toISOString(),
          timezone: nextRace.timezone,
          sprint: nextRace.sprint,
          mystery: nextRace.mystery,
          attendanceDeadline:
            nextRace.attendanceDeadline?.toISOString() ?? null,
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
          name: standing.team.name,
          color: standing.team.color,
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
