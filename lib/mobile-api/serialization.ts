import { countryName } from "@/lib/countries";
import {
  MYSTERY_TRACK_REVEAL_LEAD_MS,
  publicRaceTrack,
} from "@/lib/races/visibility";
import {
  MOBILE_API_FEATURES,
  MOBILE_API_SERVICE,
  MOBILE_API_VERSION,
} from "./constants";
import type {
  MobileBootstrap,
  MobileCalendarRace,
  MobileDriverStanding,
  MobileHealth,
  MobileLeagueRef,
  MobileResultDetail,
  MobileResultOverview,
  MobileTeamStanding,
} from "./types";

export function createHealthPayload(now = new Date()): MobileHealth {
  return {
    ok: true,
    service: MOBILE_API_SERVICE,
    version: MOBILE_API_VERSION,
    timestamp: now.toISOString(),
  };
}

export function createBootstrapPayload(
  input: {
    defaultLeague: string | null;
    minimumSupportedAppVersion: string;
    maintenance: MobileBootstrap["maintenance"];
    leagues: Array<{
      id: number;
      code: string;
      name: string;
      active: boolean;
      activeSeason: { id: number; name: string } | null;
    }>;
  },
  now = new Date(),
): MobileBootstrap {
  const leagues = input.leagues
    .filter((league) => league.active)
    .map((league) => ({
      id: league.id,
      code: league.code,
      name: league.name,
      activeSeason: league.activeSeason,
    }));
  const configuredDefault = leagues.some(
    (league) => league.code === input.defaultLeague,
  )
    ? input.defaultLeague
    : leagues[0]?.code ?? null;
  return {
    apiVersion: MOBILE_API_VERSION,
    serverTime: now.toISOString(),
    defaultLeague: configuredDefault,
    minimumSupportedAppVersion: input.minimumSupportedAppVersion,
    maintenance: input.maintenance,
    leagues,
    features: MOBILE_API_FEATURES,
  };
}

type CalendarRaceInput = {
  id: number;
  name: string;
  circuit: string | null;
  countryCode: string | null;
  round: number;
  weekendDate: Date;
  scheduledAt: Date;
  timezone: string;
  status: string;
  sessions: readonly string[];
  sprint: boolean;
  mystery: boolean;
  track: {
    id: number;
    name: string;
    countryCode: string;
    lengthKm: number | null;
    lapCount: number | null;
    sectorCount: number;
    smStraightModeZones: number | null;
    longestStraightM: number | null;
    poleSide: string | null;
    pitLaneLossSeconds: number | null;
    visual: { layoutAsset: string | null } | null;
  } | null;
  resultSessions: ReadonlyArray<{ session: string; publicationStatus?: string }>;
};

export function mysteryRevealAt(race: {
  mystery: boolean;
  scheduledAt: Date;
}): string | null {
  if (!race.mystery) return null;
  return new Date(
    race.scheduledAt.getTime() - MYSTERY_TRACK_REVEAL_LEAD_MS,
  ).toISOString();
}

export function serializeCalendarRace(
  race: CalendarRaceInput,
  league: MobileLeagueRef,
  season: { id: number; name: string },
  options: { scheduledAt?: Date; timezone?: string; now?: Date } = {},
): MobileCalendarRace {
  const now = options.now ?? new Date();
  const publicTrack = publicRaceTrack(race, now);
  const revealedTrack = publicTrack.revealed ? race.track : null;
  const countryCode = publicTrack.countryCode;

  return {
    id: race.id,
    league,
    season,
    round: race.round,
    isMysteryRace: race.mystery,
    mysteryRevealed: publicTrack.revealed,
    revealAt: mysteryRevealAt(race),
    name: publicTrack.revealed ? publicTrack.name : "Mystery Race",
    circuit: publicTrack.circuit,
    country: countryCode ? countryName(countryCode) : null,
    countryCode,
    weekendDate: race.weekendDate.toISOString(),
    scheduledAt: (options.scheduledAt ?? race.scheduledAt).toISOString(),
    timezone: options.timezone ?? race.timezone,
    format: race.sprint ? "SPRINT_WEEKEND" : "STANDARD",
    sprint: race.sprint,
    sessions: [...race.sessions],
    status: race.status,
    resultPublished: race.resultSessions.some(
      (session) =>
        session.publicationStatus === undefined ||
        session.publicationStatus === "PUBLISHED",
    ),
    track: revealedTrack
      ? {
          id: revealedTrack.id,
          name: revealedTrack.name,
          countryCode: revealedTrack.countryCode,
          lengthKm: revealedTrack.lengthKm,
          lapCount: revealedTrack.lapCount,
          sectorCount: revealedTrack.sectorCount,
          smStraightModeZones: revealedTrack.smStraightModeZones,
          longestStraightM: revealedTrack.longestStraightM,
          poleSide: revealedTrack.poleSide,
          pitLaneLossSeconds: revealedTrack.pitLaneLossSeconds,
          layoutUrl: revealedTrack.visual?.layoutAsset ?? null,
        }
      : null,
  };
}

