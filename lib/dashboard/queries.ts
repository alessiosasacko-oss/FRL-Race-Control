import "server-only";
import {
  AttendanceStatus,
  PenaltyType,
  penaltyTypeLabels,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { getRecentNotifications, getUnreadNotificationCount } from "@/lib/notifications/queries";
import { publicRaceTrack } from "@/lib/races/visibility";
import { characterView, suitView } from "@/lib/characters/resolve";
import type { DashboardData } from "./types";

async function optionalDashboardData<T>(
  label: string,
  _userId: number,
  load: () => PromiseLike<T>,
  fallback: T,
): Promise<T> {
  try {
    return await load();
  } catch (error: unknown) {
    const reference = crypto.randomUUID();
    console.error(`[dashboard] Unable to load ${label}.`, {
      reference,
      name: error instanceof Error ? error.name : "UnknownError",
      code: typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined,
    });
    return fallback;
  }
}

export async function getDashboardData(
  userId: number,
): Promise<DashboardData> {
  const startedAt = performance.now();
  const prisma = getPrismaClient();
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      displayName: true,
      avatarUrl: true,
      driverCharacter: {
        select: { id: true, configuration: true, normalPose: true, winnerPose: true, version: true, suitVariantId: true },
      },
      driver: {
        select: {
          id: true,
          name: true,
          number: true,
          flag: true,
          seasonAssignments: {
            where: { active: true, season: { active: true, archivedAt: null } },
            orderBy: { seasonId: "desc" },
            take: 1,
            select: {
              lineupStatus: true,
              organization: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  color: true,
                  secondaryColor: true,
                  contrastColor: true,
                  logoUrl: true,
                  suitTemplates: {
                    where: { active: true, archivedAt: null },
                    orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
                    select: { id: true, organizationId: true, name: true, configuration: true },
                  },
                },
              },
            },
          },
          league: {
            select: {
              id: true,
              code: true,
              name: true,
              currentSeasonId: true,
            },
          },
          team: {
            select: {
              id: true,
              name: true,
              shortName: true,
              color: true,
              logoUrl: true,
              seasonId: true,
              organization: {
                select: { id: true, name: true, shortName: true, color: true, logoUrl: true },
              },
              season: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");
  const character = characterView(user.driverCharacter);
  const characterOrganization = user.driver?.seasonAssignments[0]?.organization ?? null;
  const selectedSuit = characterOrganization?.suitTemplates.find((template) => template.id === character.suitVariantId) ?? null;
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
    unreadNotificationCount,
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
                        logoUrl: true,
                        organization: {
                          select: { name: true, color: true, logoUrl: true },
                        },
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
    optionalDashboardData(
      "unread notification count",
      userId,
      () => getUnreadNotificationCount(userId),
      0,
    ),
  ]);

  const [driverStanding, teamStanding, driverLeader, teamLeader] = await Promise.all([
    driverId && seasonId
      ? optionalDashboardData(
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
      : null,
    teamId && seasonId
      ? optionalDashboardData(
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
      : null,
    seasonId
      ? optionalDashboardData(
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
      : null,
    seasonId
      ? optionalDashboardData(
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
      : null,
  ]);
  const publicTrack = nextRace ? publicRaceTrack(nextRace) : null;
  const deadlinePassed = Boolean(
    (nextSchedule?.attendanceDeadline ??
      nextRace?.attendanceDeadline) &&
      (nextSchedule?.attendanceDeadline ??
        nextRace?.attendanceDeadline)! <= new Date(),
  );

  const data: DashboardData = {
    identity: {
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
      character,
      teamSuit: suitView(selectedSuit, characterOrganization),
      driver: user.driver
        ? {
            id: user.driver.id,
            name: user.driver.name,
            number: user.driver.number,
            flag: user.driver.flag,
            lineupStatus: user.driver.seasonAssignments[0]?.lineupStatus ?? "PRIMARY",
            team: user.driver.team
              ? {
                  id: user.driver.team.organization?.id ?? user.driver.team.id,
                  name: user.driver.team.organization?.name ?? user.driver.team.name,
                  shortName: user.driver.team.organization?.shortName ?? user.driver.team.shortName,
                  color: user.driver.team.organization?.color ?? user.driver.team.color,
                  logoUrl: user.driver.team.organization?.logoUrl ?? user.driver.team.logoUrl,
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
            wins: driverStanding.wins,
            podiums: driverStanding.podiums,
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
          logoUrl:
            standing.team.organization?.logoUrl ?? standing.team.logoUrl,
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
    unreadNotificationCount,
  };
  console.info("[dashboard] query completed", {
    durationMs: Math.round(performance.now() - startedAt),
    subqueryCount: 14,
  });
  return data;
}
