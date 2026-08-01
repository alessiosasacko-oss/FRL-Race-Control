import "server-only";
import {
  RaceSession,
  RaceStatus,
  Role,
} from "@/domain";
import {
  Prisma,
  RaceStatus as PrismaRaceStatus,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { listQuerySchema } from "./schemas";
import { formatLocalDateTimeInput } from "./timezone";
import { publicRaceTrack } from "@/lib/races/visibility";
import { getTeamDependencySnapshot } from "./team-dependencies";
import { emptyTeamDependencyCounts } from "./team-lifecycle";
import type {
  DriverDetail,
  DriverItem,
  LeagueAdminItem,
  MasterDataFilterOptions,
  MasterDataOptions,
  RaceItem,
  SeasonAdminItem,
  TeamDetail,
  TeamItem,
  TeamOrganizationItem,
} from "./types";

export type MasterDataListQuery = {
  q: string;
  leagueId?: number;
  seasonId?: number;
  status?: RaceStatus;
  active: "all" | "active" | "inactive";
};

export function parseMasterDataListQuery(
  input: Record<string, string | string[] | undefined>,
): MasterDataListQuery {
  return listQuerySchema.parse(input);
}

export async function getMasterDataOptions(): Promise<MasterDataOptions> {
  const prisma = getPrismaClient();
  const [leagues, seasons, teams, users, drivers, organizations] =
    await prisma.$transaction([
    prisma.league.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.season.findMany({
      orderBy: [{ startsOn: "desc" }, { name: "asc" }],
      select: {
        id: true,
        leagueId: true,
        name: true,
        active: true,
        archivedAt: true,
        participatingLeagues: { select: { id: true } },
      },
    }),
    prisma.team.findMany({
      where: { active: true, archivedAt: null },
      orderBy: { name: "asc" },
      select: {
        id: true,
        leagueId: true,
        seasonId: true,
        name: true,
      },
    }),
    prisma.user.findMany({
      where: { active: true },
      orderBy: { displayName: "asc" },
      select: {
        id: true,
        displayName: true,
        discordId: true,
        roles: true,
      },
    }),
    prisma.driver.findMany({
      orderBy: [
        { active: "desc" },
        { leagueId: "asc" },
        { number: "asc" },
      ],
      select: {
        id: true,
        leagueId: true,
        teamId: true,
        name: true,
        number: true,
        active: true,
        team: { select: { name: true } },
      },
    }),
    prisma.teamOrganization.findMany({
      where: { active: true },
      orderBy: [{ active: "desc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        active: true,
      },
    }),
  ]);

  return {
    leagues,
    teams,
    users: users.map((user) => ({
      ...user,
      roles: user.roles as Role[],
    })),
    drivers: drivers.map((driver) => ({
      id: driver.id,
      leagueId: driver.leagueId,
      teamId: driver.teamId,
      name: driver.name,
      number: driver.number,
      teamName: driver.team?.name ?? null,
      active: driver.active,
    })),
    organizations,
    seasons: seasons.map((season) => ({
      id: season.id,
      leagueId: season.leagueId,
      participatingLeagueIds: season.participatingLeagues.map(
        (league) => league.id,
      ),
      name: season.name,
      active: season.active,
      archived: season.archivedAt !== null,
    })),
  };
}

export async function getMasterDataFilterOptions(): Promise<MasterDataFilterOptions> {
  const prisma = getPrismaClient();
  const [leagues, seasons] = await Promise.all([
    prisma.league.findMany({
      where: { active: true },
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true },
    }),
    prisma.season.findMany({
      orderBy: [{ startsOn: "desc" }, { name: "asc" }],
      select: {
        id: true,
        leagueId: true,
        name: true,
        active: true,
        archivedAt: true,
        participatingLeagues: { select: { id: true } },
      },
    }),
  ]);

  return {
    leagues,
    seasons: seasons.map((season) => ({
      id: season.id,
      leagueId: season.leagueId,
      participatingLeagueIds: season.participatingLeagues.map(
        (league) => league.id,
      ),
      name: season.name,
      active: season.active,
      archived: season.archivedAt !== null,
    })),
  };
}

export async function getLeagueAdminItems(): Promise<LeagueAdminItem[]> {
  const prisma = getPrismaClient();
  const leagues = await prisma.league.findMany({
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    include: {
      seasons: {
        orderBy: { startsOn: "desc" },
        select: {
          id: true,
          leagueId: true,
          name: true,
          active: true,
          archivedAt: true,
          participatingLeagues: { select: { id: true } },
        },
      },
      _count: {
        select: { drivers: true, teams: true, tickets: true },
      },
      raceSchedules: {
        where: {
          scheduledAt: { gte: new Date() },
          race: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
        },
        orderBy: { scheduledAt: "asc" },
        take: 12,
        select: {
          id: true,
          raceId: true,
          scheduledAt: true,
          race: {
            select: { name: true, round: true, weekendDate: true },
          },
        },
      },
    },
  });

  return leagues.map((league) => ({
    id: league.id,
    code: league.code,
    name: league.name,
    description: league.description,
    active: league.active,
    currentSeasonId: league.currentSeasonId,
    raceWeekday: league.raceWeekday,
    raceStartMinute: league.raceStartMinute,
    raceTimezone: league.raceTimezone,
    defaultAttendanceDeadlineMinutes:
      league.defaultAttendanceDeadlineMinutes,
    displayOrder: league.displayOrder,
    futureSchedules: league.raceSchedules.map((schedule) => ({
      id: schedule.id,
      raceId: schedule.raceId,
      raceName: schedule.race.name,
      round: schedule.race.round,
      weekendDate: schedule.race.weekendDate
        .toISOString()
        .slice(0, 10),
      scheduledAt: schedule.scheduledAt.toISOString(),
    })),
    seasons: league.seasons.map((season) => ({
      id: season.id,
      leagueId: season.leagueId,
      participatingLeagueIds: season.participatingLeagues.map(
        (league) => league.id,
      ),
      name: season.name,
      active: season.active,
      archived: season.archivedAt !== null,
    })),
    counts: {
      drivers: league._count.drivers,
      teams: league._count.teams,
      tickets: league._count.tickets,
    },
  }));
}

export async function getSeasonAdminItems(): Promise<SeasonAdminItem[]> {
  const prisma = getPrismaClient();
  const seasons = await prisma.season.findMany({
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    include: {
      league: { select: { id: true, code: true, name: true } },
      participatingLeagues: {
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      },
      _count: { select: { races: true, teams: true } },
    },
  });

  return seasons.map((season) => ({
    id: season.id,
    leagueId: season.leagueId,
    name: season.name,
    startsOn: season.startsOn.toISOString().slice(0, 10),
    endsOn: season.endsOn.toISOString().slice(0, 10),
    active: season.active,
    archived: season.archivedAt !== null,
    league: season.league,
    participatingLeagues: season.participatingLeagues,
    counts: {
      races: season._count.races,
      teams: season._count.teams,
    },
  }));
}

function activeWhere(
  active: MasterDataListQuery["active"],
): boolean | undefined {
  if (active === "active") return true;
  if (active === "inactive") return false;
  return undefined;
}

export async function getRaceItems(
  query: MasterDataListQuery,
): Promise<RaceItem[]> {
  const prisma = getPrismaClient();
  const where: Prisma.RaceWhereInput = {
    seasonId: query.seasonId,
    season: query.leagueId
      ? {
          participatingLeagues: {
            some: { id: query.leagueId, active: true },
          },
        }
      : undefined,
    status: query.status as PrismaRaceStatus | undefined,
    OR: query.q
      ? [
          { name: { contains: query.q, mode: "insensitive" } },
          {
            AND: [
              {
                OR: [
                  { mystery: false },
                  {
                    scheduledAt: {
                      lte: new Date(Date.now() + 60 * 60 * 1000),
                    },
                  },
                ],
              },
              {
                circuit: {
                  contains: query.q,
                  mode: "insensitive",
                },
              },
            ],
          },
          {
            season: {
              participatingLeagues: {
                some: {
                  name: { contains: query.q, mode: "insensitive" },
                },
              },
            },
          },
        ]
      : undefined,
  };
  const races = await prisma.race.findMany({
    where,
    orderBy: [{ scheduledAt: "asc" }, { round: "asc" }],
    include: {
      season: {
        include: {
          participatingLeagues: {
            select: { id: true, code: true, name: true },
            orderBy: { code: "asc" },
          },
        },
      },
      leagueSchedules: {
        orderBy: [{ league: { displayOrder: "asc" } }, { scheduledAt: "asc" }],
        include: {
          league: { select: { id: true, code: true, name: true } },
        },
      },
      _count: { select: { tickets: true } },
    },
  });

  return races.map((race) => {
    const track = publicRaceTrack(race);
    const displaySchedule =
      race.leagueSchedules.find(
        (schedule) => schedule.leagueId === query.leagueId,
      ) ?? race.leagueSchedules[0];
    const displayStart = displaySchedule?.scheduledAt ?? race.scheduledAt;
    const displayTimezone = displaySchedule?.timezone ?? race.timezone;
    const displayDeadline =
      displaySchedule?.attendanceDeadline ?? race.attendanceDeadline;
    return {
      id: race.id,
      seasonId: race.seasonId,
      trackId: race.trackId,
      name: track.name,
      circuit: track.circuit,
      countryCode: track.countryCode,
      round: race.round,
      weekendDate: race.weekendDate.toISOString().slice(0, 10),
      scheduledAt: displayStart.toISOString(),
      localStart: formatLocalDateTimeInput(
        displayStart,
        displayTimezone,
      ),
      timezone: displayTimezone,
      status: race.status as RaceStatus,
      sessions: race.sessions as RaceSession[],
      sprint: race.sprint,
      doublePoints: race.doublePoints,
      mystery: race.mystery,
      trackRevealed: track.revealed,
      attendanceDeadline: displayDeadline?.toISOString() ?? null,
      attendanceDeadlineLocal: displayDeadline
        ? formatLocalDateTimeInput(
            displayDeadline,
            displayTimezone,
          )
        : "",
      leagueSchedules: race.leagueSchedules.map((schedule) => ({
        id: schedule.id,
        league: schedule.league,
        scheduledAt: schedule.scheduledAt.toISOString(),
        localStart: formatLocalDateTimeInput(
          schedule.scheduledAt,
          schedule.timezone,
        ),
        timezone: schedule.timezone,
        attendanceDeadline:
          schedule.attendanceDeadline?.toISOString() ?? null,
        attendanceDeadlineLocal: schedule.attendanceDeadline
          ? formatLocalDateTimeInput(
              schedule.attendanceDeadline,
              schedule.timezone,
            )
          : "",
      })),
      season: {
        id: race.season.id,
        name: race.season.name,
        leagues: race.season.participatingLeagues,
      },
      ticketCount: race._count.tickets,
    };
  });
}

export async function getDriverItems(
  query: MasterDataListQuery,
): Promise<DriverItem[]> {
  const prisma = getPrismaClient();
  const drivers = await prisma.driver.findMany({
    where: {
      leagueId: query.leagueId,
      active: activeWhere(query.active),
      OR: query.q
        ? [
            { name: { contains: query.q, mode: "insensitive" } },
            {
              team: {
                name: { contains: query.q, mode: "insensitive" },
              },
            },
            {
              user: {
                displayName: { contains: query.q, mode: "insensitive" },
              },
            },
          ]
        : undefined,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      league: { select: { id: true, code: true, name: true } },
      team: {
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
        },
      },
      user: {
        select: { id: true, displayName: true, discordId: true },
      },
    },
  });

  return drivers.map((driver) => ({
    id: driver.id,
    name: driver.name,
    number: driver.number,
    flag: driver.flag,
    countryCode: driver.countryCode,
    active: driver.active,
    userId: driver.userId,
    league: driver.league,
    team: driver.team,
    user: driver.user,
    updatedAt: driver.updatedAt.toISOString(),
  }));
}

