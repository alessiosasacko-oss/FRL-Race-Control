import {
  NotificationType,
  PenaltyType,
  RaceSession,
  Role,
  TicketPriority,
  TicketStatus,
} from "./enums";

export const roleLabels: Record<Role, string> = {
  [Role.SuperAdmin]: "Super-Administrator",
  [Role.Admin]: "Administrator",
  [Role.FiaPresident]: "FIA-Präsident",
  [Role.Steward]: "Steward",
  [Role.TeamPrincipal]: "Teamchef",
  [Role.Driver]: "Fahrer",
};

export const ticketStatusLabels: Record<TicketStatus, string> = {
  [TicketStatus.Open]: "Offen",
  [TicketStatus.InReview]: "In Bearbeitung",
  [TicketStatus.Resolved]: "Erledigt",
};

export const ticketPriorityLabels: Record<TicketPriority, string> = {
  [TicketPriority.Low]: "Niedrig",
  [TicketPriority.Normal]: "Normal",
  [TicketPriority.High]: "Hoch",
};

export const penaltyTypeLabels: Record<PenaltyType, string> = {
  [PenaltyType.NoFurtherAction]: "Keine weitere Maßnahme",
  [PenaltyType.Warning]: "Verwarnung",
  [PenaltyType.Reprimand]: "Rüge",
  [PenaltyType.TimePenalty]: "Zeitstrafe",
  [PenaltyType.GridPenalty]: "Startplatzstrafe",
  [PenaltyType.DriveThrough]: "Durchfahrtsstrafe",
  [PenaltyType.StopAndGo]: "Stop-and-Go-Strafe",
  [PenaltyType.Disqualification]: "Disqualifikation",
  [PenaltyType.PointsDeduction]: "Punktabzug",
};

export const raceSessionLabels: Record<RaceSession, string> = {
  [RaceSession.Practice]: "Training",
  [RaceSession.Qualifying]: "Qualifying",
  [RaceSession.Sprint]: "Sprint",
  [RaceSession.Race]: "Rennen",
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  [NotificationType.System]: "System",
  [NotificationType.RaceReminder]: "Rennerinnerung",
  [NotificationType.Attendance]: "Rennanmeldung",
  [NotificationType.FiaTicket]: "FIA-Ticket",
  [NotificationType.FiaDecision]: "FIA-Entscheidung",
  [NotificationType.Championship]: "Meisterschaft",
};