type DriverStandingInput = {
  position: number;
  points: number;
  wins: number;
  podiums: number;
  substituteStarts: number;
  driver: {
    id: number;
    name: string;
    number: number;
    flag: string;
    team: { id: number; name: string; logoUrl: string | null } | null;
  };
};

export function serializeDriverStanding(
  standing: DriverStandingInput,
): MobileDriverStanding {
  return {
    type: "DRIVERS",
    position: standing.position,
    positionChange: null,
    driver: {
      id: standing.driver.id,
      displayName: standing.driver.name,
      number: standing.driver.number,
      flag: standing.driver.flag,
      isSubstitute: standing.substituteStarts > 0,
    },
    team: standing.driver.team
      ? {
          id: standing.driver.team.id,
          name: standing.driver.team.name,
          logoUrl: standing.driver.team.logoUrl,
        }
      : null,
    points: standing.points,
    wins: standing.wins,
    podiums: standing.podiums,
  };
}

type TeamStandingInput = {
  position: number;
  points: number;
  wins: number;
  team: { id: number; name: string; logoUrl: string | null };
};

export function serializeTeamStanding(
  standing: TeamStandingInput,
): MobileTeamStanding {
  return {
    type: "TEAMS",
    position: standing.position,
    positionChange: null,
    team: {
      id: standing.team.id,
      name: standing.team.name,
      logoUrl: standing.team.logoUrl,
    },
    points: standing.points,
    wins: standing.wins,
  };
}

type ResultOverviewInput = {
  id: number;
  name: string;
  circuit: string | null;
  countryCode: string | null;
  scheduledAt: Date;
  mystery: boolean;
  season: { id: number; name: string };
  resultSessions: Array<{
    session: string;
    publicationStatus: string;
    results: Array<{
      finalPosition: number | null;
      position: number | null;
      driver: { id: number; name: string };
      representedTeam: { id: number; name: string };
    }>;
  }>;
  resultGraphics: Array<{ publicUrl: string | null }>;
};

export function serializeResultOverview(
  race: ResultOverviewInput,
  league: MobileLeagueRef,
  now = new Date(),
): MobileResultOverview {
  const publicTrack = publicRaceTrack(race, now);
  const publishedSessions = race.resultSessions.filter(
    (session) => session.publicationStatus === "PUBLISHED",
  ).sort(
    (left, right) =>
      ["QUALIFYING", "SPRINT", "RACE"].indexOf(left.session) -
      ["QUALIFYING", "SPRINT", "RACE"].indexOf(right.session),
  );
  const raceSession = publishedSessions.find(
    (session) => session.session === "RACE",
  );
  const winnerRow = raceSession?.results.find(
    (result) => (result.finalPosition ?? result.position) === 1,
  );
  const availableSessions = publishedSessions.map((session) => session.session);

  return {
    raceId: race.id,
    raceName: publicTrack.revealed ? publicTrack.name : "Mystery Race",
    isMysteryRace: race.mystery,
    mysteryRevealed: publicTrack.revealed,
    revealAt: mysteryRevealAt(race),
    league,
    season: race.season,
    circuit: publicTrack.circuit,
    countryCode: publicTrack.countryCode,
    scheduledAt: race.scheduledAt.toISOString(),
    availableSessions,
    qualifyingPublished: availableSessions.includes("QUALIFYING"),
    sprintPublished: availableSessions.includes("SPRINT"),
    racePublished: availableSessions.includes("RACE"),
    winner: winnerRow
      ? {
          driverId: winnerRow.driver.id,
          displayName: winnerRow.driver.name,
          teamId: winnerRow.representedTeam.id,
          teamName: winnerRow.representedTeam.name,
        }
      : null,
    graphicUrl: race.resultGraphics[0]?.publicUrl ?? null,
  };
}

