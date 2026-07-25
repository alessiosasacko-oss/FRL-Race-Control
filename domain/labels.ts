import {
  AttendanceStatus,
  ChampionshipAdjustmentTarget,
  ChampionshipAuditAction,
  EvidenceType,
  NotificationType,
  PenaltyType,
  RaceSession,
  RaceStatus,
  ResultSession,
  ResultStatus,
  Role,
  TicketAuditAction,
  TicketPriority,
  TicketStatus,
} from "./enums";

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  [AttendanceStatus.Registered]: "Angemeldet",
  [AttendanceStatus.Declined]: "Abgemeldet",
  [AttendanceStatus.NoResponse]: "Keine Antwort",
};

export const resultSessionLabels: Record<ResultSession, string> = {
  [ResultSession.Race]: "Rennen",
  [ResultSession.Sprint]: "Sprint",
};

export const resultStatusLabels: Record<ResultStatus, string> = {
  [ResultStatus.Finished]: "Im Ziel",
  [ResultStatus.Dnf]: "DNF",
  [ResultStatus.Dns]: "DNS",
  [ResultStatus.Dsq]: "DSQ",
  [ResultStatus.Retired]: "Ausgeschieden",
};

export const championshipAdjustmentTargetLabels: Record<
  ChampionshipAdjustmentTarget,
  string
> = {
  [ChampionshipAdjustmentTarget.Driver]: "Fahrer",
  [ChampionshipAdjustmentTarget.Team]: "Team",
};

export const championshipAuditActionLabels: Record<
  ChampionshipAuditAction,
  string
> = {
  [ChampionshipAuditAction.AttendanceChanged]: "Rennanmeldung geändert",
  [ChampionshipAuditAction.ResultCreated]: "Ergebnis erstellt",
  [ChampionshipAuditAction.ResultUpdated]: "Ergebnis geändert",
  [ChampionshipAuditAction.ResultDeleted]: "Ergebnis gelöscht",
  [ChampionshipAuditAction.ScoringChanged]: "Punktesystem geändert",
  [ChampionshipAuditAction.AdjustmentCreated]: "Punkteanpassung erstellt",
  [ChampionshipAuditAction.ChampionshipRecalculated]:
    "Meisterschaft neu berechnet",
};

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
