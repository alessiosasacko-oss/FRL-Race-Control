import type { MOBILE_API_FEATURES } from "./constants";

export type MobileApiMeta = {
  apiVersion: "v1";
  generatedAt: string;
  league?: string;
  seasonId?: number | null;
  nextCursor?: string | null;
};

export type MobileApiListResponse<T> = {
  data: T[];
  meta: MobileApiMeta;
};

export type MobileApiItemResponse<T> = {
  data: T;
  meta: MobileApiMeta;
};

export type MobileApiErrorResponse = {
  error: {
    code: string;
    message: string;
  };
};

export type MobileLeagueRef = {
  id: number;
  code: string;
  name: string;
};

export type MobileSeasonRef = {
  id: number;
  name: string;
};

export type MobileHealth = {
  ok: true;
  service: "frl-mobile-api";
  version: "v1";
  timestamp: string;
};

export type MobileBootstrap = {
  apiVersion: "v1";
  serverTime: string;
  defaultLeague: string | null;
  minimumSupportedAppVersion: string;
  maintenance: {
    enabled: boolean;
    message: string | null;
  };
  leagues: Array<
    MobileLeagueRef & {
      activeSeason: MobileSeasonRef | null;
    }
  >;
  features: typeof MOBILE_API_FEATURES;
};

export type MobileTrack = {
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
  layoutUrl: string | null;
};

export type MobileCalendarRace = {
  id: number;
  league: MobileLeagueRef;
  season: MobileSeasonRef;
  round: number;
  isMysteryRace: boolean;
  mysteryRevealed: boolean;
  revealAt: string | null;
  name: string;
  circuit: string | null;
  country: string | null;
  countryCode: string | null;
  weekendDate: string;
  scheduledAt: string;
  timezone: string;
  format: "STANDARD" | "SPRINT_WEEKEND";
  sprint: boolean;
  sessions: string[];
  status: string;
  resultPublished: boolean;
  track: MobileTrack | null;
};

export type MobileLeague = MobileLeagueRef & {
  branding: { color: string | null };
  activeSeason: MobileSeasonRef | null;
  publishedRaceCount: number;
  nextRace: MobileCalendarRace | null;
};

export type MobileDriverStanding = {
  type: "DRIVERS";
  position: number;
  positionChange: number | null;
  driver: {
    id: number;
    displayName: string;
    number: number;
    flag: string;
    isSubstitute: boolean;
  };
  team: {
    id: number;
    name: string;
    logoUrl: string | null;
  } | null;
  points: number;
  wins: number;
  podiums: number;
};

export type MobileTeamStanding = {
  type: "TEAMS";
  position: number;
  positionChange: number | null;
  team: {
    id: number;
    name: string;
    logoUrl: string | null;
  };
  points: number;
  wins: number;
};

export type MobileResultOverview = {
  raceId: number;
  raceName: string;
  isMysteryRace: boolean;
  mysteryRevealed: boolean;
  revealAt: string | null;
  league: MobileLeagueRef;
  season: MobileSeasonRef;
  circuit: string | null;
  countryCode: string | null;
  scheduledAt: string;
  availableSessions: string[];
  qualifyingPublished: boolean;
  sprintPublished: boolean;
  racePublished: boolean;
  winner: {
    driverId: number;
    displayName: string;
    teamId: number;
    teamName: string;
  } | null;
  graphicUrl: string | null;
};

export type MobileResultRow = {
  position: number | null;
  driver: {
    id: number;
    displayName: string;
    number: number;
    flag: string;
  };
  team: {
    id: number;
    name: string;
    logoUrl: string | null;
  };
  status: string;
  time: {
    totalMs: number | null;
    qualifyingMs: number | null;
    gapToWinnerMs: number | null;
    gapToPreviousMs: number | null;
    lapsBehind: number;
  };
  points: number;
  fastestLap: boolean;
  fastestLapMs: number | null;
  penaltySeconds: number;
  disqualified: boolean;
};

export type MobileResultDetail = {
  race: {
    id: number;
    name: string;
    circuit: string | null;
    countryCode: string | null;
    round: number;
    scheduledAt: string;
    status: string;
    isMysteryRace: boolean;
    mysteryRevealed: boolean;
    revealAt: string | null;
    league: MobileLeagueRef;
    season: MobileSeasonRef;
  };
  sessions: Array<{
    session: string;
    publishedAt: string | null;
    results: MobileResultRow[];
  }>;
};

export type MobileChampionshipStanding =
  | MobileDriverStanding
  | MobileTeamStanding;
