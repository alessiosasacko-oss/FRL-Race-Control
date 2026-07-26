import { z } from "zod";

export enum Role {
  SuperAdmin = "SUPER_ADMIN",
  Admin = "ADMIN",
  FiaPresident = "FIA_PRESIDENT",
  Steward = "STEWARD",
  TeamPrincipal = "TEAM_PRINCIPAL",
  Driver = "DRIVER",
}

export enum TicketStatus {
  Open = "OPEN",
  InReview = "IN_REVIEW",
  Resolved = "RESOLVED",
}

export enum PenaltyType {
  NoFurtherAction = "NO_FURTHER_ACTION",
  Warning = "WARNING",
  Reprimand = "REPRIMAND",
  TimePenalty = "TIME_PENALTY",
  GridPenalty = "GRID_PENALTY",
  DriveThrough = "DRIVE_THROUGH",
  StopAndGo = "STOP_AND_GO",
  Disqualification = "DISQUALIFICATION",
  PointsDeduction = "POINTS_DEDUCTION",
}

export enum RaceSession {
  Practice = "PRACTICE",
  Qualifying = "QUALIFYING",
  Sprint = "SPRINT",
  Race = "RACE",
}

export enum RaceStatus {
  Scheduled = "SCHEDULED",
  InProgress = "IN_PROGRESS",
  Completed = "COMPLETED",
  Cancelled = "CANCELLED",
}

export enum AttendanceStatus {
  Registered = "REGISTERED",
  Declined = "DECLINED",
  NoResponse = "NO_RESPONSE",
}

export enum ResultSession {
  Race = "RACE",
  Sprint = "SPRINT",
}

export enum ResultStatus {
  Finished = "FINISHED",
  Dnf = "DNF",
  Dns = "DNS",
  Dsq = "DSQ",
  Retired = "RETIRED",
}

export enum ChampionshipAdjustmentTarget {
  Driver = "DRIVER",
  Team = "TEAM",
}

export enum ChampionshipAuditAction {
  AttendanceChanged = "ATTENDANCE_CHANGED",
  ResultCreated = "RESULT_CREATED",
  ResultUpdated = "RESULT_UPDATED",
  ResultDeleted = "RESULT_DELETED",
  ScoringChanged = "SCORING_CHANGED",
  AdjustmentCreated = "ADJUSTMENT_CREATED",
  ChampionshipRecalculated = "CHAMPIONSHIP_RECALCULATED",
}

export enum NotificationType {
  System = "SYSTEM",
  RaceReminder = "RACE_REMINDER",
  Attendance = "ATTENDANCE",
  FiaTicket = "FIA_TICKET",
  FiaDecision = "FIA_DECISION",
  Championship = "CHAMPIONSHIP",
  Penalty = "PENALTY",
  QualifyingBan = "QUALIFYING_BAN",
  RaceBan = "RACE_BAN",
  AttendanceOpen = "ATTENDANCE_OPEN",
  AttendanceClosingSoon = "ATTENDANCE_CLOSING_SOON",
  AttendanceClosed = "ATTENDANCE_CLOSED",
  RaceResult = "RACE_RESULT",
  ChampionshipUpdated = "CHAMPIONSHIP_UPDATED",
  NewSeason = "NEW_SEASON",
  NewRace = "NEW_RACE",
  AdminAnnouncement = "ADMIN_ANNOUNCEMENT",
}

export enum NotificationPriority {
  Low = "LOW",
  Normal = "NORMAL",
  High = "HIGH",
  Urgent = "URGENT",
}

export enum EmailDeliveryStatus {
  Pending = "PENDING",
  Sending = "SENDING",
  Sent = "SENT",
  Skipped = "SKIPPED",
  Failed = "FAILED",
}

export enum DiscordChannelPurpose {
  AttendanceOpened = "ATTENDANCE_OPENED",
  AttendanceClosingSoon = "ATTENDANCE_CLOSING_SOON",
  AttendanceClosed = "ATTENDANCE_CLOSED",
  RaceWeekend = "RACE_WEEKEND",
  SprintResults = "SPRINT_RESULTS",
  RaceResults = "RACE_RESULTS",
  DriverStandings = "DRIVER_STANDINGS",
  TeamStandings = "TEAM_STANDINGS",
  FiaDecision = "FIA_DECISION",
  PenaltyIssued = "PENALTY_ISSUED",
  SeasonStarted = "SEASON_STARTED",
  SeasonFinished = "SEASON_FINISHED",
  AdminAnnouncement = "ADMIN_ANNOUNCEMENT",
}

