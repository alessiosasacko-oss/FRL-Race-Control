import "server-only";

import { getChampionshipPageData, getRaceResults } from "@/lib/championship/queries";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  MOBILE_API_DEFAULT_LEAGUE,
} from "./constants";
import { notFound } from "./errors";
import {
  createBootstrapPayload,
  serializeCalendarRace,
  serializeDriverStanding,
  serializeResultDetail,
  serializeResultOverview,
  serializeTeamStanding,
} from "./serialization";
import type {
  MobileBootstrap,
  MobileCalendarRace,
  MobileChampionshipStanding,
  MobileLeague,
  MobileLeagueRef,
  MobileResultDetail,
  MobileResultOverview,
  MobileSeasonRef,
} from "./types";

const publicTrackSelect = {
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
} as const;

const publicRaceSelect = {
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
  track: { select: publicTrackSelect },
  season: { select: { id: true, name: true } },
  resultSessions: {
    where: { publicationStatus: "PUBLISHED" as const },
    select: { leagueId: true, session: true, publicationStatus: true },
  },
} as const;

type PublicSelection = {
  league: MobileLeagueRef & { color: string | null; currentSeasonId: number | null };
  season: MobileSeasonRef | null;
};

function leagueRef(league: {
  id: number;
  code: string;
  name: string;
}): MobileLeagueRef {
  return { id: league.id, code: league.code, name: league.name };
}

function selectDefaultLeague<
  T extends { code: string },
>(leagues: readonly T[]): T | undefined {
  return (
    leagues.find((league) => league.code === MOBILE_API_DEFAULT_LEAGUE) ??
    leagues[0]
  );
}

async function activeSeasonFallbacks() {
  return getPrismaClient().season.findMany({
    where: { active: true, archivedAt: null },
    orderBy: [{ startsOn: "desc" }, { id: "desc" }],
    select: {
      id: true,
      leagueId: true,
      name: true,
      participatingLeagues: {
        where: { active: true },
        select: { id: true },
      },
    },
  });
}

function activeSeasonForLeague(
  league: {
    id: number;
    currentSeason: {
      id: number;
      name: string;
      active: boolean;
      archivedAt: Date | null;
    } | null;
  },
  fallbacks: Awaited<ReturnType<typeof activeSeasonFallbacks>>,
): MobileSeasonRef | null {
  if (
    league.currentSeason?.active &&
    league.currentSeason.archivedAt === null
  ) {
    return { id: league.currentSeason.id, name: league.currentSeason.name };
  }
  const fallback = fallbacks.find(
    (season) =>
      season.leagueId === league.id ||
      season.participatingLeagues.some((item) => item.id === league.id),
  );
  return fallback ? { id: fallback.id, name: fallback.name } : null;
}

export async function resolvePublicSelection(input: {
  leagueCode?: string;
  seasonId?: number;
}): Promise<PublicSelection> {
  const prisma = getPrismaClient();
  const leagues = await prisma.league.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      color: true,
      currentSeasonId: true,
      currentSeason: {
        select: {
          id: true,
          name: true,
          active: true,
          archivedAt: true,
        },
      },
    },
  });
  const league = input.leagueCode
    ? leagues.find((item) => item.code === input.leagueCode)
    : selectDefaultLeague(leagues);
  if (!league) {
    throw notFound(
      "LEAGUE_NOT_FOUND",
      "Die angeforderte Liga wurde nicht gefunden.",
    );
  }

  let season: MobileSeasonRef | null;
  if (input.seasonId !== undefined) {
    const requested = await prisma.season.findFirst({
      where: {
        id: input.seasonId,
        OR: [
          { leagueId: league.id },
          { participatingLeagues: { some: { id: league.id } } },
        ],
      },
      select: { id: true, name: true },
    });
    if (!requested) {
      throw notFound(
        "SEASON_NOT_FOUND",
        "Die angeforderte Saison wurde nicht gefunden.",
      );
    }
    season = requested;
  } else if (
    league.currentSeason?.active &&
    league.currentSeason.archivedAt === null
  ) {
    season = {
      id: league.currentSeason.id,
      name: league.currentSeason.name,
    };
  } else {
    const fallback = await prisma.season.findFirst({
      where: {
        active: true,
        archivedAt: null,
        OR: [
          { leagueId: league.id },
          { participatingLeagues: { some: { id: league.id } } },
        ],
      },
      orderBy: [{ startsOn: "desc" }, { id: "desc" }],
      select: { id: true, name: true },
    });
    season = fallback;
  }

  return {
    league: {
      id: league.id,
      code: league.code,
      name: league.name,
      color: league.color,
      currentSeasonId: league.currentSeasonId,
    },
    season,
  };
}

