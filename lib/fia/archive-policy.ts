import {
  PenaltyProposalStatus,
  Role,
  TicketStatus,
} from "@/domain";

export type FiaArchiveCandidate = {
  status: TicketStatus;
  archivedAt: Date | string | null;
  hasDecision: boolean;
  proposalStatuses: readonly PenaltyProposalStatus[];
};

export type FiaArchiveBlockReason =
  | "ALREADY_ARCHIVED"
  | "TICKET_NOT_RESOLVED"
  | "FINAL_DECISION_MISSING"
  | "PROPOSAL_STILL_ACTIVE";

const unfinishedProposalStatuses = new Set<PenaltyProposalStatus>([
  PenaltyProposalStatus.Open,
  PenaltyProposalStatus.AwaitingApproval,
  PenaltyProposalStatus.ChangesRequested,
]);

export function fiaArchiveBlockReason(
  ticket: FiaArchiveCandidate,
): FiaArchiveBlockReason | null {
  if (ticket.archivedAt !== null) return "ALREADY_ARCHIVED";
  if (ticket.status !== TicketStatus.Resolved) {
    return "TICKET_NOT_RESOLVED";
  }
  if (!ticket.hasDecision) return "FINAL_DECISION_MISSING";
  if (
    ticket.proposalStatuses.some((status) =>
      unfinishedProposalStatuses.has(status),
    )
  ) {
    return "PROPOSAL_STILL_ACTIVE";
  }
  return null;
}

export function canArchiveFiaTickets(roles: readonly Role[]): boolean {
  return roles.some(
    (role) =>
      role === Role.SuperAdmin ||
      role === Role.Admin ||
      role === Role.FiaPresident,
  );
}

export function isArchivedFiaTicket(
  archivedAt: Date | string | null,
): boolean {
  return archivedAt !== null;
}
