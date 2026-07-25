import type { Role } from "@/domain";

export type ProfileData = {
  user: {
    displayName: string;
    avatarUrl: string | null;
    roles: Role[];
  };
  driver: {
    id: number;
    name: string;
    number: number;
    flag: string;
    countryCode: string;
    team: {
      id: number;
      name: string;
      color: string;
    } | null;
    league: {
      id: number;
      code: string;
      name: string;
    };
  } | null;
  statistics: {
    races: number;
    wins: number;
    podiums: number;
    poles: number;
    fastestLaps: number;
    championships: number;
    attendancePercentage: number;
    penalties: number;
  };
};
