import "server-only";
import { createHash } from "node:crypto";
import {
  AttendanceChangeSource,
  AttendanceStatus,
  PenaltyType,
  RaceSession,
  ResultGapMode,
  ResultPenaltySource,
  ResultPublicationStatus,
  ResultSession,
  ResultStatus,
  Role,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  resultDraftSubmissionSchema,
  sportsListQuerySchema,
} from "./schemas";
import {
  isMysteryTrackRevealed,
  publicRaceTrack,
} from "@/lib/races/visibility";
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
import {
  defaultPositionRows,
} from "./scoring";
import { attendanceCounts } from "./attendance-policy";

const defaultScoring = {
  fastestLapPoint: 1,
  fastestLapRequiresTopPosition: 10,
  polePositionPoint: 0,
  dnfScoresPoints: false,
  retiredScoresPoints: false,
  minimumClassifiedPercentage: null,
  teamPointsEnabled: true,
  substituteDriverPointsEnabled: true,
  positions: defaultPositionRows(),
};

function fiaSession(session: ResultSession): RaceSession {
  if (session === ResultSession.Qualifying) return RaceSession.Qualifying;
  if (session === ResultSession.Sprint) return RaceSession.Sprint;
  return RaceSession.Race;
}

function penaltyVersion(
  penalties: readonly {
    id: number;
    updatedAt: Date;
    penaltyType: string;
    penaltyValue: number | null;
    ticket: { drivers: Array<{ driverId: number }> };
  }[],
): string {
  const normalized = penalties
    .map((penalty) => ({
      id: penalty.id,
      updatedAt: penalty.updatedAt.toISOString(),
      penaltyType: penalty.penaltyType,
      penaltyValue: penalty.penaltyValue,
      drivers: penalty.ticket.drivers
        .map(({ driverId }) => driverId)
        .sort((left, right) => left - right),
    }))
    .sort((left, right) => left.id - right.id);
  return createHash("sha256")
    .update(JSON.stringify(normalized))
    .digest("hex");
}

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
  circuit: string | null;
  countryCode: string | null;
  round: number;
  scheduledAt: Date;
  sprint: boolean;
  doublePoints: boolean;
  mystery: boolean;
  status: string;
  attendanceDeadline: Date | null;
  leagueSchedules: Array<{
    id: number;
    leagueId: number;
    scheduledAt: Date;
    timezone: string;
    attendanceDeadline: Date | null;
  }>;
  season: {
    id: number;
    name: string;
    archivedAt: Date | null;
    league: { id: number; code: string; name: string };
    participatingLeagues: Array<{
      id: number;
      code: string;
      name: string;
    }>;
  };
}, leagueId?: number): RaceOption {
  const revealMystery = isMysteryTrackRevealed(race);
  const leagueSchedule =
    race.leagueSchedules.find(
      (schedule) => schedule.leagueId === leagueId,
    ) ?? race.leagueSchedules[0];
  if (!leagueSchedule) {
    throw new Error("RACE_LEAGUE_SCHEDULE_MISSING");
  }
  return {
    id: race.id,
    name: revealMystery ? race.name : "Mystery Track",
    circuit: revealMystery ? race.circuit : null,
    countryCode: revealMystery ? race.countryCode : null,
    round: race.round,
    leagueScheduleId: leagueSchedule.id,
    scheduledAt: leagueSchedule.scheduledAt.toISOString(),
    timezone: leagueSchedule.timezone,
    sprint: race.sprint,
    doublePoints: race.doublePoints,
    mystery: race.mystery,
    attendanceDeadline:
      leagueSchedule.attendanceDeadline?.toISOString() ?? null,
    season: {
      id: race.season.id,
      name: race.season.name,
      archived: race.season.archivedAt !== null,
      league:
        race.season.participatingLeagues.find(
          (league) => league.id === leagueId,
        ) ?? race.season.league,
    },
  };
}

