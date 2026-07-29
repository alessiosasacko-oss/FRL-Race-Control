"use server";

import { revalidatePath } from "next/cache";
import {
  DiscussionMessageType,
  PenaltyProposalStatus,
  PenaltyType as PrismaPenaltyType,
  Prisma,
  ProposalVoteChoice as PrismaProposalVoteChoice,
  TicketAuditAction,
  TicketStatus,
} from "@/generated/prisma/client";
import {
  DecisionOutcome,
  NotificationPriority,
  NotificationType,
  PenaltyProposalStatus as DomainProposalStatus,
  penaltyTypeLabels,
  ProposalVoteChoice,
  proposalVoteChoiceLabels,
} from "@/domain";
import {
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { createNotifications } from "@/lib/notifications/service";
import { createOfficialFiaDecision } from "./decision-service";
import {
  createPenaltyProposalSchema,
  penaltyProposalVoteSchema,
  finalizeFiaTicketSchema,
  proposalIdSchema,
  ticketIdSchema,
} from "./schemas";
import {
  canParticipateInProposal,
  proposalDeadlineReached,
  proposalOutcome,
  shouldAutoCloseProposal,
  tallyProposalVotes,
} from "./proposal-policy";
import type { FiaActionState } from "./types";

function failure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): FiaActionState {
  return { status: "error", message, fieldErrors };
}

function success(message: string): FiaActionState {
  return { status: "success", message };
}

