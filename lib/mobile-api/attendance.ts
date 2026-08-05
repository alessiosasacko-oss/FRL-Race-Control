import "server-only";

import type { Prisma } from "@/generated/prisma/client";
import {
  AttendanceChangeSource,
  AttendanceStatus,
  RaceStatus,
  Role,
  attendanceStatusLabels,
  roleSchema,
} from "@/domain";
import {
  AttendanceServiceError,
  changeDriverAttendance,
} from "@/lib/attendance/service";
import { getAttendanceWindowState } from "@/lib/attendance/policy";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  MobileAuthError,
} from "@/lib/mobile-api/auth/errors";
import {
  requireMobileUser,
} from "@/lib/mobile-api/auth/mobile-user";
import { MobileApiError } from "@/lib/mobile-api/errors";
import { serializeCalendarRace } from "@/lib/mobile-api/serialization";
import type {
  MobileAttendanceDetail,
  MobileAttendanceRace,
  MobileLeagueRef,
} from "@/lib/mobile-api/types";

export type MobileAttendanceIdentity = {
  userId: number;
  driverId: number;
  roles: readonly Role[];
};

export async function requireMobileAttendanceUser(
  request: Request,
): Promise<MobileAttendanceIdentity> {
  let context;
  try {
    context = await requireMobileUser(request, { allowIneligible: true });
  } catch (error) {
    if (error instanceof MobileAuthError) {
      throw new MobileApiError(
        401,
        "AUTH_REQUIRED",
        "Eine gültige Mobile-Anmeldung ist erforderlich.",
      );
    }
    throw error;
  }

  if (!context.user.active) {
    throw new MobileApiError(
      403,
      "USER_INACTIVE",
      "Dein Benutzerkonto ist nicht aktiv.",
    );
  }
  if (context.user.lockedAt !== null) {
    throw new MobileApiError(
      403,
      "USER_LOCKED",
      "Dein Benutzerkonto ist gesperrt.",
    );
  }
  const roles = roleSchema.array().parse(context.user.roles);
  if (
    !context.user.driver ||
    !context.user.driver.active ||
    !roles.includes(Role.Driver)
  ) {
    throw new MobileApiError(
      403,
      "DRIVER_PROFILE_REQUIRED",
      "Ein aktives Fahrerprofil ist erforderlich.",
    );
  }

  return {
    userId: context.user.id,
    driverId: context.user.driver.id,
    roles,
  };
}

async function getMobileAttendanceDriver(driverId: number) {
  return getPrismaClient().driver.findUnique({
    where: { id: driverId },
    select: {
      id: true,
      userId: true,
      name: true,
      number: true,
      flag: true,
      countryCode: true,
      active: true,
      leagueId: true,
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
          logoUrl: true,
          seasonId: true,
          leagueId: true,
        },
      },
      seasonAssignments: {
        where: { active: true },
        orderBy: [{ season: { startsOn: "desc" } }, { id: "desc" }],
        select: {
          seasonId: true,
          leagueId: true,
          organization: {
            select: {
              teams: {
                where: { active: true, archivedAt: null },
                select: {
                  id: true,
                  name: true,
                  logoUrl: true,
                  seasonId: true,
                  leagueId: true,
                },
              },
            },
          },
          season: {
            select: {
              id: true,
              name: true,
              active: true,
              archivedAt: true,
            },
          },
        },
      },
    },
  });
}

type MobileAttendanceDriver = NonNullable<
  Awaited<ReturnType<typeof getMobileAttendanceDriver>>
>;

async function requireAttendanceDriver(
  identity: MobileAttendanceIdentity,
): Promise<MobileAttendanceDriver> {
  const driver = await getMobileAttendanceDriver(identity.driverId);
  if (
    !driver ||
    !driver.active ||
    driver.userId !== identity.userId
  ) {
    throw new MobileApiError(
      403,
      "DRIVER_PROFILE_REQUIRED",
      "Ein aktives Fahrerprofil ist erforderlich.",
    );
  }
  return driver;
}

function attendanceScheduleSelect(driverId: number, leagueId: number) {
  return {
    id: true,
    leagueId: true,
    scheduledAt: true,
    timezone: true,
    attendanceDeadline: true,
    createdAt: true,
    league: { select: { id: true, code: true, name: true } },
    race: {
      select: {
        id: true,
        name: true,
        circuit: true,
        countryCode: true,
        round: true,
        weekendDate: true,
        scheduledAt: true,
        timezone: true,
        status: true,
        sessions: true,
        sprint: true,
        mystery: true,
        seasonId: true,
        season: { select: { id: true, name: true } },
        track: {
          select: {
            id: true,
            name: true,
            countryCode: true,
            lengthKm: true,
            lapCount: true,
            sectorCount: true,
            smStraightModeZones: true,
            longestStraightM: true,
            poleSide: true,
            pitLaneLossSeconds: true,
            visual: { select: { layoutAsset: true } },
          },
        },
        resultSessions: {
          where: { leagueId, publicationStatus: "PUBLISHED" as const },
          select: { session: true, publicationStatus: true },
        },
        attendanceEntries: {
          where: {
            OR: [
              { driverId },
              { substituteDriverId: driverId },
            ] as Prisma.RaceAttendanceWhereInput[],
          },
          select: {
            driverId: true,
            substituteDriverId: true,
            status: true,
            changeSource: true,
            changedAt: true,
            driver: {
              select: { id: true, name: true },
            },
            substituteDriver: {
              select: { id: true, name: true, number: true, flag: true },
            },
            representedTeam: {
              select: { id: true, name: true },
            },
          },
        },
      },
    },
  } as const;
}

