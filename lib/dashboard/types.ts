import type { AttendanceStatus } from "@/domain";
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
    round: number;
    scheduledAt: string;
    timezone: string;
    sprint: boolean;
    mystery: boolean;
    attendanceDeadline: string | null;
  } | null;
  attendance: {
    status: AttendanceStatus;
    changedAt: string | null;
    canChange: boolean;
  } | null;
  championship: {
    driver: {
      position: number;
      points: number;
      gapToLeader: number;
      lastRacePoints: number;
      wins: number;
      podiums: number;
    } | null;
    team: {
      position: number;
      points: number;
      gapToLeader: number;
    } | null;
    topDrivers: Array<{
      position: number;
      name: string;
      flag: string;
      points: number;
    }>;
    topTeams: Array<{
      position: number;
      name: string;
      color: string;
      logoUrl: string | null;
      points: number;
    }>;
  };
  seasonProgress: {
    completed: number;
    total: number;
  } | null;
  fia: {
    openTickets: number;
    latestDecisions: Array<{
      id: number;
      ticketId: number;
      title: string;
      penalty: string;
      decidedAt: string;
    }>;
    currentPenalties: Array<{
      ticketId: number;
      title: string;
      penalty: string;
    }>;
  };
  notifications: NotificationView[];
  unreadNotificationCount: number;
};
