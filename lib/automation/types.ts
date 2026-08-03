import type {
  AnnouncementTarget,
  AutomationJobStatus,
  AutomationJobType,
  DiscordChannelPurpose,
  DiscordDeliveryStatus,
  NotificationPriority,
  Role,
} from "@/domain";

export type AutomationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialAutomationActionState: AutomationActionState = {
  status: "idle",
  message: "",
};

export type AutomationDashboardData = {
  guilds: Array<{
    id: number;
    guildId: string;
    guildName: string;
    enabled: boolean;
    botUsername: string | null;
    heartbeatHealthy: boolean;
    lastConnectedAt: string | null;
    lastHeartbeatAt: string | null;
    lastError: string | null;
    channels: Array<{
      id: number;
      leagueId: number | null;
      scopeKey: string;
      purpose: DiscordChannelPurpose;
      channelId: string;
      channelName: string | null;
      enabled: boolean;
    }>;
    roles: Array<{
      id: number;
      role: Role;
      discordRoleId: string;
      discordRoleName: string | null;
      enabled: boolean;
    }>;
  }>;
  leagues: Array<{ id: number; name: string; code: string }>;
  jobs: Array<{
    id: number;
    type: AutomationJobType;
    name: string;
    status: AutomationJobStatus;
    enabled: boolean;
    intervalMinutes: number;
    nextRunAt: string;
    lastRunAt: string | null;
    lastError: string | null;
  }>;
  recentRuns: Array<{
    id: number;
    jobName: string;
    status: AutomationJobStatus;
    startedAt: string;
    finishedAt: string | null;
    error: string | null;
  }>;
  queues: {
    discordPending: number;
    discordFailed: number;
    emailPending: number;
    emailFailed: number;
    scheduledAnnouncements: number;
    failedAnnouncements: number;
    pendingWebhooks: number;
  };
  resultGraphicDeliveries: Array<{
    id: number;
    graphicId: number;
    type: string;
    league: string;
    race: string;
    version: number;
    renderingVersion: number;
    status: string;
    attempts: number;
    channelId: string | null;
    discordMessageId: string | null;
    publicUrl: string | null;
    lastError: string | null;
    updatedAt: string;
  }>;
};

export type AnnouncementListItem = {
  id: number;
  title: string;
  content: string;
  href: string | null;
  priority: NotificationPriority;
  target: AnnouncementTarget;
  status: string;
  pinned: boolean;
  scheduledFor: string;
  publishedAt: string | null;
  author: string;
  lastError: string | null;
};

export type DiscordQueueStatus = DiscordDeliveryStatus;
