import type { RaceSession, RaceStatus, Role } from "@/domain";

export type MasterDataActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialMasterDataActionState: MasterDataActionState = {
  status: "idle",
  message: "",
};

export type LeagueOption = {
  id: number;
  code: string;
  name: string;
};

export type SeasonOption = {
  id: number;
  leagueId: number;
  participatingLeagueIds: number[];
  name: string;
  active: boolean;
  archived: boolean;
};

export type TeamOption = {
  id: number;
  leagueId: number;
  seasonId: number;
  name: string;
};

export type UserOption = {
  id: number;
  displayName: string;
  discordId: string | null;
  roles: Role[];
};

export type DriverOption = {
  id: number;
  leagueId: number;
  teamId: number | null;
  name: string;
  number: number;
  teamName: string | null;
  active: boolean;
};

export type MasterDataFilterOptions = {
  leagues: LeagueOption[];
  seasons: SeasonOption[];
};

export type MasterDataOptions = {
  leagues: LeagueOption[];
  seasons: SeasonOption[];
  teams: TeamOption[];
  users: UserOption[];
  drivers: DriverOption[];
};

export type LeagueAdminItem = LeagueOption & {
  description: string | null;
  active: boolean;
  currentSeasonId: number | null;
  seasons: SeasonOption[];
  counts: {
    drivers: number;
    teams: number;
    tickets: number;
  };
};

export type SeasonAdminItem = {
  id: number;
  leagueId: number;
  name: string;
  startsOn: string;
  endsOn: string;
  active: boolean;
  archived: boolean;
  league: LeagueOption;
  participatingLeagues: LeagueOption[];
  counts: { races: number; teams: number };
};

export type RaceItem = {
  id: number;
  seasonId: number;
  name: string;
  circuit: string | null;
  countryCode: string | null;
  round: number;
  scheduledAt: string;
  localStart: string;
  timezone: string;
  status: RaceStatus;
  sessions: RaceSession[];
  sprint: boolean;
  doublePoints: boolean;
  mystery: boolean;
  trackRevealed: boolean;
  attendanceDeadline: string | null;
  attendanceDeadlineLocal: string;
  season: {
    id: number;
    name: string;
    leagues: LeagueOption[];
  };
  ticketCount: number;
};

export type DriverItem = {
  id: number;
  name: string;
  number: number;
  flag: string;
  countryCode: string;
  active: boolean;
  userId: number | null;
  league: LeagueOption;
  team: {
    id: number;
    name: string;
    shortName: string;
    color: string;
  } | null;
  user: {
    id: number;
    displayName: string;
    discordId: string | null;
  } | null;
  updatedAt: string;
};

export type DriverDetail = DriverItem & {
  ticketCount: number;
  standingCount: number;
};

export type TeamItem = {
  id: number;
  name: string;
  shortName: string;
  color: string;
  active: boolean;
  league: LeagueOption;
  season: { id: number; name: string };
  principal: {
    id: number;
    displayName: string;
    discordId: string | null;
  } | null;
  drivers: Array<{
    id: number;
    name: string;
    number: number;
    flag: string;
    active: boolean;
  }>;
  updatedAt: string;
};

export type TeamDetail = TeamItem & {
  standingCount: number;
};