function revalidateProposal(ticketId: number): void {
  revalidatePath(`/fia/${ticketId}`);
  revalidatePath("/fia");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

function penaltySummary(
  penaltyType: PrismaPenaltyType,
  penaltyValue: number | null,
): string {
  const label =
    penaltyTypeLabels[penaltyType as keyof typeof penaltyTypeLabels];
  if (penaltyValue === null) return label;
  if (penaltyType === PrismaPenaltyType.TIME_PENALTY) {
    return `+${penaltyValue} Sekunden`;
  }
  if (penaltyType === PrismaPenaltyType.PENALTY_POINTS) {
    return `${penaltyValue} Strafpunkt${penaltyValue === 1 ? "" : "e"}`;
  }
  if (penaltyType === PrismaPenaltyType.POINTS_DEDUCTION) {
    return `-${penaltyValue} Meisterschaftspunkte`;
  }
  return `${label} · ${penaltyValue}`;
}

async function closeProposal(
  transaction: Prisma.TransactionClient,
  proposalId: number,
  actorId: number,
): Promise<{
  ticketId: number;
  outcome: ReturnType<typeof proposalOutcome>;
}> {
  const proposal = await transaction.penaltyProposal.findUnique({
    where: { id: proposalId },
    select: {
      id: true,
      ticketId: true,
      status: true,
      ticket: {
        select: {
          archivedAt: true,
          stewardAssignments: { select: { userId: true } },
        },
      },
      votes: { select: { choice: true } },
    },
  });
  if (
    !proposal ||
    proposal.ticket.archivedAt !== null ||
    proposal.status !== PenaltyProposalStatus.OPEN
  ) {
    throw new Error("PROPOSAL_CLOSED");
  }

  const tally = tallyProposalVotes(
    proposal.votes.flatMap((vote) =>
      vote.choice
        ? [{ choice: vote.choice as ProposalVoteChoice }]
        : [],
    ),
  );
  const outcome = proposalOutcome(
    DomainProposalStatus.Closed,
    tally,
  );
  const resultLabel =
    outcome === "MAJORITY_FOR"
      ? "Mehrheit dafür"
      : outcome === "MAJORITY_AGAINST"
        ? "Mehrheit dagegen"
        : "Unentschieden";

  await transaction.penaltyProposal.update({
    where: { id: proposal.id },
    data: {
      status: PenaltyProposalStatus.CLOSED,
      closedAt: new Date(),
      closedByUserId: actorId,
    },
  });
  await transaction.discussionMessage.upsert({
    where: { eventKey: `proposal:${proposal.id}:closed` },
    update: {
      message: `Abstimmung geschlossen: ${resultLabel} (${tally.for} dafür, ${tally.against} dagegen, ${tally.abstain} enthalten).`,
    },
    create: {
      ticketId: proposal.ticketId,
      authorId: actorId,
      type: DiscussionMessageType.SYSTEM,
      eventKey: `proposal:${proposal.id}:closed`,
      message: `Abstimmung geschlossen: ${resultLabel} (${tally.for} dafür, ${tally.against} dagegen, ${tally.abstain} enthalten).`,
    },
  });
  await transaction.fiaTicketAuditLog.create({
    data: {
      ticketId: proposal.ticketId,
      actorId,
      action: TicketAuditAction.PROPOSAL_CLOSED,
      details: `Strafenvorschlag #${proposal.id} geschlossen: ${resultLabel}`,
    },
  });

  await createNotifications(
    transaction,
    proposal.ticket.stewardAssignments
      .map(({ userId }) => userId)
      .filter((userId) => userId !== actorId),
    {
      type: NotificationType.FiaTicket,
      priority: NotificationPriority.Normal,
      title: `Abstimmung #${proposal.id} geschlossen`,
      message: resultLabel,
      href: `/fia/${proposal.ticketId}`,
      relatedEntity: {
        type: "PenaltyProposal",
        id: proposal.id,
      },
      dedupeKey: `fia-proposal-closed:${proposal.id}`,
    },
  );

  return { ticketId: proposal.ticketId, outcome };
}

export async function createPenaltyProposalAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.ReviewFiaTicket);
  const ticketIdResult = ticketIdSchema.safeParse(ticketIdInput);
  const parsed = createPenaltyProposalSchema.safeParse({
    affectedDriverId: formData.get("affectedDriverId"),
    penaltyType: formData.get("penaltyType"),
    penaltyValue: formData.get("penaltyValue"),
    reason: formData.get("reason"),
    durationMinutes: formData.get("durationMinutes"),
    closeWhenAllVoted:
      formData.get("closeWhenAllVoted") === "on",
    evidenceIds: formData.getAll("evidenceId"),
    supersedesId: formData.get("supersedesId"),
  });
  if (!ticketIdResult.success || !parsed.success) {
    return failure(
      "Bitte vervollständige den Strafenvorschlag.",
      parsed.success
        ? undefined
        : (parsed.error.flatten().fieldErrors as Record<
            string,
            string[]
          >),
    );
  }

  const ticketId = ticketIdResult.data;
  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(
      async (transaction) => {
        const ticket = await transaction.fiaTicket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            archivedAt: true,
            decision: { select: { id: true } },
            drivers: { select: { driverId: true } },
            evidence: { select: { id: true } },
            stewardAssignments: { select: { userId: true } },
          },
        });
        if (
          !ticket ||
          ticket.archivedAt !== null ||
          ticket.status !== TicketStatus.IN_REVIEW ||
          ticket.decision
        ) {
          throw new Error("INVALID_WORKFLOW");
        }
        if (
          !canParticipateInProposal({
            roles: user.roles,
            userId: user.id,
            assignedStewardIds: ticket.stewardAssignments.map(
              ({ userId }) => userId,
            ),
          })
        ) {
          throw new Error("FORBIDDEN");
        }
        if (
          !ticket.drivers.some(
            ({ driverId }) =>
              driverId === parsed.data.affectedDriverId,
          )
        ) {
          throw new Error("INVALID_DRIVER");
        }
        const ticketEvidenceIds = new Set(
          ticket.evidence.map(({ id }) => id),
        );
        if (
          parsed.data.evidenceIds.some(
            (evidenceId) => !ticketEvidenceIds.has(evidenceId),
          )
        ) {
          throw new Error("INVALID_EVIDENCE");
        }

        let revision = 1;
        if (parsed.data.supersedesId) {
          const previous =
            await transaction.penaltyProposal.findFirst({
              where: {
                id: parsed.data.supersedesId,
                ticketId,
                status: {
                  in: [
                    PenaltyProposalStatus.REJECTED,
                    PenaltyProposalStatus.CHANGES_REQUESTED,
                  ],
                },
              },
              select: { revision: true },
            });
          if (!previous) throw new Error("INVALID_REVISION");
          revision = previous.revision + 1;
        }

        const summary = penaltySummary(
          parsed.data.penaltyType as PrismaPenaltyType,
          parsed.data.penaltyValue ?? null,
        );
        const message = await transaction.discussionMessage.create({
          data: {
            ticketId,
            authorId: user.id,
            type: DiscussionMessageType.PENALTY_PROPOSAL,
            message: `Strafenvorschlag: ${summary}`,
          },
          select: { id: true },
        });
        const proposal =
          await transaction.penaltyProposal.create({
            data: {
              ticketId,
              messageId: message.id,
              creatorId: user.id,
              affectedDriverId:
                parsed.data.affectedDriverId,
              supersedesId: parsed.data.supersedesId,
              penaltyType:
                parsed.data.penaltyType as PrismaPenaltyType,
              penaltyValue: parsed.data.penaltyValue ?? null,
              reason: parsed.data.reason,
              closesAt: parsed.data.durationMinutes
                ? new Date(
                    Date.now() +
                      parsed.data.durationMinutes * 60_000,
                  )
                : null,
              closeWhenAllVoted:
                parsed.data.closeWhenAllVoted,
              revision,
              evidence: {
                create: parsed.data.evidenceIds.map(
                  (evidenceId) => ({ evidenceId }),
                ),
              },
            },
            select: { id: true },
          });
        await transaction.discussionMessage.create({
          data: {
            ticketId,
            authorId: user.id,
            type: DiscussionMessageType.SYSTEM,
            eventKey: `proposal:${proposal.id}:created`,
            message: `Strafenvorschlag #${proposal.id} wurde erstellt und die Abstimmung gestartet.`,
          },
        });
        await transaction.fiaTicketAuditLog.create({
          data: {
            ticketId,
            actorId: user.id,
            action: TicketAuditAction.PROPOSAL_CREATED,
            details: `Strafenvorschlag #${proposal.id}: ${summary}`,
          },
        });
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "FORBIDDEN") {
      return failure(
        "Nur zugewiesene Stewards und die FIA-Leitung dürfen Vorschläge erstellen.",
      );
    }
    if (code === "INVALID_DRIVER") {
      return failure(
        "Der betroffene Fahrer gehört nicht zu diesem Ticket.",
      );
    }
    if (code === "INVALID_EVIDENCE") {
      return failure(
        "Mindestens ein verknüpfter Beweis gehört nicht zu diesem Ticket.",
      );
    }
    if (code === "INVALID_REVISION") {
      return failure(
        "Eine Revision ist nur für abgelehnte oder zurückgegebene Vorschläge möglich.",
      );
    }
    if (code === "INVALID_WORKFLOW") {
      return failure(
        "Vorschläge können nur während einer offenen Untersuchung erstellt werden.",
      );
    }
    return failure(
      "Der Strafenvorschlag konnte nicht gespeichert werden.",
    );
  }

  revalidateProposal(ticketId);
  return success("Strafenvorschlag wurde erstellt.");
}

