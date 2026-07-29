"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  Prisma,
  TicketAuditAction,
} from "@/generated/prisma/client";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  fiaArchiveBlockReason,
  type FiaArchiveBlockReason,
} from "@/lib/fia/archive-policy";
import { ticketIdSchema } from "@/lib/fia/schemas";
import type { FiaActionState } from "@/lib/fia/types";
import {
  PenaltyProposalStatus,
  TicketStatus,
} from "@/domain";

const archiveBlockMessages: Record<FiaArchiveBlockReason, string> = {
  ALREADY_ARCHIVED: "Dieses Ticket ist bereits archiviert.",
  TICKET_NOT_RESOLVED:
    "Nur vollständig abgeschlossene FIA-Tickets können archiviert werden.",
  FINAL_DECISION_MISSING:
    "Vor der Archivierung muss eine finale FIA-Entscheidung vorliegen.",
  PROPOSAL_STILL_ACTIVE:
    "Eine laufende Abstimmung verhindert die Archivierung.",
};

function failure(message: string): FiaActionState {
  return { status: "error", message };
}

function revalidateArchive(ticketId: number): void {
  revalidatePath("/fia");
  revalidatePath("/fia/archive");
  revalidatePath(`/fia/${ticketId}`);
}

export async function archiveFiaTicketAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
): Promise<FiaActionState> {
  void _previousState;
  const user = await requirePermission(Permission.ArchiveFiaTicket);
  const parsedId = ticketIdSchema.safeParse(ticketIdInput);
  if (!parsedId.success) return failure("Ungültige Ticketnummer.");

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(
      async (transaction) => {
        const ticket = await transaction.fiaTicket.findUnique({
          where: { id: parsedId.data },
          select: {
            status: true,
            archivedAt: true,
            decision: { select: { id: true } },
            penaltyProposals: { select: { status: true } },
          },
        });
        if (!ticket) throw new Error("NOT_FOUND");

        const blockReason = fiaArchiveBlockReason({
          status: ticket.status as TicketStatus,
          archivedAt: ticket.archivedAt,
          hasDecision: ticket.decision !== null,
          proposalStatuses: ticket.penaltyProposals.map(
            ({ status }) => status as PenaltyProposalStatus,
          ),
        });
        if (blockReason) throw new Error(blockReason);

        const archivedAt = new Date();
        const update = await transaction.fiaTicket.updateMany({
          where: { id: parsedId.data, archivedAt: null },
          data: { archivedAt, archivedById: user.id },
        });
        if (update.count !== 1) throw new Error("ALREADY_ARCHIVED");

        await transaction.fiaTicketAuditLog.create({
          data: {
            ticketId: parsedId.data,
            actorId: user.id,
            action: TicketAuditAction.ARCHIVED,
            details: `Archiviert von ${user.displayName} (${user.roles.join(", ")})`,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return failure("Das Ticket wurde nicht gefunden.");
    if (code in archiveBlockMessages) {
      return failure(
        archiveBlockMessages[code as FiaArchiveBlockReason],
      );
    }
    console.error("[fia-archive] Ticket archiving failed.", {
      ticketId: parsedId.data,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return failure(
      "Das Ticket konnte nicht archiviert werden. Bitte versuche es erneut.",
    );
  }

  revalidateArchive(parsedId.data);
  redirect("/fia/archive?changed=archived");
}

export async function restoreFiaTicketAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
): Promise<FiaActionState> {
  void _previousState;
  const user = await requirePermission(Permission.ArchiveFiaTicket);
  const parsedId = ticketIdSchema.safeParse(ticketIdInput);
  if (!parsedId.success) return failure("Ungültige Ticketnummer.");

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(
      async (transaction) => {
        const ticket = await transaction.fiaTicket.findUnique({
          where: { id: parsedId.data },
          select: { archivedAt: true },
        });
        if (!ticket) throw new Error("NOT_FOUND");
        if (!ticket.archivedAt) throw new Error("NOT_ARCHIVED");

        const update = await transaction.fiaTicket.updateMany({
          where: {
            id: parsedId.data,
            archivedAt: ticket.archivedAt,
          },
          data: { archivedAt: null, archivedById: null },
        });
        if (update.count !== 1) throw new Error("CONFLICT");

        await transaction.fiaTicketAuditLog.create({
          data: {
            ticketId: parsedId.data,
            actorId: user.id,
            action: TicketAuditAction.RESTORED,
            details: `Wiederhergestellt von ${user.displayName} (${user.roles.join(", ")})`,
          },
        });
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") return failure("Das Ticket wurde nicht gefunden.");
    if (code === "NOT_ARCHIVED") {
      return failure("Dieses Ticket befindet sich nicht im Archiv.");
    }
    console.error("[fia-archive] Ticket restore failed.", {
      ticketId: parsedId.data,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return failure(
      "Das Ticket konnte nicht wiederhergestellt werden. Bitte versuche es erneut.",
    );
  }

  revalidateArchive(parsedId.data);
  redirect(`/fia/${parsedId.data}?changed=restored`);
}