export async function getDriverById(
  driverId: number,
): Promise<DriverDetail | null> {
  const prisma = getPrismaClient();
  const driver = await prisma.driver.findUnique({
    where: { id: driverId },
    include: {
      league: { select: { id: true, code: true, name: true } },
      team: {
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
        },
      },
      user: {
        select: { id: true, displayName: true, discordId: true },
      },
      _count: { select: { ticketLinks: true, standings: true } },
    },
  });

  if (!driver) return null;

  return {
    id: driver.id,
    name: driver.name,
    number: driver.number,
    flag: driver.flag,
    countryCode: driver.countryCode,
    active: driver.active,
    userId: driver.userId,
    league: driver.league,
    team: driver.team,
    user: driver.user,
    updatedAt: driver.updatedAt.toISOString(),
    ticketCount: driver._count.ticketLinks,
    standingCount: driver._count.standings,
  };
}

export async function getTeamItems(
  query: MasterDataListQuery,
  lifecycle: "active" | "archived" | "all" = "all",
): Promise<TeamItem[]> {
  const prisma = getPrismaClient();
  const teams = await prisma.team.findMany({
    where: {
      leagueId: query.leagueId,
      seasonId: query.seasonId,
      archivedAt:
        lifecycle === "active"
          ? null
          : lifecycle === "archived"
            ? { not: null }
            : undefined,
      active: lifecycle === "active" ? true : undefined,
      OR: query.q
        ? [
            { name: { contains: query.q, mode: "insensitive" } },
            { shortName: { contains: query.q, mode: "insensitive" } },
            {
              principal: {
                displayName: { contains: query.q, mode: "insensitive" },
              },
            },
            {
              drivers: {
                some: {
                  name: { contains: query.q, mode: "insensitive" },
                },
              },
            },
          ]
        : undefined,
    },
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      league: { select: { id: true, code: true, name: true } },
      season: { select: { id: true, name: true } },
      principal: {
        select: { id: true, displayName: true, discordId: true },
      },
      drivers: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          name: true,
          number: true,
          flag: true,
          active: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
          active: true,
        },
      },
    },
  });

  const dependencySnapshots = new Map(
    (await Promise.all(
      teams.map((team) => getTeamDependencySnapshot(prisma, team.id)),
    )).flatMap((snapshot) => snapshot ? [[snapshot.team.id, snapshot] as const] : []),
  );

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    active: team.active,
    archivedAt: team.archivedAt?.toISOString() ?? null,
    league: team.league,
    season: team.season,
    organization: team.organization,
    principal: team.principal,
    drivers: team.drivers,
    updatedAt: team.updatedAt.toISOString(),
    dependencies:
      dependencySnapshots.get(team.id)?.dependencies ??
      emptyTeamDependencyCounts,
    activeDrivers: dependencySnapshots.get(team.id)?.activeDrivers ?? [],
    canPermanentlyDelete:
      dependencySnapshots.get(team.id)?.canPermanentlyDelete ?? false,
  }));
}