function minimumSupportedAppVersion(): string {
  const configured = process.env.MOBILE_API_MIN_APP_VERSION?.trim();
  return configured && /^\d+\.\d+\.\d+$/.test(configured)
    ? configured
    : "1.0.0";
}

function maintenanceConfiguration(): MobileBootstrap["maintenance"] {
  const enabled = process.env.MOBILE_API_MAINTENANCE_MODE === "true";
  const configuredMessage =
    process.env.MOBILE_API_MAINTENANCE_MESSAGE?.trim().slice(0, 240) || null;
  return {
    enabled,
    message: enabled ? configuredMessage : null,
  };
}

export async function getMobileBootstrap(
  now = new Date(),
): Promise<MobileBootstrap> {
  const prisma = getPrismaClient();
  const [leagues, fallbacks] = await Promise.all([
    prisma.league.findMany({
      where: { active: true },
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: {
        id: true,
        code: true,
        name: true,
        currentSeason: {
          select: {
            id: true,
            name: true,
            active: true,
            archivedAt: true,
          },
        },
      },
    }),
    activeSeasonFallbacks(),
  ]);
  const defaultLeague = selectDefaultLeague(leagues);

  return createBootstrapPayload({
    defaultLeague: defaultLeague?.code ?? null,
    minimumSupportedAppVersion: minimumSupportedAppVersion(),
    maintenance: maintenanceConfiguration(),
    leagues: leagues.map((league) => ({
      ...leagueRef(league),
      active: true,
      activeSeason: activeSeasonForLeague(league, fallbacks),
    })),
  }, now);
}

export async function getMobileLeagues(now = new Date()): Promise<MobileLeague[]> {
  const prisma = getPrismaClient();
  const leagues = await prisma.league.findMany({
    where: { active: true },
    orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
    select: {
      id: true,
      code: true,
      name: true,
      color: true,
      currentSeason: {
        select: {
          id: true,
          name: true,
          active: true,
          archivedAt: true,
        },
      },
    },
  });
  const leagueIds = leagues.map((league) => league.id);
  const [fallbacks, publishedRaces, upcomingSchedules] = await Promise.all([
    activeSeasonFallbacks(),
    prisma.raceResultSession.findMany({
      where: {
        leagueId: { in: leagueIds },
        publicationStatus: "PUBLISHED",
      },
      distinct: ["leagueId", "raceId"],
      select: { leagueId: true, raceId: true },
    }),
    prisma.raceLeagueSchedule.findMany({
      where: {
        leagueId: { in: leagueIds },
        OR: [
          { scheduledAt: { gte: now } },
          { race: { status: "IN_PROGRESS" } },
        ],
        race: { status: { in: ["SCHEDULED", "IN_PROGRESS"] } },
      },
      orderBy: [{ scheduledAt: "asc" }, { raceId: "asc" }],
      select: {
        leagueId: true,
        scheduledAt: true,
        timezone: true,
        race: { select: publicRaceSelect },
      },
    }),
  ]);
  const nextScheduleByLeague = new Map<
    number,
    (typeof upcomingSchedules)[number]
  >();
  for (const schedule of upcomingSchedules) {
    if (!nextScheduleByLeague.has(schedule.leagueId)) {
      nextScheduleByLeague.set(schedule.leagueId, schedule);
    }
  }

  return leagues.map((league) => {
    const nextSchedule = nextScheduleByLeague.get(league.id);
    return {
      ...leagueRef(league),
      branding: { color: league.color },
      activeSeason: activeSeasonForLeague(league, fallbacks),
      publishedRaceCount: publishedRaces.filter(
        (row) => row.leagueId === league.id,
      ).length,
      nextRace: nextSchedule
        ? serializeCalendarRace(
            {
              ...nextSchedule.race,
              resultSessions: nextSchedule.race.resultSessions.filter(
                (session) => session.leagueId === league.id,
              ),
            },
            leagueRef(league),
            nextSchedule.race.season,
            {
              scheduledAt: nextSchedule.scheduledAt,
              timezone: nextSchedule.timezone,
              now,
            },
          )
        : null,
    };
  });
}

