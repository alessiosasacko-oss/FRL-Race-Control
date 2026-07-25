import "server-only";
import {
  AttendanceStatus,
  ResultSession,
  ResultStatus,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { sportsListQuerySchema } from "./schemas";
import type {
  AttendanceEntryView,
  AttendancePageData,
  ChampionshipPageData,
  RaceOption,
  RaceResultsView,
  ResultAdminData,
  ResultRowView,
  SportsListQuery,
} from "./types";

export function parseSportsListQuery(
  input: Record<string, string | string[] | undefined>,
): SportsListQuery {
  return sportsListQuerySchema.parse(input);
}

function tieBreakSummary(value: unknown): string {
  if (
    typeof value !== "object" ||
    value === null ||
    !("finishCounts" in value)
  ) {
    return "Keine Zielresultate";
  }
  const finishCounts = (value as {
    finishCounts?: Record<string, unknown>;
  }).finishCounts;
  if (!finishCounts || typeof finishCounts !== "object") {
    return "Keine Zielresultate";
  }

  const summary = Object.entries(finishCounts)
    .map(([position, count]) => ({
      position: Number(position),
      count: Number(count),
    }))
    .filter(
      (item) =>
        Number.isFinite(item.position) &&
        Number.isFinite(item.count) &&
        item.count > 0,
    )
    .sort((left, right) => left.position - right.position)
    .map((item) => `${item.count}× P${item.position}`)
    .join(" · ");

  return summary || "Keine Zielresultate";
}

function raceOption(race: {
  id: number;
  name: string;
  round: number;
  scheduledAt: Date;
  sprint: boolean;
  mystery: boolean;
  status: string;
  attendanceDeadline: Date | null;
  season: {
    id: number;
    name: string;
    archivedAt: Date | null;
    league: { id: number; code: string; name: string };
  };
}, forceRevealMystery = false): RaceOption {
  const revealMystery =
    forceRevealMystery ||
    !race.mystery ||
    race.status === "COMPLETED";
  return {
    id: race.id,
    name: revealMystery ? race.name : "Mystery Race",
    round: race.round,
    scheduledAt: race.scheduledAt.toISOString(),
    sprint: race.sprint,
    mystery: race.mystery,
    attendanceDeadline: race.attendanceDeadline?.toISOString() ?? null,
    season: {
      id: race.season.id,
      name: race.season.name,
      archived: race.season.archivedAt !== null,
      league: race.season.league,
    },
  };
}

const raceOptionInclude = {
  season: {
    include: {
      league: { select: { id: true, code: true, name: true } },
    },
  },
} as const;

export async function getAttendancePageData(
  userId: number,
  query: SportsListQuery,
  revealMystery = false,
): Promise<AttendancePageData> {
  const prisma = getPrismaClient();
  const racesRaw = await prisma.race.findMany({
    where: {
      seasonId: query.seasonId,
      season: query.leagueId ? { leagueId: query.leagueId } : undefined,
    },
    orderBy: [{ scheduledAt: "asc" }, { round: "asc" }],
    include: raceOptionInclude,
  });
  const races = racesRaw.map((race) =>
    raceOption(race, revealMystery),
  );
  const requestedRace = query.raceId
    ? racesRaw.find((race) => race.id === query.raceId)
    : undefined;
  const selectedRaceRaw =
    requestedRace ??
    racesRaw.find((race) => race.scheduledAt >= new Date()) ??
    racesRaw.at(-1) ??
    null;

  if (!selectedRaceRaw) {
    return {
      races,
      selectedRace: null,
      entries: [],
      teams: [],
      substituteDrivers: [],
      ownDriverId: null,
      principalTeamIds: [],
    };
  }

  const [drivers, attendance, teams, ownDriver, principalTeams] =
    await prisma.$transaction([
      prisma.driver.findMany({
        where: {
          leagueId: selectedRaceRaw.season.league.id,
          active: true,
          team: {
            seasonId: selectedRaceRaw.seasonId,
          },
        },
        orderBy: [{ team: { name: "asc" } }, { name: "asc" }],
        include: {
          team: {
            select: {
              id: true,
              name: true,
              color: true,
              seasonId: true,
            },
          },
        },
      }),
      prisma.raceAttendance.findMany({
        where: { raceId: selectedRaceRaw.id },
        include: {
          substituteDriver: {
            select: {
              id: true,
              name: true,
              number: true,
              flag: true,
            },
          },
          representedTeam: { select: { id: true, name: true } },
          submittedBy: { select: { id: true, displayName: true } },
        },
      }),
      prisma.team.findMany({
        where: {
          seasonId: selectedRaceRaw.seasonId,
          active: true,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.driver.findUnique({
        where: { userId },
        select: { id: true },
      }),
      prisma.team.findMany({
        where: {
          principalUserId: userId,
          seasonId: selectedRaceRaw.seasonId,
        },
        select: { id: true },
      }),
    ]);
  const attendanceByDriver = new Map(
    attendance.map((entry) => [entry.driverId, entry]),
  );
  let entries: AttendanceEntryView[] = drivers.map((driver) => {
    const response = attendanceByDriver.get(driver.id);
    return {
      driver: {
        id: driver.id,
        name: driver.name,
        number: driver.number,
        flag: driver.flag,
        userId: driver.userId,
        team:
          driver.team?.seasonId === selectedRaceRaw.seasonId
            ? {
                id: driver.team.id,
                name: driver.team.name,
                color: driver.team.color,
              }
            : null,
      },
      status: (response?.status ??
        AttendanceStatus.NoResponse) as AttendanceStatus,
      substitute: response?.substituteDriver ?? null,
      representedTeam: response?.representedTeam ?? null,
      submittedBy: response?.submittedBy ?? null,
      changedAt: response?.changedAt.toISOString() ?? null,
    };
  });

  if (query.q) {
    const search = query.q.toLocaleLowerCase("de-DE");
    entries = entries.filter(
      (entry) =>
        entry.driver.name.toLocaleLowerCase("de-DE").includes(search) ||
        entry.driver.team?.name
          .toLocaleLowerCase("de-DE")
          .includes(search) ||
        entry.substitute?.name
          .toLocaleLowerCase("de-DE")
          .includes(search),
    );
  }
  if (query.teamId) {
    entries = entries.filter(
      (entry) => entry.driver.team?.id === query.teamId,
    );
  }
  if (query.attendanceStatus) {
    entries = entries.filter(
      (entry) => entry.status === query.attendanceStatus,
    );
  }

  return {
    races,
    selectedRace: raceOption(selectedRaceRaw, revealMystery),
    entries,
    teams,
    substituteDrivers: drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      number: driver.number,
      flag: driver.flag,
    })),
    ownDriverId: ownDriver?.id ?? null,
    principalTeamIds: principalTeams.map((team) => team.id),
  };
}

export async function getChampionshipPageData(
  query: SportsListQuery,
): Promise<ChampionshipPageData> {
  const prisma = getPrismaClient();
  const [leagues, seasons] = await prisma.$transaction([
    prisma.league.findMany({
      orderBy: { code: "asc" },
      select: { id: true, code: true, name: true, currentSeasonId: true },
    }),
    prisma.season.findMany({
      where: query.leagueId ? { leagueId: query.leagueId } : undefined,
      orderBy: [{ startsOn: "desc" }, { name: "asc" }],
      select: {
        id: true,
        leagueId: true,
        name: true,
        archivedAt: true,
      },
    }),
  ]);
  const preferredSeasonId =
    query.seasonId ??
    leagues.find((league) => league.id === query.leagueId)
      ?.currentSeasonId ??
    leagues.find((league) => league.currentSeasonId)?.currentSeasonId ??
    seasons[0]?.id;
  const leagueOptions = leagues.map((league) => ({
    id: league.id,
    code: league.code,
    name: league.name,
  }));

  if (!preferredSeasonId) {
    return {
      leagues: leagueOptions,
      seasons: [],
      selectedSeason: null,
      drivers: [],
      teams: [],
      updatedAt: null,
    };
  }

  const season = await prisma.season.findUnique({
    where: { id: preferredSeasonId },
    include: {
      league: { select: { id: true, code: true, name: true } },
      championship: {
        include: {
          driverStandings: {
            orderBy: { position: "asc" },
            include: {
              driver: {
                include: {
                  team: {
                    select: {
                      id: true,
                      name: true,
                      color: true,
                    },
                  },
                },
              },
            },
          },
          teamStandings: {
            orderBy: { position: "asc" },
            include: {
              team: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  color: true,
                },
              },
            },
          },
        },
      },
    },
  });

  if (!season) {
    return {
      leagues: leagueOptions,
      seasons: seasons.map((item) => ({
        id: item.id,
        leagueId: item.leagueId,
        name: item.name,
        archived: item.archivedAt !== null,
      })),
      selectedSeason: null,
      drivers: [],
      teams: [],
      updatedAt: null,
    };
  }

  const search = query.q.toLocaleLowerCase("de-DE");
  const driverRows =
    season.championship?.driverStandings.filter(
      (standing) =>
        !search ||
        standing.driver.name
          .toLocaleLowerCase("de-DE")
          .includes(search) ||
        standing.driver.team?.name
          .toLocaleLowerCase("de-DE")
          .includes(search),
    ) ?? [];
  const teamRows =
    season.championship?.teamStandings.filter(
      (standing) =>
        !search ||
        standing.team.name
          .toLocaleLowerCase("de-DE")
          .includes(search),
    ) ?? [];

  return {
    leagues: leagueOptions,
    seasons: seasons.map((item) => ({
      id: item.id,
      leagueId: item.leagueId,
      name: item.name,
      archived: item.archivedAt !== null,
    })),
    selectedSeason: {
      id: season.id,
      name: season.name,
      league: season.league,
    },
    drivers: driverRows.map((standing) => ({
      position: standing.position,
      points: standing.points,
      racePoints: standing.racePoints,
      sprintPoints: standing.sprintPoints,
      bonusPoints: standing.bonusPoints,
      adjustments: standing.adjustments,
      wins: standing.wins,
      podiums: standing.podiums,
      polePositions: standing.polePositions,
      fastestLaps: standing.fastestLaps,
      starts: standing.starts,
      dnfs: standing.dnfs,
      dsqs: standing.dsqs,
      bestResult: standing.bestResult,
      substituteStarts: standing.substituteStarts,
      penaltyPoints: standing.penaltyPoints,
      tieBreakSummary: tieBreakSummary(standing.tieBreak),
      driver: {
        id: standing.driver.id,
        name: standing.driver.name,
        number: standing.driver.number,
        flag: standing.driver.flag,
        team: standing.driver.team,
      },
    })),
    teams: teamRows.map((standing) => ({
      position: standing.position,
      points: standing.points,
      racePoints: standing.racePoints,
      sprintPoints: standing.sprintPoints,
      bonusPoints: standing.bonusPoints,
      adjustments: standing.adjustments,
      wins: standing.wins,
      podiums: standing.podiums,
      polePositions: standing.polePositions,
      fastestLaps: standing.fastestLaps,
      tieBreakSummary: tieBreakSummary(standing.tieBreak),
      team: standing.team,
    })),
    updatedAt: season.championship?.updatedAt.toISOString() ?? null,
  };
}