export enum DiscordDeliveryStatus {
  Pending = "PENDING",
  Sending = "SENDING",
  Sent = "SENT",
  Failed = "FAILED",
  Skipped = "SKIPPED",
}

export enum AnnouncementTarget {
  App = "APP",
  Discord = "DISCORD",
  Email = "EMAIL",
  All = "ALL",
}

export enum AnnouncementStatus {
  Scheduled = "SCHEDULED",
  Published = "PUBLISHED",
  Failed = "FAILED",
  Cancelled = "CANCELLED",
}

export enum AutomationJobType {
  AttendanceReminders = "ATTENDANCE_REMINDERS",
  UpcomingRaceReminders = "UPCOMING_RACE_REMINDERS",
  ChampionshipVerification = "CHAMPIONSHIP_VERIFICATION",
  NotificationCleanup = "NOTIFICATION_CLEANUP",
  EmailQueue = "EMAIL_QUEUE",
  DiscordQueue = "DISCORD_QUEUE",
  MysteryRacePublication = "MYSTERY_RACE_PUBLICATION",
  StatisticsRefresh = "STATISTICS_REFRESH",
  AnnouncementPublication = "ANNOUNCEMENT_PUBLICATION",
  DiscordRoleSync = "DISCORD_ROLE_SYNC",
}

export enum AutomationJobStatus {
  Scheduled = "SCHEDULED",
  Running = "RUNNING",
  Completed = "COMPLETED",
  Failed = "FAILED",
  Disabled = "DISABLED",
}

export enum WebhookEventType {
  RaceFinished = "RACE_FINISHED",
  AttendanceChanged = "ATTENDANCE_CHANGED",
  FiaDecision = "FIA_DECISION",
  ChampionshipRecalculated = "CHAMPIONSHIP_RECALCULATED",
  NotificationCreated = "NOTIFICATION_CREATED",
  UserUpdated = "USER_UPDATED",
  DiscordSynchronized = "DISCORD_SYNCHRONIZED",
}

export enum WebhookEventStatus {
  Pending = "PENDING",
  Processing = "PROCESSING",
  Processed = "PROCESSED",
  Failed = "FAILED",
}

export enum EvidenceType {
  Link = "LINK",
  Image = "IMAGE",
  Video = "VIDEO",
  Document = "DOCUMENT",
}

export enum TicketAuditAction {
  Created = "CREATED",
  StatusChanged = "STATUS_CHANGED",
  EvidenceAdded = "EVIDENCE_ADDED",
  EvidenceRemoved = "EVIDENCE_REMOVED",
  DiscussionMessageAdded = "DISCUSSION_MESSAGE_ADDED",
  VoteRecorded = "VOTE_RECORDED",
  DecisionPublished = "DECISION_PUBLISHED",
}

export const roleSchema = z.enum(Role);
export const ticketStatusSchema = z.enum(TicketStatus);
export const penaltyTypeSchema = z.enum(PenaltyType);
export const raceSessionSchema = z.enum(RaceSession);
export const raceStatusSchema = z.enum(RaceStatus);
export const attendanceStatusSchema = z.enum(AttendanceStatus);
export const resultSessionSchema = z.enum(ResultSession);
export const resultStatusSchema = z.enum(ResultStatus);
export const championshipAdjustmentTargetSchema = z.enum(
  ChampionshipAdjustmentTarget,
);
export const championshipAuditActionSchema = z.enum(
  ChampionshipAuditAction,
);
export const notificationTypeSchema = z.enum(NotificationType);
export const notificationPrioritySchema = z.enum(NotificationPriority);
export const emailDeliveryStatusSchema = z.enum(EmailDeliveryStatus);
export const discordChannelPurposeSchema = z.enum(DiscordChannelPurpose);
export const discordDeliveryStatusSchema = z.enum(DiscordDeliveryStatus);
export const announcementTargetSchema = z.enum(AnnouncementTarget);
export const announcementStatusSchema = z.enum(AnnouncementStatus);
export const automationJobTypeSchema = z.enum(AutomationJobType);
export const automationJobStatusSchema = z.enum(AutomationJobStatus);
export const webhookEventTypeSchema = z.enum(WebhookEventType);
export const webhookEventStatusSchema = z.enum(WebhookEventStatus);
export const evidenceTypeSchema = z.enum(EvidenceType);
export const ticketAuditActionSchema = z.enum(TicketAuditAction);