export async function getMobileCalendar(
  selection: PublicSelection,
  now = new Date(),
): Promise<MobileCalendarRace[]> {
  if (!selection.season) return [];
  const rows = await getPrismaClient().race.findMany({
    where: {
      seasonId: selection.season.id,
      season: {
        OR: [
          { leagueId: selection.league.id },
          { participatingLeagues: { some: { id: selection.league.id } } },
        ],
      },
    },
    orderBy: [{ scheduledAt: "asc" }, { round: "asc" }],
    select: {
      ...publicRaceSelect,
      resultSessions: {
        where: {
          leagueId: selection.league.id,
          publicationStatus: "PUBLISHED",
        },
        select: { leagueId: true, session: true, publicationStatus: true },
      },
      leagueSchedules: {
        where: { leagueId: selection.league.id },
        take: 1,
        select: { scheduledAt: true, timezone: true },
      },
    },
  });

  return rows.map((race) => {
    const schedule = race.leagueSchedules[0];
    return serializeCalendarRace(
      race,
      leagueRef(selection.league),
      race.season,
      {
        scheduledAt: schedule?.scheduledAt,
        timezone: schedule?.timezone,
        now,
      },
    );
  });
}

export async function getMobileChampionship(
  selection: PublicSelection,
  type: "DRIVERS" | "TEAMS",
): Promise<MobileChampionshipStanding[]> {
  if (!selection.season) return [];
  const data = await getChampionshipPageData({
    q: "",
    leagueId: selection.league.id,
    seasonId: selection.season.id,
    table: type === "TEAMS" ? "teams" : "drivers",
  });
  return type === "TEAMS"
    ? data.teams.map(serializeTeamStanding)
    : data.drivers.map(serializeDriverStanding);
}

export async function getMobileResults(input: {
  selection: PublicSelection;
  limit: number;
  cursor?: number;
  now?: Date;
}): Promise<{ data: MobileResultOverview[]; nextCursor: string | null }> {
  const { selection } = input;
  if (!selection.season) return { data: [], nextCursor: null };
  const rows = await getPrismaClient().race.findMany({
    where: {
      seasonId: selection.season.id,
      resultSessions: {
        some: {
          leagueId: selection.league.id,
          publicationStatus: "PUBLISHED",
        },
      },
    },
    orderBy: [{ scheduledAt: "desc" }, { id: "desc" }],
    cursor: input.cursor ? { id: input.cursor } : undefined,
    skip: input.cursor ? 1 : 0,
    take: input.limit + 1,
    select: {
      id: true,
      name: true,
      circuit: true,
      countryCode: true,
      scheduledAt: true,
      mystery: true,
      season: { select: { id: true, name: true } },
      resultSessions: {
        where: {
          leagueId: selection.league.id,
          publicationStatus: "PUBLISHED",
        },
        select: {
          session: true,
          publicationStatus: true,
          results: {
            select: {
              finalPosition: true,
              position: true,
              driver: { select: { id: true, name: true } },
              representedTeam: { select: { id: true, name: true } },
            },
          },
        },
      },
      resultGraphics: {
        where: {
          renderStatus: "COMPLETED",
          publicUrl: { not: null },
          type: "RACE_CLASSIFICATION",
          leagueId: selection.league.id,
        },
        orderBy: [{ version: "desc" }, { generatedAt: "desc" }],
        take: 1,
        select: { publicUrl: true },
      },
    },
  });
  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit);
  return {
    data: page.map((race) =>
      serializeResultOverview(
        race,
        leagueRef(selection.league),
        input.now,
      ),
    ),
    nextCursor: hasMore ? String(page.at(-1)?.id ?? "") || null : null,
  };
}

export async function getMobileResultDetail(input: {
  raceId: number;
  leagueCode?: string;
}): Promise<MobileResultDetail> {
  const prisma = getPrismaClient();
  const race = await prisma.race.findUnique({
    where: { id: input.raceId },
    select: {
      id: true,
      season: {
        select: {
          league: {
            select: { id: true, code: true, name: true, active: true },
          },
          participatingLeagues: {
            where: { active: true },
            orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
            select: { id: true, code: true, name: true },
          },
        },
      },
    },
  });
  if (!race) {
    throw notFound(
      "RACE_NOT_FOUND",
      "Das angeforderte Rennen wurde nicht gefunden.",
    );
  }

  const availableLeagues = [...race.season.participatingLeagues];
  if (
    race.season.league.active &&
    !availableLeagues.some((league) => league.id === race.season.league.id)
  ) {
    availableLeagues.push(race.season.league);
  }
  const selectedLeague = input.leagueCode
    ? availableLeagues.find((league) => league.code === input.leagueCode)
    : selectDefaultLeague(availableLeagues);
  if (!selectedLeague) {
    throw notFound(
      "LEAGUE_NOT_FOUND",
      "Die angeforderte Liga wurde nicht gefunden.",
    );
  }

  const result = await getRaceResults(race.id, selectedLeague.id, false);
  if (!result || result.sessions.length === 0) {
    throw notFound(
      "RESULT_NOT_FOUND",
      "Für dieses Rennen wurde kein Ergebnis veröffentlicht.",
    );
  }
  return serializeResultDetail(result);
}
