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

export enum TicketPriority {
  Low = "LOW",
  Normal = "NORMAL",
  High = "HIGH",
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
  DiscussionMessageAdded = "DISCUSSION_MESSAGE_ADDED",
  VoteRecorded = "VOTE_RECORDED",
  DecisionPublished = "DECISION_PUBLISHED",
}

export const roleSchema = z.enum(Role);
export const ticketStatusSchema = z.enum(TicketStatus);
export const ticketPrioritySchema = z.enum(TicketPriority);
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
export const evidenceTypeSchema = z.enum(EvidenceType);
export const ticketAuditActionSchema = z.enum(TicketAuditAction);
