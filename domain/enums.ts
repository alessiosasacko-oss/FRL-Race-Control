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

export enum NotificationType {
  System = "SYSTEM",
  RaceReminder = "RACE_REMINDER",
  Attendance = "ATTENDANCE",
  FiaTicket = "FIA_TICKET",
  FiaDecision = "FIA_DECISION",
  Championship = "CHAMPIONSHIP",
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
export const notificationTypeSchema = z.enum(NotificationType);
export const evidenceTypeSchema = z.enum(EvidenceType);
export const ticketAuditActionSchema = z.enum(TicketAuditAction);