const raceOptionInclude = {
  leagueSchedules: {
    select: {
      id: true,
      leagueId: true,
      scheduledAt: true,
      timezone: true,
      attendanceDeadline: true,
    },
    orderBy: { scheduledAt: "asc" },
  },
  season: {
    include: {
      league: { select: { id: true, code: true, name: true } },
      participatingLeagues: {
        where: { active: true },
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      },
    },
  },
} as const;

export async function getAttendancePageData(
  userId: number,
  query: SportsListQuery,
): Promise<AttendancePageData> {
  const prisma = getPrismaClient();
  const userContext = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      roles: true,
      driver: { select: { id: true, leagueId: true } },
      principalTeams: {
        where: { active: true },
        select: {
          id: true,
          league: { select: { id: true, code: true, name: true } },
        },
      },
      organizationSeasons: {
        select: {
          organization: {
            select: {
              teams: {
                where: { active: true },
                select: {
                  id: true,
                  league: { select: { id: true, code: true, name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const canManageAll = Boolean(
    userContext?.roles.some(
      (role) => role === "SUPER_ADMIN" || role === "ADMIN",
    ),
  );
  const allActiveLeagues = canManageAll
    ? await prisma.league.findMany({
        where: { active: true },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
        select: { id: true, code: true, name: true },
      })
    : [];
  const accessibleLeagueMap = new Map<
    number,
    { id: number; code: string; name: string }
  >();
  for (const league of allActiveLeagues) {
    accessibleLeagueMap.set(league.id, league);
  }
  if (userContext?.driver) {
    const league = await prisma.league.findUnique({
      where: { id: userContext.driver.leagueId },
      select: { id: true, code: true, name: true },
    });
    if (league) accessibleLeagueMap.set(league.id, league);
  }
  for (const team of userContext?.principalTeams ?? []) {
    accessibleLeagueMap.set(team.league.id, team.league);
  }
  for (const organizationSeason of userContext?.organizationSeasons ?? []) {
    for (const team of organizationSeason.organization.teams) {
      accessibleLeagueMap.set(team.league.id, team.league);
    }
  }
  const allPrincipalTeamIds = [
    ...(userContext?.principalTeams.map((team) => team.id) ?? []),
    ...(userContext?.organizationSeasons.flatMap((assignment) =>
      assignment.organization.teams.map((team) => team.id)
    ) ?? []),
  ];
  const accessibleLeagues = [...accessibleLeagueMap.values()];
  const preferredLeagueId =
    query.leagueId &&
    accessibleLeagueMap.has(query.leagueId)
      ? query.leagueId
      : userContext?.driver?.leagueId;
  const selectedLeague =
    accessibleLeagueMap.get(preferredLeagueId ?? 0) ??
    accessibleLeagues[0] ??
    null;

  if (!selectedLeague) {
    return {
      accessibleLeagues,
      selectedLeague: null,
      races: [],
      selectedRace: null,
      entries: [],
      teams: [],
      substituteDrivers: [],
      ownDriverId: userContext?.driver?.id ?? null,
      principalTeamIds: allPrincipalTeamIds,
      counts: attendanceCounts([]),
      auditEntries: [],
    };
  }

  const racesUnsorted = await prisma.race.findMany({
    where: {
      seasonId: query.seasonId,
      season: {
        participatingLeagues: {
          some: { id: selectedLeague.id, active: true },
        },
      },
      leagueSchedules: { some: { leagueId: selectedLeague.id } },
    },
    include: raceOptionInclude,
  });
  const racesRaw = racesUnsorted.sort(
    (left, right) =>
      (left.leagueSchedules.find(
        (schedule) => schedule.leagueId === selectedLeague.id,
      )?.scheduledAt.getTime() ?? 0) -
      (right.leagueSchedules.find(
        (schedule) => schedule.leagueId === selectedLeague.id,
      )?.scheduledAt.getTime() ?? 0),
  );
  const races = racesRaw.map((race) =>
    raceOption(race, selectedLeague.id),
  );
  const requestedRace = query.raceId
    ? racesRaw.find((race) => race.id === query.raceId)
    : undefined;
  const selectedRaceRaw =
    requestedRace ??
    racesRaw.find(
      (race) =>
        race.leagueSchedules.some(
          (schedule) =>
            schedule.leagueId === selectedLeague.id &&
            schedule.scheduledAt >= new Date(),
        ),
    ) ??
    racesRaw.at(-1) ??
    null;

  if (!selectedRaceRaw) {
    return {
      accessibleLeagues,
      selectedLeague,
      races,
      selectedRace: null,
      entries: [],
      teams: [],
      substituteDrivers: [],
      ownDriverId: userContext?.driver?.id ?? null,
      principalTeamIds: allPrincipalTeamIds,
      counts: attendanceCounts([]),
      auditEntries: [],
    };
  }

  const [
    drivers,
    attendance,
    teams,
    principalTeams,
    auditEntries,
  ] = await Promise.all([
      prisma.driver.findMany({
        where: {
          leagueId: selectedLeague.id,
          active: true,
          OR: [
            { team: { seasonId: selectedRaceRaw.seasonId } },
            { teamId: null },
          ],
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
        where: {
          raceId: selectedRaceRaw.id,
          driver: { leagueId: selectedLeague.id },
        },
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
          leagueId: selectedLeague.id,
          active: true,
          archivedAt: null,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.team.findMany({
        where: {
          seasonId: selectedRaceRaw.seasonId,
          leagueId: selectedLeague.id,
          OR: [
            { principalUserId: userId },
            {
              organization: {
                seasons: {
                  some: {
                    seasonId: selectedRaceRaw.seasonId,
                    principalUserId: userId,
                  },
                },
              },
            },
          ],
        },
        select: { id: true },
      }),
      canManageAll
        ? prisma.attendanceAudit.findMany({
            where: {
              raceId: selectedRaceRaw.id,
              leagueId: selectedLeague.id,
            },
            orderBy: { createdAt: "desc" },
            take: 100,
            include: {
              driver: { select: { name: true } },
              changedBy: { select: { displayName: true } },
            },
          })
        : Promise.resolve([]),
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
      changeSource:
        (response?.changeSource as AttendanceChangeSource | undefined) ??
        null,
      changeReason: response?.changeReason ?? null,
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
    accessibleLeagues,
    selectedLeague,
    races,
    selectedRace: raceOption(selectedRaceRaw, selectedLeague.id),
    entries,
    teams,
    substituteDrivers: drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      number: driver.number,
      flag: driver.flag,
    })),
    ownDriverId: userContext?.driver?.id ?? null,
    principalTeamIds: principalTeams.map((team) => team.id),
    counts: attendanceCounts(
      drivers.map((driver) => {
        const response = attendanceByDriver.get(driver.id);
        return (response?.status ??
          AttendanceStatus.NoResponse) as AttendanceStatus;
      }),
    ),
    auditEntries: auditEntries.map((entry) => ({
      id: entry.id,
      driverName: entry.driver.name,
      previousStatus: entry.previousStatus as AttendanceStatus,
      newStatus: entry.newStatus as AttendanceStatus,
      source: entry.source as AttendanceChangeSource,
      actorRole: entry.actorRole as Role,
      actorName: entry.changedBy?.displayName ?? null,
      reason: entry.reason,
      createdAt: entry.createdAt.toISOString(),
    })),
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
      where: query.leagueId
        ? {
            participatingLeagues: {
              some: { id: query.leagueId },
            },
          }
        : undefined,
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
  const seasonOwnerLeagueId = seasons.find(
    (season) => season.id === preferredSeasonId,
  )?.leagueId;
  const leagueOptions = leagues.map((league) => ({
    id: league.id,
    code: league.code,
    name: league.name,
  }));
  const selectedLeague =
    leagueOptions.find((league) => league.id === query.leagueId) ??
    leagueOptions.find(
      (league) =>
        league.id ===
        leagues.find(
          (item) => item.currentSeasonId === preferredSeasonId,
        )?.id,
    ) ??
    leagueOptions.find((league) => league.id === seasonOwnerLeagueId);

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
      championships: {
        where: {
          leagueId:
            query.leagueId ??
            leagues.find(
              (league) => league.currentSeasonId === preferredSeasonId,
            )?.id ??
            seasonOwnerLeagueId,
        },
        take: 1,
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
        leagueId: selectedLeague?.id ?? item.leagueId,
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
    season.championships[0]?.driverStandings.filter(
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
    season.championships[0]?.teamStandings.filter(
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
      leagueId: selectedLeague?.id ?? item.leagueId,
      name: item.name,
      archived: item.archivedAt !== null,
    })),
    selectedSeason: {
      id: season.id,
      name: season.name,
      league: selectedLeague ?? season.league,
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
    updatedAt:
      season.championships[0]?.updatedAt.toISOString() ?? null,
  };
}

function resultRow(result: {
  id: number;
  driverId: number;
  representedTeamId: number;
  expectedDriverId: number | null;
  position: number | null;
  startingPosition: number | null;
  baseStatus: string;
  status: string;
  gapToWinnerMs: number | null;
  gapToPreviousMs: number | null;
  lapsBehind: number;
  totalTimeMs: number | null;
  fastestLapMs: number | null;
  fastestLap: boolean;
  polePosition: boolean;
  lapsCompleted: number;
  classifiedPercentage: number | null;
  penaltySeconds: number;
  effectivePenaltyMs: number;
  adjustedTimeMs: number | null;
  finalPosition: number | null;
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
  penaltyApplications: Array<{
    id: number;
    decisionId: number | null;
    source: string;
    penaltyType: string;
    penaltyMilliseconds: number;
    disqualified: boolean;
    reason: string | null;
    active: boolean;
    decision: { ticketId: number } | null;
  }>;
}): ResultRowView {
  return {
    ...result,
    baseStatus: result.baseStatus as ResultStatus,
    status: result.status as ResultStatus,
    penaltyApplications: result.penaltyApplications.map(
      ({ decision, ...application }) => ({
        ...application,
        ticketId: decision?.ticketId ?? null,
        source: application.source as ResultPenaltySource,
        penaltyType: application.penaltyType as PenaltyType,
      }),
    ),
  };
}

function resultDraftPayload(value: unknown) {
  const parsed = resultDraftSubmissionSchema.safeParse(value);
  if (!parsed.success) return null;
  return {
    gapMode: parsed.data.gapMode,
    results: parsed.data.results,
  };
}

export async function getRaceResults(
  raceId: number,
  leagueId?: number,
  includeDrafts = false,
): Promise<RaceResultsView | null> {
  const prisma = getPrismaClient();
  const resultLeagueId =
    leagueId ??
    (
      await prisma.race.findUnique({
        where: { id: raceId },
        select: { season: { select: { leagueId: true } } },
      })
    )?.season.leagueId;
  const race = await prisma.race.findUnique({
    where: { id: raceId },
    include: {
      ...raceOptionInclude,
      resultSessions: {
        where: {
          leagueId: resultLeagueId,
          publicationStatus: includeDrafts
            ? undefined
            : "PUBLISHED",
        },
        orderBy: { session: "asc" },
        include: {
          results: {
            orderBy: includeDrafts
              ? [{ position: "asc" }, { id: "asc" }]
              : [
                  {
                    finalPosition: {
                      sort: "asc",
                      nulls: "last",
                    },
                  },
                  { position: "asc" },
                  { id: "asc" },
                ],
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
              penaltyApplications: {
                orderBy: { createdAt: "asc" },
                include: {
                  decision: { select: { ticketId: true } },
                },
              },
            },
          },
        },
      },
      tickets: {
        where: {
          leagueId: resultLeagueId,
          status: "RESOLVED",
          decision: { isNot: null },
        },
        select: {
          session: true,
          decision: {
            select: {
              id: true,
              penaltyType: true,
              penaltyValue: true,
              updatedAt: true,
              ticket: {
                select: {
                  drivers: { select: { driverId: true } },
                },
              },
            },
          },
        },
      },
    },
  });

  if (
    !race ||
    !race.season.participatingLeagues.some(
      (league) => league.id === resultLeagueId,
    )
  ) {
    return null;
  }
  const track = publicRaceTrack(race);
  const revealMystery = track.revealed;
  const option = raceOption(race, resultLeagueId);

  return {
    race: {
      ...option,
      name: track.name,
      circuit: track.circuit ?? "Mystery Track",
      countryCode: track.countryCode ?? "–",
      status: race.status,
      revealMystery,
    },
    sessions: race.resultSessions.map((session) => ({
      id: session.id,
      session: session.session as ResultSession,
      gapMode: session.gapMode as ResultGapMode,
      publicationStatus:
        session.publicationStatus as ResultPublicationStatus,
      fiaPenaltyVersion: session.fiaPenaltyVersion,
      currentFiaPenaltyVersion: penaltyVersion(
        race.tickets.flatMap((ticket) =>
          ticket.session === fiaSession(session.session as ResultSession)
            ? ticket.decision
              ? [ticket.decision]
              : []
            : [],
        ),
      ),
      fiaPenaltiesChanged:
        session.fiaPenaltyVersion !== null &&
        session.fiaPenaltyVersion !==
          penaltyVersion(
            race.tickets.flatMap((ticket) =>
              ticket.session === fiaSession(
                session.session as ResultSession,
              )
                ? ticket.decision
                  ? [ticket.decision]
                  : []
                : [],
            ),
          ),
      revision: session.revision,
      lockedAt: session.lockedAt?.toISOString() ?? null,
      publishedAt: session.publishedAt?.toISOString() ?? null,
      updatedAt: session.updatedAt.toISOString(),
      draftPayload: resultDraftPayload(session.draftPayload),
      results: session.results.map(resultRow),
    })),
  };
}

export async function getResultAdminData(
  raceId?: number,
  leagueId?: number,
  seasonId?: number,
): Promise<ResultAdminData> {
  const prisma = getPrismaClient();
  const racesRaw = await prisma.race.findMany({
    where: { seasonId },
    orderBy: [{ scheduledAt: "desc" }, { round: "desc" }],
    include: raceOptionInclude,
  });
  const eligibleRaces = leagueId
    ? racesRaw.filter((race) =>
        race.season.participatingLeagues.some(
          (league) => league.id === leagueId,
        ),
      )
    : racesRaw;
  const races = eligibleRaces.map((race) =>
    raceOption(race, leagueId),
  );
  const selectedRaceId =
    eligibleRaces.find((race) => race.id === raceId)?.id ??
    eligibleRaces[0]?.id;

  if (!selectedRaceId) {
    return {
      races,
      selected: null,
      weekendLeagueResults: [],
      drivers: [],
      teams: [],
      fiaPenalties: [],
      scoring: defaultScoring,
    };
  }

  const selected = await getRaceResults(
    selectedRaceId,
    leagueId,
    true,
  );
  if (!selected) {
    return {
      races,
      selected: null,
      weekendLeagueResults: [],
      drivers: [],
      teams: [],
      fiaPenalties: [],
      scoring: defaultScoring,
    };
  }
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
  const existingTeamIds = new Set(
    selected.sessions.flatMap((resultSession) =>
      resultSession.results.map((result) => result.representedTeamId),
    ),
  );
  const selectedRaceContext = eligibleRaces.find(
    (race) => race.id === selectedRaceId,
  );
  const weekendSessions = await prisma.raceResultSession.findMany({
    where: { raceId: selectedRaceId },
    select: {
      leagueId: true,
      session: true,
      publicationStatus: true,
    },
  });
  const weekendLeagueResults =
    selectedRaceContext?.season.participatingLeagues.map((league) => ({
      league,
      sessions: weekendSessions
        .filter((result) => result.leagueId === league.id)
        .map((result) => ({
          session: result.session as ResultSession,
          publicationStatus:
            result.publicationStatus as ResultPublicationStatus,
        })),
    })) ?? [];

  const [attendance, fiaTickets, scoringConfiguration] =
    await prisma.$transaction([
      prisma.raceAttendance.findMany({
        where: {
          raceId: selectedRaceId,
          status: "REGISTERED",
          driver: {
            leagueId: selected.race.season.league.id,
          },
        },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        select: {
          driverId: true,
          substituteDriverId: true,
          representedTeamId: true,
        },
      }),
      prisma.fiaTicket.findMany({
        where: {
          raceId: selectedRaceId,
          leagueId: selected.race.season.league.id,
          status: "RESOLVED",
          decision: { isNot: null },
        },
        orderBy: { id: "asc" },
        select: {
          id: true,
          session: true,
          drivers: { select: { driverId: true } },
          decision: {
            select: {
              id: true,
              penaltyType: true,
              penaltyValue: true,
              reason: true,
              updatedAt: true,
              penalties: {
                orderBy: { id: "asc" },
                select: { penaltyType: true, penaltyValue: true },
              },
            },
          },
        },
      }),
      prisma.scoringConfiguration.findUnique({
        where: {
          leagueId_seasonId: {
            leagueId: selected.race.season.league.id,
            seasonId: selected.race.season.id,
          },
        },
        include: {
          positions: {
            orderBy: [{ session: "asc" }, { position: "asc" }],
          },
        },
      }),
    ]);
  const replacementDriverIds = attendance.flatMap((entry) =>
    entry.substituteDriverId ? [entry.substituteDriverId] : [],
  );
  const attendanceByDriver = new Map(
    attendance.map((entry) => [
      entry.substituteDriverId ?? entry.driverId,
      entry,
    ]),
  );
  const registrationOrderByDriver = new Map(
    attendance.map((entry, index) => [
      entry.substituteDriverId ?? entry.driverId,
      index,
    ]),
  );

  const [driverCandidates, teams] = await prisma.$transaction([
    prisma.driver.findMany({
      where: {
        OR: [
          { leagueId: selected.race.season.league.id },
          { id: { in: replacementDriverIds } },
          { id: { in: [...existingDriverIds] } },
        ],
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
      where: {
        seasonId: selected.race.season.id,
        leagueId: selected.race.season.league.id,
        OR: [
          { active: true, archivedAt: null },
          { id: { in: [...existingTeamIds] } },
        ],
      },
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
      replacementDriverIds.includes(driver.id) ||
      (driver.active &&
        driver.leagueId === selected.race.season.league.id &&
        driver.team?.seasonId === selected.race.season.id),
  );

  return {
    races,
    selected,
    weekendLeagueResults,
    drivers: drivers.map((driver) => ({
      id: driver.id,
      name: driver.name,
      number: driver.number,
      flag: driver.flag,
      discordName: driver.user?.displayName ?? null,
      teamId: driver.team?.id ?? null,
      teamName: driver.team?.name ?? null,
      registered: attendanceByDriver.has(driver.id),
      registrationOrder:
        registrationOrderByDriver.get(driver.id) ?? null,
      replacement:
        attendanceByDriver.get(driver.id)?.substituteDriverId ===
        driver.id,
      expectedDriverId:
        attendanceByDriver.get(driver.id)?.substituteDriverId ===
        driver.id
          ? attendanceByDriver.get(driver.id)?.driverId ?? null
          : null,
    })),
    teams,
    fiaPenalties: fiaTickets.flatMap((ticket) => {
      if (!ticket.decision) return [];
      const penalties =
        ticket.decision.penalties.length > 0
          ? ticket.decision.penalties
          : [
              {
                penaltyType: ticket.decision.penaltyType,
                penaltyValue: ticket.decision.penaltyValue,
              },
            ];
      return ticket.drivers.flatMap(({ driverId }) =>
        penalties.map((penalty) => ({
          decisionId: ticket.decision!.id,
          ticketId: ticket.id,
          driverId,
          penaltyType: penalty.penaltyType as PenaltyType,
          penaltyValue: penalty.penaltyValue,
          reason: ticket.decision!.reason,
          updatedAt: ticket.decision!.updatedAt.toISOString(),
          session: ticket.session as RaceSession,
        })),
      );
    }),
    scoring: scoringConfiguration
      ? {
          fastestLapPoint: scoringConfiguration.fastestLapPoint,
          fastestLapRequiresTopPosition:
            scoringConfiguration.fastestLapRequiresTopPosition,
          polePositionPoint: scoringConfiguration.polePositionPoint,
          dnfScoresPoints: scoringConfiguration.dnfScoresPoints,
          retiredScoresPoints:
            scoringConfiguration.retiredScoresPoints,
          minimumClassifiedPercentage:
            scoringConfiguration.minimumClassifiedPercentage,
          teamPointsEnabled: scoringConfiguration.teamPointsEnabled,
          substituteDriverPointsEnabled:
            scoringConfiguration.substituteDriverPointsEnabled,
          positions: scoringConfiguration.positions.map(
            (position) => ({
              session: position.session as ResultSession,
              position: position.position,
              points: position.points,
            }),
          ),
        }
      : defaultScoring,
  };
}

export async function getScoringAdminData(
  seasonId?: number,
  leagueId?: number,
) {
  const prisma = getPrismaClient();
  const seasons = await prisma.season.findMany({
    where: leagueId
      ? {
          participatingLeagues: {
            some: { id: leagueId },
          },
        }
      : undefined,
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    include: {
      league: { select: { id: true, code: true, name: true } },
      participatingLeagues: {
        select: { id: true, code: true, name: true },
        orderBy: { code: "asc" },
      },
      scoringConfigurations: {
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

  return {
    seasons: seasons.map((season) => {
      const league =
        season.participatingLeagues.find(
          (item) => item.id === leagueId,
        ) ?? season.league;
      return {
        ...season,
        league,
        scoringConfiguration:
          season.scoringConfigurations.find(
            (configuration) =>
              configuration.leagueId === league.id,
          ) ?? null,
      };
    }),
    selected: selected
      ? {
          ...selected,
          league:
            selected.participatingLeagues.find(
              (item) => item.id === leagueId,
            ) ?? selected.league,
          scoringConfiguration:
            selected.scoringConfigurations.find(
              (configuration) =>
                configuration.leagueId ===
                (selected.participatingLeagues.find(
                  (item) => item.id === leagueId,
                )?.id ?? selected.leagueId),
            ) ?? null,
        }
      : null,
  };
}

export async function getAdjustmentAdminData(
  seasonId?: number,
  leagueId?: number,
) {
  const prisma = getPrismaClient();
  const seasons = await prisma.season.findMany({
    where: leagueId
      ? {
          participatingLeagues: {
            some: { id: leagueId },
          },
        }
      : undefined,
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    include: {
      league: { select: { id: true, code: true } },
      participatingLeagues: {
        select: { id: true, code: true },
        orderBy: { code: "asc" },
      },
    },
  });
  const selectedSeasonId =
    seasons.find((season) => season.id === seasonId)?.id ??
    seasons[0]?.id;

  if (!selectedSeasonId) {
    return {
      seasons,
      selectedSeasonId: null,
      selectedLeagueId: null,
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
  const selectedLeague =
    selectedSeason?.participatingLeagues.find(
      (item) => item.id === leagueId,
    ) ?? selectedSeason?.league;
  const [drivers, teams, races, tickets, adjustments] =
    await prisma.$transaction([
      prisma.driver.findMany({
        where: { leagueId: selectedLeague?.id },
        orderBy: { name: "asc" },
        select: { id: true, name: true, number: true },
      }),
      prisma.team.findMany({
        where: {
          seasonId: selectedSeasonId,
          leagueId: selectedLeague?.id,
          active: true,
          archivedAt: null,
        },
        orderBy: { name: "asc" },
        select: { id: true, name: true },
      }),
      prisma.race.findMany({
        where: { seasonId: selectedSeasonId },
        orderBy: { round: "asc" },
        select: {
          id: true,
          name: true,
          circuit: true,
          countryCode: true,
          mystery: true,
          scheduledAt: true,
          round: true,
        },
      }),
      prisma.fiaTicket.findMany({
        where: {
          seasonId: selectedSeasonId,
          leagueId: selectedLeague?.id,
        },
        orderBy: { createdAt: "desc" },
        select: { id: true, title: true },
      }),
      prisma.championshipAdjustment.findMany({
        where: {
          seasonId: selectedSeasonId,
          leagueId: selectedLeague?.id,
        },
        orderBy: { createdAt: "desc" },
        include: {
          driver: { select: { name: true } },
          team: { select: { name: true } },
          actor: { select: { displayName: true } },
          race: {
            select: {
              name: true,
              circuit: true,
              countryCode: true,
              mystery: true,
              scheduledAt: true,
            },
          },
          fiaTicket: { select: { id: true, title: true } },
        },
      }),
    ]);

  return {
    seasons: seasons.map((season) => ({
      ...season,
      league:
        season.participatingLeagues.find(
          (item) => item.id === leagueId,
        ) ?? season.league,
    })),
    selectedSeasonId,
    selectedLeagueId: selectedLeague?.id ?? null,
    drivers,
    teams,
    races: races.map((race) => ({
      id: race.id,
      name: publicRaceTrack(race).name,
      round: race.round,
    })),
    tickets,
    adjustments: adjustments.map((adjustment) => ({
      ...adjustment,
      race: adjustment.race
        ? { name: publicRaceTrack(adjustment.race).name }
        : null,
    })),
  };
}

export async function getChampionshipValidationOverview() {
  const prisma = getPrismaClient();
  const seasons = await prisma.season.findMany({
    orderBy: [{ startsOn: "desc" }, { name: "asc" }],
    include: {
      league: { select: { id: true, code: true } },
      participatingLeagues: {
        select: { id: true, code: true },
        orderBy: { code: "asc" },
      },
      scoringConfigurations: {
        select: { id: true, leagueId: true },
      },
      races: {
        include: {
          resultSessions: {
            select: {
              id: true,
              leagueId: true,
              session: true,
              lockedAt: true,
            },
          },
        },
      },
      championships: {
        select: {
          leagueId: true,
          updatedAt: true,
          _count: {
            select: { driverStandings: true, teamStandings: true },
          },
        },
      },
    },
  });

  return seasons.flatMap((season) =>
    season.participatingLeagues.map((league) => {
      const missingSprintResults = season.races.filter(
        (race) =>
          race.sprint &&
          !race.resultSessions.some(
            (session) =>
              session.leagueId === league.id &&
              session.session === ResultSession.Sprint,
          ),
      ).length;
      const missingRaceResults = season.races.filter(
        (race) =>
          race.status === "COMPLETED" &&
          !race.resultSessions.some(
            (session) =>
              session.leagueId === league.id &&
              session.session === ResultSession.Race,
          ),
      ).length;
      const championship = season.championships.find(
        (item) => item.leagueId === league.id,
      );

      return {
        id: season.id,
        leagueId: league.id,
        label: `${league.code} · ${season.name}`,
        hasScoring: season.scoringConfigurations.some(
          (configuration) => configuration.leagueId === league.id,
        ),
        missingRaceResults,
        missingSprintResults,
        driverStandings:
          championship?._count.driverStandings ?? 0,
        teamStandings: championship?._count.teamStandings ?? 0,
        recalculatedAt:
          championship?.updatedAt.toISOString() ?? null,
      };
    }),
  );
}