function resultRow(result: {
  id: number;
  driverId: number;
  representedTeamId: number;
  expectedDriverId: number | null;
  position: number | null;
  startingPosition: number | null;
  status: string;
  gapToWinnerMs: number | null;
  gapToPreviousMs: number | null;
  totalTimeMs: number | null;
  fastestLap: boolean;
  polePosition: boolean;
  lapsCompleted: number;
  classifiedPercentage: number | null;
  penaltySeconds: number;
  notes: string | null;
  substitute: boolean;
  racePoints: number;
  bonusPoints: number;
  teamPoints: number;
  driver: { id: number; name: string; number: number; flag: string };
  representedTeam: {
    id: number;
    name: string;
    shortName: string;
    color: string;
  };
  expectedDriver: { id: number; name: string } | null;
}): ResultRowView {
  return {
    ...result,
    status: result.status as ResultStatus,
  };
}

export async function getRaceResults(
  raceId: number,
  forceRevealMystery = false,
): Promise<RaceResultsView | null> {
  const prisma = getPrismaClient();
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      ...raceOptionInclude,
      resultSessions: {
        orderBy: { session: "asc" },
        include: {
          results: {
            orderBy: [{ position: "asc" }, { id: "asc" }],
            include: {
              driver: {
                select: { id: true, name: true, number: true, flag: true },
              },
              representedTeam: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  color: true,
                },
              },
              expectedDriver: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!race) return null;
  const revealMystery =
    forceRevealMystery ||
    !race.mystery ||
    race.status === "COMPLETED";
  const option = raceOption(race, forceRevealMystery);

  return {
    race: {
      ...option,
      name: revealMystery ? option.name : "Mystery Race",
      circuit: revealMystery
        ? race.circuit
        : "Strecke wird später enthüllt",
      countryCode: revealMystery ? race.countryCode : "XX",
      status: race.status,
      revealMystery,
    },
    sessions: race.resultSessions.map((session) => ({
      id: session.id,
      session: session.session as ResultSession,
      lockedAt: session.lockedAt?.toISOString() ?? null,
      results: session.results.map(resultRow),
    })),
  };
}

export async function getResultAdminData(
  raceId?: number,
): Promise<ResultAdminData> {
  const prisma = getPrismaClient();
  const racesRaw = await prisma.race.findMany({
    orderBy: [{ scheduledAt: "desc" }, { round: "desc" }],
    include: raceOptionInclude,
  });
  const races = racesRaw.map((race) => raceOption(race, true));
  const selectedRaceId = raceId ?? racesRaw[0]?.id;

  if (!selectedRaceId) {
    return { races, selected: null, drivers: [], teams: [] };
  }

  const selected = await getRaceResults(selectedRaceId, true);
  if (!selected) return { races, selected: null, drivers: [], teams: [] };
  const existingDriverIds = new Set(
    selected.sessions.flatMap((resultSession) =>
      resultSession.results.flatMap((result) => [
        result.driverId,
        ...(result.expectedDriverId
          ? [result.expectedDriverId]
          : []),
      ]),
    ),
  );

  const [driverCandidates, teams] = await prisma.$transaction([
    prisma.driver.findMany({
      where: {
        leagueId: selected.race.season.league.id,
      },
      orderBy: { name: "asc" },
      include: {
        user: { select: { displayName: true } },
        team: {
          select: { id: true, name: true, seasonId: true },
        },
      },
    }),
    prisma.team.findMany({
      where: { seasonId: selected.race.season.id },
      orderBy: { name: "asc" },
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
      },
    }),
  ]);
  const drivers = driverCandidates.filter(
    (driver) =>
      existingDriverIds.has(driver.id) ||
      (driver.active &&
        driver.team?.seasonId === selected.race.season.id),
  );

  return {
    races,
    selected,
    drivers: drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      number: driver.number,
      flag: driver.flag,
      discordName: driver.user?.displayName ?? null,
      teamId: driver.team?.id ?? null,
      teamName: driver.team?.name ?? null,
    })),
    teams,
  };
}

