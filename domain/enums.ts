import { z } from "zod";

export enum Role {
  Driver = "DRIVER",
  Steward = "STEWARD",
  LeagueManager = "LEAGUE_MANAGER",
  Admin = "ADMIN",
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

export const roleSchema = z.enum(Role);
export const ticketStatusSchema = z.enum(TicketStatus);
export const ticketPrioritySchema = z.enum(TicketPriority);
export const penaltyTypeSchema = z.enum(PenaltyType);
export const raceSessionSchema = z.enum(RaceSession);
export const notificationTypeSchema = z.enum(NotificationType);
export const evidenceTypeSchema = z.enum(EvidenceType);
