import {
  AttendanceStatus,
  ChampionshipAdjustmentTarget,
  ChampionshipAuditAction,
  EvidenceType,
  NotificationPriority,
  NotificationType,
  PenaltyType,
  RaceSession,
  RaceStatus,
  ResultSession,
  ResultStatus,
  ResultGapMode,
  ResultPublicationStatus,
  PenaltyProposalStatus,
  ProposalVoteChoice,
  Role,
  TicketAuditAction,
  TicketStatus,
} from "./enums";

export const attendanceStatusLabels: Record<AttendanceStatus, string> = {
  [AttendanceStatus.Registered]: "Angemeldet",
  [AttendanceStatus.Declined]: "Abgemeldet",
  [AttendanceStatus.NoResponse]: "Keine Antwort",
};

export const resultSessionLabels: Record<ResultSession, string> = {
  [ResultSession.Qualifying]: "Qualifying",
  [ResultSession.Race]: "Rennen",
  [ResultSession.Sprint]: "Sprint",
};

export const resultGapModeLabels: Record<ResultGapMode, string> = {
  [ResultGapMode.ToLeader]: "Abstand zum Führenden",
  [ResultGapMode.ToPrevious]: "Abstand zum Vordermann",
};

export const resultPublicationStatusLabels: Record<
  ResultPublicationStatus,
  string
> = {
  [ResultPublicationStatus.Draft]: "Entwurf",
  [ResultPublicationStatus.Published]: "Veröffentlicht",
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

export const penaltyTypeLabels: Record<PenaltyType, string> = {
  [PenaltyType.NoFurtherAction]: "Keine weitere Maßnahme",
  [PenaltyType.Warning]: "Verwarnung",
  [PenaltyType.Reprimand]: "Rüge",
  [PenaltyType.TimePenalty]: "Zeitstrafe",
  [PenaltyType.PenaltyPoints]: "Strafpunkte",
  [PenaltyType.GridPenalty]: "Startplatzstrafe",
  [PenaltyType.QualifyingBan]: "Q-Sperre",
  [PenaltyType.RaceBan]: "Rennsperre",
  [PenaltyType.SeasonBan]: "Saisonsperre",
  [PenaltyType.DriveThrough]: "Durchfahrtsstrafe",
  [PenaltyType.StopAndGo]: "Stop-and-Go-Strafe",
  [PenaltyType.Disqualification]: "Disqualifikation",
  [PenaltyType.PointsDeduction]: "Punktabzug",
};

export const penaltyProposalStatusLabels: Record<
  PenaltyProposalStatus,
  string
> = {
  [PenaltyProposalStatus.Open]: "Abstimmung läuft",
  [PenaltyProposalStatus.AwaitingApproval]: "FIA-Freigabe ausstehend",
  [PenaltyProposalStatus.Approved]: "Genehmigt",
  [PenaltyProposalStatus.Rejected]: "Abgelehnt",
  [PenaltyProposalStatus.ChangesRequested]: "Änderungen angefordert",
};

export const proposalVoteChoiceLabels: Record<
  ProposalVoteChoice,
  string
> = {
  [ProposalVoteChoice.For]: "Dafür",
  [ProposalVoteChoice.Against]: "Dagegen",
  [ProposalVoteChoice.Abstain]: "Enthalten",
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
  [NotificationType.FiaTicket]: "FIA-Ticket erstellt",
  [NotificationType.FiaDecision]: "FIA-Entscheidung",
  [NotificationType.Championship]: "Meisterschaft",
  [NotificationType.Penalty]: "Strafe",
  [NotificationType.QualifyingBan]: "Qualifying-Sperre",
  [NotificationType.RaceBan]: "Rennsperre",
  [NotificationType.AttendanceOpen]: "Rennanmeldung geöffnet",
  [NotificationType.AttendanceClosingSoon]: "Anmeldeschluss naht",
  [NotificationType.AttendanceClosed]: "Rennanmeldung geschlossen",
  [NotificationType.RaceResult]: "Neues Rennergebnis",
  [NotificationType.ChampionshipUpdated]: "Meisterschaft aktualisiert",
  [NotificationType.NewSeason]: "Neue Saison",
  [NotificationType.NewRace]: "Neues Rennen",
  [NotificationType.AdminAnnouncement]: "Admin-Mitteilung",
};

export const notificationPriorityLabels: Record<
  NotificationPriority,
  string
> = {
  [NotificationPriority.Low]: "Niedrig",
  [NotificationPriority.Normal]: "Normal",
  [NotificationPriority.High]: "Hoch",
  [NotificationPriority.Urgent]: "Dringend",
};

export const ticketAuditActionLabels: Record<TicketAuditAction, string> = {
  [TicketAuditAction.Created]: "Ticket erstellt",
  [TicketAuditAction.StatusChanged]: "Status geändert",
  [TicketAuditAction.EvidenceAdded]: "Beweis hinzugefügt",
  [TicketAuditAction.EvidenceRemoved]: "Beweis entfernt",
  [TicketAuditAction.DiscussionMessageAdded]: "Kommentar hinzugefügt",
  [TicketAuditAction.VoteRecorded]: "Steward-Bewertung gespeichert",
  [TicketAuditAction.ProposalCreated]: "Strafenvorschlag erstellt",
  [TicketAuditAction.ProposalVoteRecorded]:
    "Vorschlagsstimme gespeichert",
  [TicketAuditAction.ProposalClosed]: "Abstimmung geschlossen",
  [TicketAuditAction.ProposalReviewed]:
    "Strafenvorschlag geprüft",
  [TicketAuditAction.DecisionPublished]: "Entscheidung veröffentlicht",
};
