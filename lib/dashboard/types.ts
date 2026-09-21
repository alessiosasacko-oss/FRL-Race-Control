import type { NotificationItem as NotificationView } from "@/lib/notifications/types";
import type { DriverCharacterView, TeamSuitView } from "@/lib/characters/types";

export type DashboardData = {
  identity: {
    displayName: string;
    avatarUrl: string | null;
    character: DriverCharacterView;
    teamSuit: TeamSuitView;
    driver: {
      id: number;
      name: string;
      number: number;
      flag: string;
      lineupStatus: string;
      team: { id: number; name: string; shortName: string; color: string; logoUrl: string | null } | null;
      league: { id: number; code: string; name: string };
    } | null;
    season: { id: number; name: string } | null;
  };
  nextRace: {
    id: number;
    name: string;
    circuit: string;
    countryCode: string | null;
    round: number;
    scheduledAt: string;
    timezone: string;
    sprint: boolean;
    mystery: boolean;
    revealed: boolean;
    hero: { desktopUrl: string; mobileUrl: string; alt: string } | null;
  } | null;
  championship: {
    driver: { position: number; points: number; gapToLeader: number; lastRacePoints: number; wins: number; podiums: number } | null;
    team: { position: number; points: number; gapToLeader: number } | null;
    topDrivers: Array<{ position: number; name: string; flag: string; points: number }>;
    topTeams: Array<{ position: number; name: string; color: string; logoUrl: string | null; points: number }>;
  };
  seasonProgress: { completed: number; total: number } | null;
  latestResult: { raceId: number; raceName: string; position: number | null; points: number; publishedAt: string | null } | null;
  notifications: NotificationView[];
  unreadNotificationCount: number;
};

export type DashboardWidgetData = Omit<DashboardData, "identity">;
