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
  const [leagues, seasons, teams, users, drivers] =
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
      },
    }),
    prisma.team.findMany({
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
    seasons: seasons.map((season) => ({
      id: season.id,
      leagueId: season.leagueId,
      name: season.name,
      active: season.active,
      archived: season.archivedAt !== null,
    })),
  };
}

export async function getMasterDataFilterOptions(): Promise<MasterDataFilterOptions> {
  const prisma = getPrismaClient();
  const [leagues, seasons] = await prisma.$transaction([
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
      },
    }),
  ]);

  return {
    leagues,
    seasons: seasons.map((season) => ({
      id: season.id,
      leagueId: season.leagueId,
      name: season.name,
      active: season.active,
      archived: season.archivedAt !== null,
    })),
  };
}

export async function getLeagueAdminItems(): Promise<LeagueAdminItem[]> {
  const prisma = getPrismaClient();
  const leagues = await prisma.league.findMany({
    orderBy: { code: "asc" },
    include: {
      seasons: {
        orderBy: { startsOn: "desc" },
        select: {
          id: true,
          leagueId: true,
          name: true,
          active: true,
          archivedAt: true,
        },
      },
      _count: {
        select: { drivers: true, teams: true, tickets: true },
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
    seasons: league.seasons.map((season) => ({
      id: season.id,
      leagueId: season.leagueId,
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
  revealMystery = false,
): Promise<RaceItem[]> {
  const prisma = getPrismaClient();
  const where: Prisma.RaceWhereInput = {
    seasonId: query.seasonId,
    season: query.leagueId
      ? { leagueId: query.leagueId }
      : undefined,
    status: query.status as PrismaRaceStatus | undefined,
    OR: query.q
      ? [
          { name: { contains: query.q, mode: "insensitive" } },
          { circuit: { contains: query.q, mode: "insensitive" } },
          {
            season: {
              league: {
                name: { contains: query.q, mode: "insensitive" },
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
          league: { select: { id: true, code: true, name: true } },
        },
      },
      _count: { select: { tickets: true } },
    },
  });

  return races.map((race) => {
    const hidden = race.mystery && !revealMystery;
    return {
      id: race.id,
      seasonId: race.seasonId,
      name: hidden ? "Mystery Race" : race.name,
      circuit: hidden ? "Strecke wird später enthüllt" : race.circuit,
      countryCode: hidden ? "XX" : race.countryCode,
      round: race.round,
      scheduledAt: race.scheduledAt.toISOString(),
      localStart: formatLocalDateTimeInput(
        race.scheduledAt,
        race.timezone,
      ),
      timezone: race.timezone,
      status: race.status as RaceStatus,
      sessions: race.sessions as RaceSession[],
      sprint: race.sprint,
      doublePoints: race.doublePoints,
      mystery: race.mystery,
      season: {
        id: race.season.id,
        name: race.season.name,
        league: race.season.league,
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
): Promise<TeamItem[]> {
  const prisma = getPrismaClient();
  const teams = await prisma.team.findMany({
    where: {
      leagueId: query.leagueId,
      seasonId: query.seasonId,
      active: activeWhere(query.active),
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
    },
  });

  return teams.map((team) => ({
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    active: team.active,
    league: team.league,
    season: team.season,
    principal: team.principal,
    drivers: team.drivers,
    updatedAt: team.updatedAt.toISOString(),
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
      _count: { select: { standings: true } },
    },
  });

  if (!team) return null;

  return {
    id: team.id,
    name: team.name,
    shortName: team.shortName,
    color: team.color,
    active: team.active,
    league: team.league,
    season: team.season,
    principal: team.principal,
    drivers: team.drivers,
    updatedAt: team.updatedAt.toISOString(),
    standingCount: team._count.standings,
  };
}