type ResultDetailInput = {
  race: {
    id: number;
    name: string;
    circuit: string;
    countryCode: string;
    round: number;
    scheduledAt: string;
    status: string;
    mystery: boolean;
    revealMystery: boolean;
    season: {
      id: number;
      name: string;
      league: MobileLeagueRef;
    };
  };
  sessions: Array<{
    session: string;
    publicationStatus: string;
    publishedAt: string | null;
    results: Array<{
      finalPosition: number | null;
      position: number | null;
      status: string;
      totalTimeMs: number | null;
      qualifyingTimeMs: number | null;
      gapToWinnerMs: number | null;
      gapToPreviousMs: number | null;
      lapsBehind: number;
      racePoints: number;
      bonusPoints: number;
      fastestLap: boolean;
      fastestLapMs: number | null;
      effectivePenaltyMs: number;
      driver: { id: number; name: string; number: number; flag: string };
      representedTeam: {
        id: number;
        name: string;
        logoUrl: string | null;
      };
    }>;
  }>;
};

const SESSION_ORDER = ["QUALIFYING", "SPRINT", "RACE"];

export function serializeResultDetail(
  value: ResultDetailInput,
): MobileResultDetail {
  return {
    race: {
      id: value.race.id,
      name: value.race.revealMystery ? value.race.name : "Mystery Race",
      circuit: value.race.revealMystery ? value.race.circuit : null,
      countryCode: value.race.revealMystery ? value.race.countryCode : null,
      round: value.race.round,
      scheduledAt: value.race.scheduledAt,
      status: value.race.status,
      isMysteryRace: value.race.mystery,
      mysteryRevealed: value.race.revealMystery,
      revealAt: value.race.mystery
        ? new Date(
            new Date(value.race.scheduledAt).getTime() -
              MYSTERY_TRACK_REVEAL_LEAD_MS,
          ).toISOString()
        : null,
      league: value.race.season.league,
      season: {
        id: value.race.season.id,
        name: value.race.season.name,
      },
    },
    sessions: value.sessions
      .filter((session) => session.publicationStatus === "PUBLISHED")
      .sort(
        (left, right) =>
          SESSION_ORDER.indexOf(left.session) -
          SESSION_ORDER.indexOf(right.session),
      )
      .map((session) => ({
        session: session.session,
        publishedAt: session.publishedAt,
        results: session.results.map((result) => ({
          position: result.finalPosition ?? result.position,
          driver: {
            id: result.driver.id,
            displayName: result.driver.name,
            number: result.driver.number,
            flag: result.driver.flag,
          },
          team: {
            id: result.representedTeam.id,
            name: result.representedTeam.name,
            logoUrl: result.representedTeam.logoUrl,
          },
          status: result.status,
          time: {
            totalMs: result.totalTimeMs,
            qualifyingMs: result.qualifyingTimeMs,
            gapToWinnerMs: result.gapToWinnerMs,
            gapToPreviousMs: result.gapToPreviousMs,
            lapsBehind: result.lapsBehind,
          },
          points: result.racePoints + result.bonusPoints,
          fastestLap: result.fastestLap,
          fastestLapMs: result.fastestLapMs,
          penaltySeconds: result.effectivePenaltyMs / 1000,
          disqualified: result.status === "DSQ",
        })),
      })),
  };
}

export function toJsonSafe(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(toJsonSafe);
  if (value && typeof value === "object") {
    if (
      value.constructor?.name === "Decimal" &&
      "toString" in value &&
      typeof value.toString === "function"
    ) {
      return value.toString();
    }
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [key, toJsonSafe(item)]),
    );
  }
  return value;
}