async function findMobileAttendanceSchedules(input: {
  driverId: number;
  leagueId: number;
  seasonId: number;
  status?: `${RaceStatus}`;
  upcoming?: boolean;
  now: Date;
}) {
  const earliest = input.upcoming
    ? input.now
    : new Date(input.now.getTime() - 30 * 24 * 60 * 60 * 1_000);
  const latest = new Date(
    input.now.getTime() + 180 * 24 * 60 * 60 * 1_000,
  );
  return getPrismaClient().raceLeagueSchedule.findMany({
    where: {
      leagueId: input.leagueId,
      scheduledAt: { gte: earliest, lte: latest },
      race: {
        seasonId: input.seasonId,
        status: input.status,
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { raceId: "asc" }],
    take: 40,
    select: attendanceScheduleSelect(input.driverId, input.leagueId),
  });
}

type MobileAttendanceSchedule = Awaited<
  ReturnType<typeof findMobileAttendanceSchedules>
>[number];

function mobileLeagueRef(league: {
  id: number;
  code: string;
  name: string;
}): MobileLeagueRef {
  return { id: league.id, code: league.code, name: league.name };
}

function serializeMobileAttendance(
  schedule: MobileAttendanceSchedule,
  driver: MobileAttendanceDriver,
  now: Date,
): MobileAttendanceRace {
  const calendar = serializeCalendarRace(
    schedule.race,
    mobileLeagueRef(schedule.league),
    schedule.race.season,
    {
      scheduledAt: schedule.scheduledAt,
      timezone: schedule.timezone,
      now,
    },
  );
  const ownAttendance = schedule.race.attendanceEntries.find(
    (entry) => entry.driverId === driver.id,
  );
  const substituteAssignment = schedule.race.attendanceEntries.find(
    (entry) =>
      entry.substituteDriverId === driver.id &&
      entry.driverId !== driver.id,
  );
  const status = (ownAttendance?.status ??
    AttendanceStatus.NoResponse) as AttendanceStatus;
  const window = getAttendanceWindowState(
    {
      raceStatus: schedule.race.status as RaceStatus,
      scheduledAt: schedule.scheduledAt,
      opensAt: schedule.createdAt,
      closesAt: schedule.attendanceDeadline,
    },
    now,
  );
  const availableResponses = substituteAssignment
    ? ([AttendanceStatus.Declined] as const)
    : ([AttendanceStatus.Registered, AttendanceStatus.Declined] as const);

  return {
    raceId: calendar.id,
    league: calendar.league,
    season: calendar.season,
    round: calendar.round,
    raceName: calendar.name,
    circuit: calendar.circuit,
    country: calendar.country,
    countryCode: calendar.countryCode,
    track: calendar.track,
    isMysteryRace: calendar.isMysteryRace,
    mysteryRevealed: calendar.mysteryRevealed,
    revealAt: calendar.revealAt,
    weekendDate: calendar.weekendDate,
    scheduledAt: calendar.scheduledAt,
    timezone: calendar.timezone,
    opensAt: window.opensAt,
    closesAt: window.closesAt,
    windowStatus: window.status,
    windowMessage: window.message,
    remainingSeconds: window.remainingSeconds,
    status,
    statusLabel: attendanceStatusLabels[status],
    changedAt: ownAttendance?.changedAt.toISOString() ?? null,
    changeSource:
      (ownAttendance?.changeSource as AttendanceChangeSource | undefined) ??
      null,
    canRespond: window.canRespond,
    cannotRespondReason: window.canRespond ? null : window.message,
    resultPublished: calendar.resultPublished,
    raceCancelled: schedule.race.status === RaceStatus.Cancelled,
    sprintWeekend: calendar.sprint,
    availableResponses: [...availableResponses],
    replacement: ownAttendance?.substituteDriver
      ? {
          substituteDriver: {
            id: ownAttendance.substituteDriver.id,
            displayName: ownAttendance.substituteDriver.name,
            number: ownAttendance.substituteDriver.number,
            flag: ownAttendance.substituteDriver.flag,
          },
          representedTeam: ownAttendance.representedTeam,
        }
      : null,
    substituteAssignment: substituteAssignment
      ? {
          expectedDriver: {
            id: substituteAssignment.driver.id,
            displayName: substituteAssignment.driver.name,
          },
          representedTeam: substituteAssignment.representedTeam,
        }
      : null,
  };
}

function currentTeamForSeason(
  driver: MobileAttendanceDriver,
  seasonId: number,
) {
  if (
    driver.team?.seasonId === seasonId &&
    driver.team.leagueId === driver.leagueId
  ) {
    return driver.team;
  }
  const assignment = driver.seasonAssignments.find(
    (item) =>
      item.seasonId === seasonId && item.leagueId === driver.leagueId,
  );
  return (
    assignment?.organization?.teams.find(
      (team) =>
        team.seasonId === seasonId && team.leagueId === driver.leagueId,
    ) ?? null
  );
}

function toMobileAttendanceDetail(
  attendance: MobileAttendanceRace,
  driver: MobileAttendanceDriver,
): MobileAttendanceDetail {
  const team = currentTeamForSeason(driver, attendance.season.id);
  return {
    ...attendance,
    driver: {
      id: driver.id,
      displayName: driver.name,
      number: driver.number,
      flag: driver.flag,
      countryCode: driver.countryCode,
      league: mobileLeagueRef(driver.league),
      team: team
        ? { id: team.id, name: team.name, logoUrl: team.logoUrl }
        : null,
    },
    canChange: attendance.canRespond,
  };
}

function assignmentForSelection(
  driver: MobileAttendanceDriver,
  seasonId?: number,
) {
  if (seasonId !== undefined) {
    return driver.seasonAssignments.find(
      (assignment) =>
        assignment.seasonId === seasonId &&
        assignment.leagueId === driver.leagueId,
    );
  }
  return (
    driver.seasonAssignments.find(
      (assignment) =>
        assignment.seasonId === driver.league.currentSeasonId &&
        assignment.leagueId === driver.leagueId &&
        assignment.season.active &&
        assignment.season.archivedAt === null,
    ) ??
    driver.seasonAssignments.find(
      (assignment) =>
        assignment.leagueId === driver.leagueId &&
        assignment.season.active &&
        assignment.season.archivedAt === null,
    )
  );
}

export async function getMobileAttendanceOverview(
  identity: MobileAttendanceIdentity,
  query: {
    seasonId?: number;
    status?: `${RaceStatus}`;
    upcoming?: boolean;
  },
  now = new Date(),
): Promise<MobileAttendanceRace[]> {
  const driver = await requireAttendanceDriver(identity);
  const assignment = assignmentForSelection(driver, query.seasonId);
  if (!assignment) {
    throw new MobileApiError(
      403,
      "DRIVER_NOT_ASSIGNED",
      "Dein Fahrerprofil ist dieser Saison und Liga nicht aktiv zugeordnet.",
    );
  }
  const schedules = await findMobileAttendanceSchedules({
    driverId: driver.id,
    leagueId: driver.leagueId,
    seasonId: assignment.seasonId,
    status: query.status,
    upcoming: query.upcoming,
    now,
  });
  return schedules.map((schedule) =>
    serializeMobileAttendance(schedule, driver, now),
  );
}

export async function getMobileAttendanceDetail(
  identity: MobileAttendanceIdentity,
  raceId: number,
  now = new Date(),
): Promise<MobileAttendanceDetail> {
  const driver = await requireAttendanceDriver(identity);
  const schedule = await getPrismaClient().raceLeagueSchedule.findUnique({
    where: {
      raceId_leagueId: { raceId, leagueId: driver.leagueId },
    },
    select: attendanceScheduleSelect(driver.id, driver.leagueId),
  });
  if (!schedule) {
    throw new MobileApiError(
      404,
      "RACE_NOT_FOUND",
      "Das Rennen wurde nicht gefunden.",
    );
  }
  const assignment = driver.seasonAssignments.find(
    (item) =>
      item.seasonId === schedule.race.seasonId &&
      item.leagueId === driver.leagueId,
  );
  if (!assignment) {
    throw new MobileApiError(
      403,
      "DRIVER_NOT_ASSIGNED",
      "Dein Fahrerprofil ist dieser Saison und Liga nicht aktiv zugeordnet.",
    );
  }
  return toMobileAttendanceDetail(
    serializeMobileAttendance(schedule, driver, now),
    driver,
  );
}

export async function changeMobileAttendance(
  identity: MobileAttendanceIdentity,
  raceId: number,
  status: AttendanceStatus.Registered | AttendanceStatus.Declined,
): Promise<MobileAttendanceDetail & { changed: boolean }> {
  try {
    const result = await changeDriverAttendance({
      actor: { userId: identity.userId, roles: identity.roles },
      raceId,
      driverId: identity.driverId,
      status,
      mode: "SELF",
      origin: "MOBILE",
    });
    return {
      ...(await getMobileAttendanceDetail(identity, raceId)),
      changed: result.changed,
    };
  } catch (error) {
    if (error instanceof AttendanceServiceError) {
      throw new MobileApiError(error.status, error.code, error.message);
    }
    throw error;
  }
}