export async function getTeamById(
  teamId: number,
): Promise<TeamDetail | null> {
  const prisma = getPrismaClient();
  const team = await prisma.team.findUnique({
    where: { id: teamId },
    include: {
      league: { select: { id: true, code: true, name: true } },
      season: { select: { id: true, name: true } },
      principal: {
        select: { id: true, displayName: true, discordId: true },
      },
      drivers: {
        orderBy: { number: "asc" },
        select: {
          id: true,
          name: true,
          number: true,
          flag: true,
          active: true,
        },
      },
      organization: {
        select: {
          id: true,
          name: true,
          shortName: true,
          color: true,
          active: true,
        },
      },
      _count: { select: { standings: true } },
    },
  });

  if (!team) return null;
  const dependencySnapshot = await getTeamDependencySnapshot(prisma, team.id);

  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    active: team.active,
    archivedAt: team.archivedAt?.toISOString() ?? null,
    league: team.league,
    season: team.season,
    organization: team.organization,
    principal: team.principal,
    drivers: team.drivers,
    updatedAt: team.updatedAt.toISOString(),
    dependencies:
      dependencySnapshot?.dependencies ?? emptyTeamDependencyCounts,
    activeDrivers: dependencySnapshot?.activeDrivers ?? [],
    canPermanentlyDelete:
      dependencySnapshot?.canPermanentlyDelete ?? false,
    standingCount: team._count.standings,
  };
}

export async function getTeamOrganizationItems(): Promise<
  TeamOrganizationItem[]
> {
  const organizations = await getPrismaClient().teamOrganization.findMany({
    orderBy: [{ active: "desc" }, { name: "asc" }],
    include: {
      seasons: {
        orderBy: { season: { startsOn: "desc" } },
        select: {
          seasonId: true,
          season: { select: { name: true } },
          principal: { select: { id: true, displayName: true } },
        },
      },
    },
  });
  return organizations.map((organization) => ({
    id: organization.id,
    name: organization.name,
    shortName: organization.shortName,
    color: organization.color,
    active: organization.active,
    seasons: organization.seasons.map((season) => ({
      seasonId: season.seasonId,
      seasonName: season.season.name,
      principal: season.principal,
    })),
  }));
}
