import type {
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

export type SportsActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialSportsActionState: SportsActionState = {
  status: "idle",
  message: "",
};

export type SportsListQuery = {
  q: string;
  leagueId?: number;
  seasonId?: number;
  raceId?: number;
  teamId?: number;
  attendanceStatus?: AttendanceStatus;
  table: "drivers" | "teams";
};

export type RaceOption = {
  id: number;
  name: string;
  circuit: string | null;
  countryCode: string | null;
  round: number;
  leagueScheduleId: number;
  scheduledAt: string;
  timezone: string;
  sprint: boolean;
  doublePoints: boolean;
  mystery: boolean;
  attendanceDeadline: string | null;
  season: {
    id: number;
    name: string;
    archived: boolean;
    league: { id: number; code: string; name: string };
  };
};

export type AttendanceEntryView = {
  driver: {
    id: number;
    name: string;
    number: number;
    flag: string;
    userId: number | null;
    team: { id: number; name: string; color: string } | null;
  };
  status: AttendanceStatus;
  substitute: {
    id: number;
    name: string;
    number: number;
    flag: string;
  } | null;
  representedTeam: { id: number; name: string } | null;
  submittedBy: { id: number; displayName: string } | null;
  changeSource: AttendanceChangeSource | null;
  changeReason: string | null;
  changedAt: string | null;
};

export type AttendancePageData = {
  accessibleLeagues: Array<{ id: number; code: string; name: string }>;
  selectedLeague: { id: number; code: string; name: string } | null;
  races: RaceOption[];
  selectedRace: RaceOption | null;
  entries: AttendanceEntryView[];
  teams: Array<{ id: number; name: string }>;
  substituteDrivers: Array<{
    id: number;
    name: string;
    number: number;
    flag: string;
  }>;
  ownDriverId: number | null;
  principalTeamIds: number[];
  counts: Record<AttendanceStatus, number>;
  auditEntries: Array<{
    id: number;
    driverName: string;
    previousStatus: AttendanceStatus;
    newStatus: AttendanceStatus;
    source: AttendanceChangeSource;
    actorRole: Role;
    actorName: string | null;
    reason: string | null;
    createdAt: string;
  }>;
};

export type DriverStandingView = {
  position: number;
  points: number;
  racePoints: number;
  sprintPoints: number;
  bonusPoints: number;
  adjustments: number;
  wins: number;
  podiums: number;
  polePositions: number;
  fastestLaps: number;
  starts: number;
  dnfs: number;
  dsqs: number;
  bestResult: number | null;
  substituteStarts: number;
  penaltyPoints: number;
  tieBreakSummary: string;
  driver: {
    id: number;
    name: string;
    number: number;
    flag: string;
    team: { id: number; name: string; color: string } | null;
  };
};

export type TeamStandingView = {
  position: number;
  points: number;
  racePoints: number;
  sprintPoints: number;
  bonusPoints: number;
  adjustments: number;
  wins: number;
  podiums: number;
  polePositions: number;
  fastestLaps: number;
  tieBreakSummary: string;
  team: {
    id: number;
    name: string;
    shortName: string;
    color: string;
  };
};

export type ChampionshipPageData = {
  leagues: Array<{ id: number; code: string; name: string }>;
  seasons: Array<{
    id: number;
    leagueId: number;
    name: string;
    archived: boolean;
  }>;
  selectedSeason: {
    id: number;
    name: string;
    league: { id: number; code: string; name: string };
  } | null;
  drivers: DriverStandingView[];
  teams: TeamStandingView[];
  updatedAt: string | null;
};

export type ResultRowView = {
  id: number;
  driverId: number;
  representedTeamId: number;
  expectedDriverId: number | null;
  position: number | null;
  startingPosition: number | null;
  baseStatus: ResultStatus;
  status: ResultStatus;
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
  driver: {
    id: number;
    name: string;
    number: number;
    flag: string;
  };
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
    ticketId: number | null;
    source: ResultPenaltySource;
    penaltyType: PenaltyType;
    penaltyMilliseconds: number;
    disqualified: boolean;
    reason: string | null;
    active: boolean;
  }>;
};

export type ResultSessionView = {
  id: number;
  session: ResultSession;
  gapMode: ResultGapMode;
  publicationStatus: ResultPublicationStatus;
  fiaPenaltyVersion: string | null;
  currentFiaPenaltyVersion: string;
  fiaPenaltiesChanged: boolean;
  revision: number;
  lockedAt: string | null;
  publishedAt: string | null;
  draftPayload: {
    gapMode: ResultGapMode;
    results: Array<{
      driverId: number | null;
      representedTeamId: number | null;
      expectedDriverId: number | null;
      position: number;
      startingPosition: number | null;
      status: ResultStatus;
      gapInput: string;
      fastestLapInput: string;
      legacyFastestLap: boolean;
      polePosition: boolean;
      lapsCompleted: number;
      manualOverride: boolean;
      manualPenaltySeconds: number;
      manualDisqualified: boolean;
      manualOverrideReason: string | null;
      notes: string | null;
      substitute: boolean;
    }>;
  } | null;
  results: ResultRowView[];
};

export type RaceResultsView = {
  race: RaceOption & {
    circuit: string;
    countryCode: string;
    status: string;
    revealMystery: boolean;
  };
  sessions: ResultSessionView[];
};

export type ResultAdminData = {
  races: RaceOption[];
  selected: RaceResultsView | null;
  drivers: Array<{
    id: number;
    name: string;
    number: number;
    flag: string;
    discordName: string | null;
    teamId: number | null;
    teamName: string | null;
    registered: boolean;
    registrationOrder: number | null;
    replacement: boolean;
    expectedDriverId: number | null;
  }>;
  teams: Array<{
    id: number;
    name: string;
    shortName: string;
    color: string;
  }>;
  fiaPenalties: Array<{
    decisionId: number;
    ticketId: number;
    driverId: number;
    penaltyType: PenaltyType;
    penaltyValue: number | null;
    reason: string;
    updatedAt: string;
    session: RaceSession;
  }>;
  scoring: {
    fastestLapPoint: number;
    fastestLapRequiresTopPosition: number | null;
    polePositionPoint: number;
    dnfScoresPoints: boolean;
    retiredScoresPoints: boolean;
    minimumClassifiedPercentage: number | null;
    teamPointsEnabled: boolean;
    substituteDriverPointsEnabled: boolean;
    positions: Array<{
      session: ResultSession;
      position: number;
      points: number;
    }>;
  };
};