export async function castPenaltyProposalVoteAction(
  proposalIdInput: number,
  choiceInput: ProposalVoteChoice,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.ReviewFiaTicket);
  const proposalIdResult = proposalIdSchema.safeParse(
    proposalIdInput,
  );
  const voteResult = penaltyProposalVoteSchema.safeParse({
    choice: choiceInput,
  });
  if (!proposalIdResult.success || !voteResult.success) {
    return failure("Die Stimme ist ungültig.");
  }

  const prisma = getPrismaClient();
  let ticketId = 0;
  let deadlineClosed = false;
  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const proposal =
          await transaction.penaltyProposal.findUnique({
            where: { id: proposalIdResult.data },
            select: {
              id: true,
              ticketId: true,
              status: true,
              closesAt: true,
              closeWhenAllVoted: true,
              ticket: {
                select: {
                  status: true,
                  archivedAt: true,
                  stewardAssignments: {
                    select: { userId: true },
                  },
                },
              },
              votes: { select: { voterId: true } },
            },
          });
        if (!proposal) throw new Error("NOT_FOUND");
        if (
          !canParticipateInProposal({
            roles: user.roles,
            userId: user.id,
            assignedStewardIds:
              proposal.ticket.stewardAssignments.map(
                ({ userId }) => userId,
              ),
          })
        ) {
          throw new Error("FORBIDDEN");
        }
        if (
          proposal.status !== PenaltyProposalStatus.OPEN ||
          proposal.ticket.archivedAt !== null ||
          proposal.ticket.status !== TicketStatus.IN_REVIEW
        ) {
          throw new Error("PROPOSAL_CLOSED");
        }
        if (proposalDeadlineReached(proposal.closesAt)) {
          const closed = await closeProposal(
            transaction,
            proposal.id,
            user.id,
          );
          return {
            ticketId: closed.ticketId,
            deadlineClosed: true,
          };
        }

        const existing = await transaction.vote.findUnique({
          where: {
            proposalId_voterId: {
              proposalId: proposal.id,
              voterId: user.id,
            },
          },
          select: { id: true, choice: true },
        });
        const vote = await transaction.vote.upsert({
          where: {
            proposalId_voterId: {
              proposalId: proposal.id,
              voterId: user.id,
            },
          },
          update: {
            choice:
              voteResult.data
                .choice as PrismaProposalVoteChoice,
          },
          create: {
            proposalId: proposal.id,
            ticketId: proposal.ticketId,
            voterId: user.id,
            choice:
              voteResult.data
                .choice as PrismaProposalVoteChoice,
          },
          select: { id: true },
        });
        await transaction.voteChange.create({
          data: {
            voteId: vote.id,
            changedByUserId: user.id,
            fromChoice: existing?.choice,
            toChoice:
              voteResult.data
                .choice as PrismaProposalVoteChoice,
          },
        });

        const votes = await transaction.vote.findMany({
          where: { proposalId: proposal.id },
          select: { voterId: true, choice: true },
        });
        const tally = tallyProposalVotes(
          votes.flatMap((item) =>
            item.choice
              ? [
                  {
                    choice:
                      item.choice as ProposalVoteChoice,
                  },
                ]
              : [],
          ),
        );
        await transaction.discussionMessage.upsert({
          where: {
            eventKey: `proposal:${proposal.id}:vote-summary`,
          },
          update: {
            message: `Abstimmungsstand aktualisiert: ${tally.for} dafür, ${tally.against} dagegen, ${tally.abstain} enthalten.`,
          },
          create: {
            ticketId: proposal.ticketId,
            authorId: user.id,
            type: DiscussionMessageType.SYSTEM,
            eventKey: `proposal:${proposal.id}:vote-summary`,
            message: `Abstimmungsstand aktualisiert: ${tally.for} dafür, ${tally.against} dagegen, ${tally.abstain} enthalten.`,
          },
        });
        await transaction.fiaTicketAuditLog.create({
          data: {
            ticketId: proposal.ticketId,
            actorId: user.id,
            action:
              TicketAuditAction.PROPOSAL_VOTE_RECORDED,
            details: `Strafenvorschlag #${proposal.id}: ${proposalVoteChoiceLabels[voteResult.data.choice]}${existing?.choice ? " (Stimme geändert)" : ""}`,
          },
        });

        const eligibleVoterIds = Array.from(
          new Set([
            ...proposal.ticket.stewardAssignments.map(
              ({ userId }) => userId,
            ),
          ]),
        );
        if (
          shouldAutoCloseProposal({
            closeWhenAllVoted: proposal.closeWhenAllVoted,
            eligibleVoterIds,
            voterIds: votes.map(({ voterId }) => voterId),
          })
        ) {
          await closeProposal(
            transaction,
            proposal.id,
            user.id,
          );
        }

        return {
          ticketId: proposal.ticketId,
          deadlineClosed: false,
        };
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    ticketId = result.ticketId;
    deadlineClosed = result.deadlineClosed;
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "FORBIDDEN") {
      return failure(
        "Du bist für diese Abstimmung nicht stimmberechtigt.",
      );
    }
    if (code === "PROPOSAL_CLOSED") {
      return failure("Diese Abstimmung ist bereits geschlossen.");
    }
    return failure("Die Stimme konnte nicht gespeichert werden.");
  }

  revalidateProposal(ticketId);
  return deadlineClosed
    ? success(
        "Die Frist war abgelaufen; die Abstimmung wurde geschlossen.",
      )
    : success("Deine Stimme wurde gespeichert.");
}

