import "server-only";

import { TicketStatus } from "@/domain";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import type { AuthenticatedUser } from "@/lib/auth/session";

type EvidenceTicketAccess = {
  status: string;
  archivedAt: Date | string | null;
  reportedByUserId: number | null;
  drivers: Array<{ driver: { userId: number | null } }>;
};

export function canAccessFiaEvidence(
  user: AuthenticatedUser,
  ticket: EvidenceTicketAccess,
): boolean {
  return (
    hasPermission(user.roles, Permission.ReviewFiaTicket) ||
    ticket.reportedByUserId === user.id ||
    ticket.drivers.some(({ driver }) => driver.userId === user.id)
  );
}

export function canModifyFiaEvidence(
  user: AuthenticatedUser,
  ticket: EvidenceTicketAccess,
): boolean {
  return (
    ticket.archivedAt === null &&
    ticket.status !== TicketStatus.Resolved &&
    canAccessFiaEvidence(user, ticket)
  );
}