export async function getScoringAdminData(seasonId?: number) {
  const prisma = getPrismaClient();
  const seasons = await prisma.season.findMany({
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    include: {
      league: { select: { id: true, code: true, name: true } },
      scoringConfiguration: {
        include: {
          positions: {
            orderBy: [{ session: "asc" }, { position: "asc" }],
          },
        },
      },
    },
  });
  const selected =
    seasons.find((season) => season.id === seasonId) ??
    seasons[0] ??
    null;

  return { seasons, selected };
}

export async function getAdjustmentAdminData(seasonId?: number) {
  const prisma = getPrismaClient();
  const seasons = await prisma.season.findMany({
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    include: { league: { select: { id: true, code: true } } },
  });
  const selectedSeasonId =
    seasons.find((season) => season.id === seasonId)?.id ??
    seasons[0]?.id;

  if (!selectedSeasonId) {
    return {
      seasons,
      selectedSeasonId: null,
      drivers: [],
      teams: [],
      races: [],
      tickets: [],
      adjustments: [],
    };
  }

  const selectedSeason = seasons.find(
    (season) => season.id === selectedSeasonId,
  );
  const [drivers, teams, races, tickets, adjustments] =
    await prisma.$transaction([
      prisma.driver.findMany({
        where: { leagueId: selectedSeason?.leagueId },
        orderBy: { name: "asc" },
        select: { id: true, name: true, number: true },
      }),
      prisma.team.findMany({
        where: { seasonId: selectedSeasonId },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.race.findMany({
        where: { seasonId: selectedSeasonId },
        orderBy: { round: "asc" },
        select: { id: true, name: true, round: true },
      }),
      prisma.fiaTicket.findMany({
        where: { seasonId: selectedSeasonId },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      }),
      prisma.championshipAdjustment.findMany({
        where: { seasonId: selectedSeasonId },
        orderBy: { createdAt: "desc" },
        include: {
          driver: { select: { name: true } },
          team: { select: { name: true } },
          actor: { select: { displayName: true } },
          race: { select: { name: true } },
          fiaTicket: { select: { id: true, title: true } },
        },
      }),
    ]);

  return {
    seasons,
    selectedSeasonId,
    drivers,
    teams,
    races,
    tickets,
    adjustments,
  };
}

export async function getChampionshipValidationOverview() {
  const prisma = getPrismaClient();
  const seasons = await prisma.season.findMany({
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    include: {
      league: { select: { code: true } },
      scoringConfiguration: { select: { id: true } },
      races: {
        include: {
          resultSessions: {
            select: { id: true, session: true, lockedAt: true },
          },
        },
      },
      championship: {
        select: {
          updatedAt: true,
          _count: {
            select: { driverStandings: true, teamStandings: true },
          },
        },
      },
    },
  });

  return seasons.map((season) => {
    const missingSprintResults = season.races.filter(
      (race) =>
        race.sprint &&
        !race.resultSessions.some(
          (session) => session.session === ResultSession.Sprint,
        ),
    ).length;
    const missingRaceResults = season.races.filter(
      (race) =>
        race.status === "COMPLETED" &&
        !race.resultSessions.some(
          (session) => session.session === ResultSession.Race,
        ),
    ).length;

    return {
      id: season.id,
      label: `${season.league.code} · ${season.name}`,
      hasScoring: Boolean(season.scoringConfiguration),
      missingRaceResults,
      missingSprintResults,
      driverStandings:
        season.championship?._count.driverStandings ?? 0,
      teamStandings: season.championship?._count.teamStandings ?? 0,
      recalculatedAt:
        season.championship?.updatedAt.toISOString() ?? null,
    };
  });
}
