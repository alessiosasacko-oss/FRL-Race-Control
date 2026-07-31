import type {
  NotificationType,
  Role,
} from "@/domain";

export type SettingsActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialSettingsActionState: SettingsActionState = {
  status: "idle",
  message: "",
};

export type SettingsPageData = {
  user: {
    displayName: string;
    email: string | null;
    avatarUrl: string | null;
    discordId: string | null;
    discordUsername: string | null;
    discordGlobalName: string | null;
    discordGuildNickname: string | null;
    discordVerifiedAt: string | null;
    discordSyncedAt: string | null;
    roles: Role[];
  };
  driver: {
    id: number;
    name: string;
    number: number;
    flag: string;
    team: string | null;
    league: string;
  } | null;
  settings: {
    inAppEnabled: boolean;
    inAppCategories: NotificationType[];
    emailEnabled: boolean;
    emailCategories: NotificationType[];
    quietHoursEnabled: boolean;
    quietHoursStart: string;
    quietHoursEnd: string;
    timezone: string;
    theme: "dark" | "light" | "system";
    language: "de";
  };
};
