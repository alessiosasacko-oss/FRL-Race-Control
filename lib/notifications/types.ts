import type {
  NotificationPriority,
  NotificationType,
} from "@/domain";
import { NotificationType as NotificationTypeValue } from "@/domain";

export const activeNotificationTypes = [
  NotificationTypeValue.System,
  NotificationTypeValue.RaceReminder,
  NotificationTypeValue.Championship,
  NotificationTypeValue.Penalty,
  NotificationTypeValue.QualifyingBan,
  NotificationTypeValue.RaceBan,
  NotificationTypeValue.RaceResult,
  NotificationTypeValue.ChampionshipUpdated,
  NotificationTypeValue.NewSeason,
  NotificationTypeValue.NewRace,
  NotificationTypeValue.AdminAnnouncement,
] as const;

export const retiredNotificationTypes = [
  "ATTENDANCE",
  "ATTENDANCE_OPEN",
  "ATTENDANCE_CLOSING_SOON",
  "ATTENDANCE_CLOSED",
  "FIA_TICKET",
  "FIA_DECISION",
] as const;

export type NotificationActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialNotificationActionState: NotificationActionState = {
  status: "idle",
  message: "",
};

export type NotificationListQuery = {
  q: string;
  state: "all" | "unread" | "read" | "archived";
  type?: NotificationType;
  priority?: NotificationPriority;
  page: number;
};

export type NotificationItem = {
  id: number;
  type: NotificationType;
  priority: NotificationPriority;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  archivedAt: string | null;
  createdAt: string;
};

export type NotificationPageData = {
  items: NotificationItem[];
  total: number;
  page: number;
  pageCount: number;
  unreadCount: number;
};

export type NotificationPayload = {
  type: NotificationType;
  priority?: NotificationPriority;
  title: string;
  message: string;
  href?: string | null;
  relatedEntity?: {
    type: string;
    id: number;
  };
  dedupeKey?: string;
};