export async function closePenaltyProposalAction(
  proposalIdInput: number,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.ReviewFiaTicket);
  const proposalId = proposalIdSchema.safeParse(proposalIdInput);
  if (!proposalId.success) return failure("Ungültiger Vorschlag.");
  const prisma = getPrismaClient();
  let ticketId = 0;

  try {
    const result = await prisma.$transaction(
      async (transaction) => {
        const proposal =
          await transaction.penaltyProposal.findUnique({
            where: { id: proposalId.data },
            select: {
              ticket: {
                select: {
                  stewardAssignments: {
                    select: { userId: true },
                  },
                },
              },
            },
          });
        if (!proposal) throw new Error("NOT_FOUND");
        if (
          !canParticipateInProposal({
            roles: user.roles,
            userId: user.id,
            assignedStewardIds: proposal.ticket.stewardAssignments.map(
              ({ userId }) => userId,
            ),
          })
        ) {
          throw new Error("FORBIDDEN");
        }
        return closeProposal(
          transaction,
          proposalId.data,
          user.id,
        );
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
    ticketId = result.ticketId;
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "FORBIDDEN") {
      return failure(
        "Nur zugewiesene Stewards und die FIA-Leitung dürfen die Abstimmung schließen.",
      );
    }
    if (code === "PROPOSAL_CLOSED") {
      return failure("Diese Abstimmung ist bereits geschlossen.");
    }
    return failure(
      "Die Abstimmung konnte nicht geschlossen werden.",
    );
  }

  revalidateProposal(ticketId);
  return success("Abstimmung wurde geschlossen.");
}

