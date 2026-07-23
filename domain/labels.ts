import {
  EvidenceType,
  NotificationType,
  PenaltyType,
  RaceSession,
  RaceStatus,
  Role,
  TicketAuditAction,
  TicketPriority,
  TicketStatus,
} from "./enums";

export const evidenceTypeLabels: Record<EvidenceType, string> = {
  [EvidenceType.Link]: "Link",
  [EvidenceType.Image]: "Bild",
  [EvidenceType.Video]: "Video",
  [EvidenceType.Document]: "Dokument",
};

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

export const raceStatusLabels: Record<RaceStatus, string> = {
  [RaceStatus.Scheduled]: "Geplant",
  [RaceStatus.InProgress]: "Läuft",
  [RaceStatus.Completed]: "Abgeschlossen",
  [RaceStatus.Cancelled]: "Abgesagt",
};

export const notificationTypeLabels: Record<NotificationType, string> = {
  [NotificationType.System]: "System",
  [NotificationType.RaceReminder]: "Rennerinnerung",
  [NotificationType.Attendance]: "Rennanmeldung",
  [NotificationType.FiaTicket]: "FIA-Ticket",
  [NotificationType.FiaDecision]: "FIA-Entscheidung",
  [NotificationType.Championship]: "Meisterschaft",
};

export const ticketAuditActionLabels: Record<TicketAuditAction, string> = {
  [TicketAuditAction.Created]: "Ticket erstellt",
  [TicketAuditAction.StatusChanged]: "Status geändert",
  [TicketAuditAction.EvidenceAdded]: "Beweis hinzugefügt",
  [TicketAuditAction.DiscussionMessageAdded]: "Kommentar hinzugefügt",
  [TicketAuditAction.VoteRecorded]: "Steward-Bewertung gespeichert",
  [TicketAuditAction.DecisionPublished]: "Entscheidung veröffentlicht",
};
