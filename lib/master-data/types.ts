import type {
  DriverLineupStatus,
  RaceSession,
  RaceStatus,
  Role,
} from "@/domain";
import type {
  TeamActiveDriver,
  TeamDependencyCounts,
} from "./team-lifecycle";

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
  participatingLeagueIds: number[];
  name: string;
  active: boolean;
  archived: boolean;
};

export type UserOption = {
  id: number;
  displayName: string;
  discordId: string | null;
  roles: Role[];
  driverId: number | null;
};

export type DriverOption = {
  id: number;
  leagueId: number | null;
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
  users: UserOption[];
  drivers: DriverOption[];
  organizations: TeamOrganizationOption[];
};

export type DriverFormOptions = {
  leagues: LeagueOption[];
  seasons: SeasonOption[];
  organizations: TeamOrganizationOption[];
  users: UserOption[];
};

export type TeamOrganizationOption = {
  id: number;
  name: string;
  shortName: string;
  color: string;
  logoUrl: string | null;
  active: boolean;
};

export type TeamOrganizationItem = TeamOrganizationOption & {
  secondaryColor: string | null;
  contrastColor: string | null;
  logoUrl: string | null;
  archivedAt: string | null;
  currentSeasonId: number | null;
  currentSeasonName: string | null;
  principal: {
    id: number;
    displayName: string;
  } | null;
  seasons: Array<{
    seasonId: number;
    seasonName: string;
    principal: {
      id: number;
      displayName: string;
    } | null;
  }>;
  leagues: Array<{
    id: number;
    code: string;
    name: string;
    primaryDrivers: Array<{
      id: number;
      userId: number | null;
      name: string;
      number: number;
      countryCode: string;
    }>;
    substitutes: Array<{
      id: number;
      userId: number | null;
      name: string;
      number: number;
      countryCode: string;
    }>;
  }>;
  dependencies: TeamDependencyCounts;
  activeDrivers: TeamActiveDriver[];
  canPermanentlyDelete: boolean;
};

export type LeagueAdminItem = LeagueOption & {
  description: string | null;
  active: boolean;
  currentSeasonId: number | null;
  raceWeekday: number;
  raceStartMinute: number;
  raceTimezone: string;
  displayOrder: number;
  futureSchedules: Array<{
    id: number;
    raceId: number;
    raceName: string;
    round: number;
    weekendDate: string;
    scheduledAt: string;
  }>;
  counts: {
    drivers: number;
    teams: number;
  };
};

export type SeasonAdminItem = {
  id: number;
  name: string;
  startsOn: string;
  endsOn: string;
  active: boolean;
  isCurrent: boolean;
  archived: boolean;
  participatingLeagues: LeagueOption[];
  counts: { races: number; teams: number };
};

export type RaceItem = {
  id: number;
  seasonId: number;
  trackId: number | null;
  name: string;
  circuit: string | null;
  countryCode: string | null;
  round: number;
  weekendDate: string;
  scheduledAt: string;
  localStart: string;
  timezone: string;
  status: RaceStatus;
  sessions: RaceSession[];
  sprint: boolean;
  doublePoints: boolean;
  mystery: boolean;
  trackRevealed: boolean;
  hero: { desktopUrl: string; mobileUrl: string; alt: string } | null;
  visual: {
    desktopHeroAsset: string | null;
    mobileHeroAsset: string | null;
    heroAltText: string | null;
  } | null;
  leagueSchedules: Array<{
    id: number;
    league: LeagueOption;
    scheduledAt: string;
    localStart: string;
    timezone: string;
  }>;
  season: {
    id: number;
    name: string;
    leagues: LeagueOption[];
  };
};

export type DriverItem = {
  id: number;
  imageUrl: string | null;
  name: string;
  number: number;
  flag: string;
  countryCode: string;
  active: boolean;
  userId: number | null;
  league: LeagueOption | null;
  team: {
    id: number;
    name: string;
    shortName: string;
    color: string;
    logoUrl: string | null;
  } | null;
  assignment: {
    season: SeasonOption;
    league: LeagueOption;
    organization: TeamOrganizationOption | null;
    lineupStatus: DriverLineupStatus;
    active: boolean;
    source: "CANONICAL" | "LEGACY_FALLBACK";
  } | null;
  diagnostics: string[];
  user: {
    id: number;
    displayName: string;
    discordId: string | null;
  } | null;
  updatedAt: string;
};

export type DriverDetail = DriverItem & {
  careerStats: import("@/lib/drivers/career-stats").DriverCareerStatsView;
  standingCount: number;
  standing: {
    position: number;
    points: number;
    wins: number;
    podiums: number;
    polePositions: number;
    fastestLaps: number;
  } | null;
};