export async function finalizeFiaTicketAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.ReviewFiaTicket);
  const ticketId = ticketIdSchema.safeParse(ticketIdInput);
  const parsed = finalizeFiaTicketSchema.safeParse({
    outcome: formData.get("outcome"),
    affectedDriverId: formData.get("affectedDriverId"),
    reason: formData.get("reason"),
    internalNote: formData.get("internalNote"),
    proposalId: formData.get("proposalId"),
    confirmOpenVotes: formData.get("confirmOpenVotes") === "on",
    penalties: formData.getAll("penaltyType").map((penaltyType) => {
      const rawValue = formData.get(`penaltyValue_${String(penaltyType)}`);
      return {
        penaltyType,
        penaltyValue:
          rawValue === null || rawValue === "" ? null : Number(rawValue),
      };
    }),
  });
  if (!ticketId.success || !parsed.success) {
    return failure(
      "Bitte vervollständige die finale FIA-Entscheidung.",
      parsed.success
        ? undefined
        : (parsed.error.flatten().fieldErrors as Record<
            string,
            string[]
          >),
    );
  }

  const prisma = getPrismaClient();
  let alreadyFinalized = false;
  try {
    await prisma.$transaction(
      async (transaction) => {
        const ticket = await transaction.fiaTicket.findUnique({
          where: { id: ticketId.data },
          select: {
            archivedAt: true,
            status: true,
            decision: { select: { id: true } },
            drivers: { select: { driverId: true } },
            stewardAssignments: { select: { userId: true } },
            penaltyProposals: {
              select: {
                id: true,
                status: true,
                votes: { select: { voterId: true } },
              },
            },
          },
        });
        if (!ticket) throw new Error("NOT_FOUND");
        if (ticket.decision) {
          alreadyFinalized = true;
          return;
        }
        if (
          ticket.archivedAt !== null ||
          ticket.status !== TicketStatus.IN_REVIEW
        ) {
          throw new Error("INVALID_WORKFLOW");
        }
        if (
          !canParticipateInProposal({
            roles: user.roles,
            userId: user.id,
            assignedStewardIds: ticket.stewardAssignments.map(
              ({ userId }) => userId,
            ),
          })
        ) {
          throw new Error("FORBIDDEN");
        }
        if (
          parsed.data.affectedDriverId &&
          !ticket.drivers.some(
            ({ driverId }) => driverId === parsed.data.affectedDriverId,
          )
        ) {
          throw new Error("INVALID_DRIVER");
        }

        const selectedProposal = parsed.data.proposalId
          ? ticket.penaltyProposals.find(
              ({ id }) => id === parsed.data.proposalId,
            )
          : undefined;
        if (
          parsed.data.proposalId &&
          (!selectedProposal ||
            selectedProposal.status === PenaltyProposalStatus.OPEN)
        ) {
          throw new Error("INVALID_PROPOSAL");
        }
        const openProposals = ticket.penaltyProposals.filter(
          ({ status }) => status === PenaltyProposalStatus.OPEN,
        );
        if (openProposals.length > 0 && !parsed.data.confirmOpenVotes) {
          throw new Error("OPEN_VOTES");
        }
        if (openProposals.length > 0) {
          const now = new Date();
          await transaction.penaltyProposal.updateMany({
            where: {
              ticketId: ticketId.data,
              status: PenaltyProposalStatus.OPEN,
            },
            data: {
              status: PenaltyProposalStatus.CANCELLED,
              closedAt: now,
              closedByUserId: user.id,
            },
          });
          await transaction.discussionMessage.create({
            data: {
              ticketId: ticketId.data,
              authorId: user.id,
              type: DiscussionMessageType.SYSTEM,
              eventKey: `ticket:${ticketId.data}:open-votes-cancelled`,
              message: `${openProposals.length} noch offene Abstimmung(en) wurden beim expliziten Ticketabschluss beendet.`,
            },
          });
          await transaction.fiaTicketAuditLog.create({
            data: {
              ticketId: ticketId.data,
              actorId: user.id,
              action: TicketAuditAction.PROPOSAL_CLOSED,
              details: `Ticket trotz ${openProposals.length} offener Abstimmung(en) explizit abgeschlossen.`,
            },
          });
        }

        const stewardIds = Array.from(
          new Set([
            user.id,
            ...ticket.penaltyProposals.flatMap((proposal) =>
              proposal.votes.map(({ voterId }) => voterId),
            ),
          ]),
        );
        const penalties = parsed.data.penalties.map((penalty) => ({
          penaltyType: penalty.penaltyType as PrismaPenaltyType,
          penaltyValue: penalty.penaltyValue,
        }));
        await createOfficialFiaDecision(transaction, {
          ticketId: ticketId.data,
          actorId: user.id,
          proposalId: parsed.data.proposalId,
          affectedDriverId: parsed.data.affectedDriverId,
          outcome: parsed.data.outcome as DecisionOutcome,
          penalties,
          reason: parsed.data.reason,
          internalNote: parsed.data.internalNote,
          stewardIds,
        });
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "FORBIDDEN") {
      return failure(
        "Nur zugewiesene Stewards und die FIA-Leitung dürfen ein Ticket abschließen.",
      );
    }
    if (code === "OPEN_VOTES") {
      return failure(
        "Es läuft noch mindestens eine Abstimmung. Bestätige den bewussten Abschluss ausdrücklich.",
      );
    }
    if (code === "INVALID_DRIVER") {
      return failure("Der betroffene Fahrer gehört nicht zu diesem Ticket.");
    }
    if (code === "INVALID_PROPOSAL") {
      return failure(
        "Der verknüpfte Vorschlag gehört nicht zum Ticket oder ist noch offen.",
      );
    }
    if (code === "NOT_FOUND" || code === "INVALID_WORKFLOW") {
      return failure(
        "Dieses Ticket kann nicht abgeschlossen werden.",
      );
    }
    console.error("[fia-finalize] Ticket finalization failed.", {
      ticketId: ticketId.data,
      error: code || "Unknown",
    });
    return failure("Die FIA-Entscheidung konnte nicht gespeichert werden.");
  }

  revalidateProposal(ticketId.data);
  revalidatePath("/championship");
  return success(
    alreadyFinalized
      ? "Das Ticket war bereits abgeschlossen."
      : "Ticket abgeschlossen und FIA-Entscheidung veröffentlicht.",
  );
}
