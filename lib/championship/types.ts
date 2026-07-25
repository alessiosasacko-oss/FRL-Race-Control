import type {
  AttendanceStatus,
  ResultSession,
  ResultStatus,
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
  round: number;
  scheduledAt: string;
  sprint: boolean;
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
  changedAt: string | null;
};

export type AttendancePageData = {
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
  status: ResultStatus;
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
};

export type ResultSessionView = {
  id: number;
  session: ResultSession;
  lockedAt: string | null;
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
  }>;
  teams: Array<{
    id: number;
    name: string;
    shortName: string;
    color: string;
  }>;
};
