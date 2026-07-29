"use server";

import { revalidatePath } from "next/cache";
import {
  DiscussionMessageType,
  PenaltyProposalStatus,
  PenaltyType as PrismaPenaltyType,
  Prisma,
  ProposalVoteChoice as PrismaProposalVoteChoice,
  Role as PrismaRole,
  TicketAuditAction,
  TicketStatus,
} from "@/generated/prisma/client";
import {
  NotificationPriority,
  NotificationType,
  PenaltyProposalStatus as DomainProposalStatus,
  penaltyTypeLabels,
  ProposalVoteChoice,
  proposalVoteChoiceLabels,
} from "@/domain";
import {
  Permission,
  hasPermission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { createNotifications } from "@/lib/notifications/service";
import { createOfficialFiaDecision } from "./decision-service";
import {
  createPenaltyProposalSchema,
  penaltyProposalReviewSchema,
  penaltyProposalVoteSchema,
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
  if (penaltyType === PrismaPenaltyType.GRID_PENALTY) {
    return `${penaltyValue} Startplatz${penaltyValue === 1 ? "" : "plätze"}`;
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
      ticket: { select: { archivedAt: true } },
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
    DomainProposalStatus.AwaitingApproval,
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
      status: PenaltyProposalStatus.AWAITING_APPROVAL,
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

  const reviewers = await transaction.user.findMany({
    where: {
      active: true,
      roles: {
        hasSome: [
          PrismaRole.SUPER_ADMIN,
          PrismaRole.ADMIN,
          PrismaRole.FIA_PRESIDENT,
        ],
      },
    },
    select: { id: true },
  });
  await createNotifications(
    transaction,
    reviewers
      .map(({ id }) => id)
      .filter((userId) => userId !== actorId),
    {
      type: NotificationType.FiaTicket,
      priority: NotificationPriority.High,
      title: `Strafenvorschlag #${proposal.id} wartet auf Freigabe`,
      message: resultLabel,
      href: `/fia/${proposal.ticketId}`,
      relatedEntity: {
        type: "PenaltyProposal",
        id: proposal.id,
      },
      dedupeKey: `fia-proposal-review:${proposal.id}`,
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

        const presidents = await transaction.user.findMany({
          where: {
            active: true,
            roles: { has: PrismaRole.FIA_PRESIDENT },
          },
          select: { id: true },
        });
        const eligibleVoterIds = Array.from(
          new Set([
            ...proposal.ticket.stewardAssignments.map(
              ({ userId }) => userId,
            ),
            ...presidents.map(({ id }) => id),
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
              creatorId: true,
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
        const canDecide = hasPermission(
          user.roles,
          Permission.DecideFiaTicket,
        );
        if (proposal.creatorId !== user.id && !canDecide) {
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
        "Nur der Ersteller oder die FIA-Leitung darf die Abstimmung schließen.",
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

export async function reviewPenaltyProposalAction(
  proposalIdInput: number,
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.DecideFiaTicket);
  const proposalId = proposalIdSchema.safeParse(proposalIdInput);
  const parsed = penaltyProposalReviewSchema.safeParse({
    action: formData.get("reviewAction"),
    reason: formData.get("reviewReason"),
  });
  if (!proposalId.success || !parsed.success) {
    return failure(
      "Bitte vervollständige die Prüfung des Vorschlags.",
      parsed.success
        ? undefined
        : (parsed.error.flatten().fieldErrors as Record<
            string,
            string[]
          >),
    );
  }

  const prisma = getPrismaClient();
  let ticketId = 0;
  try {
    await prisma.$transaction(
      async (transaction) => {
        const proposal =
          await transaction.penaltyProposal.findUnique({
            where: { id: proposalId.data },
            include: {
              votes: { select: { voterId: true, choice: true } },
              ticket: {
                select: {
                  archivedAt: true,
                  status: true,
                  decision: { select: { id: true } },
                  stewardAssignments: {
                    select: { userId: true },
                  },
                },
              },
            },
          });
        if (
          !proposal ||
          proposal.status !==
            PenaltyProposalStatus.AWAITING_APPROVAL ||
          proposal.ticket.archivedAt !== null ||
          proposal.ticket.status !== TicketStatus.IN_REVIEW ||
          proposal.ticket.decision
        ) {
          throw new Error("INVALID_WORKFLOW");
        }
        const tally = tallyProposalVotes(
          proposal.votes.flatMap((vote) =>
            vote.choice
              ? [
                  {
                    choice:
                      vote.choice as ProposalVoteChoice,
                  },
                ]
              : [],
          ),
        );
        if (
          parsed.data.action === "APPROVE" &&
          proposalOutcome(
            DomainProposalStatus.AwaitingApproval,
            tally,
          ) !== "MAJORITY_FOR"
        ) {
          throw new Error("NO_MAJORITY");
        }

        const reviewedAt = new Date();
        const nextStatus =
          parsed.data.action === "APPROVE"
            ? PenaltyProposalStatus.APPROVED
            : parsed.data.action === "REJECT"
              ? PenaltyProposalStatus.REJECTED
              : PenaltyProposalStatus.CHANGES_REQUESTED;
        await transaction.penaltyProposal.update({
          where: { id: proposal.id },
          data: {
            status: nextStatus,
            reviewedAt,
            reviewedByUserId: user.id,
            reviewReason: parsed.data.reason,
          },
        });
        const reviewLabel =
          parsed.data.action === "APPROVE"
            ? "genehmigt"
            : parsed.data.action === "REJECT"
              ? "abgelehnt"
              : "zur Überarbeitung zurückgegeben";
        await transaction.discussionMessage.create({
          data: {
            ticketId: proposal.ticketId,
            authorId: user.id,
            type: DiscussionMessageType.SYSTEM,
            eventKey: `proposal:${proposal.id}:review`,
            message: `Der FIA-Präsident hat Strafenvorschlag #${proposal.id} ${reviewLabel}.${parsed.data.reason ? ` Begründung: ${parsed.data.reason}` : ""}`,
          },
        });
        await transaction.fiaTicketAuditLog.create({
          data: {
            ticketId: proposal.ticketId,
            actorId: user.id,
            action: TicketAuditAction.PROPOSAL_REVIEWED,
            details: `Strafenvorschlag #${proposal.id} ${reviewLabel}`,
          },
        });

        if (parsed.data.action === "APPROVE") {
          await createOfficialFiaDecision(transaction, {
            ticketId: proposal.ticketId,
            actorId: user.id,
            proposalId: proposal.id,
            affectedDriverId: proposal.affectedDriverId,
            penaltyType: proposal.penaltyType,
            penaltyValue: proposal.penaltyValue,
            reason: proposal.reason,
            stewardIds: proposal.votes.map(
              ({ voterId }) => voterId,
            ),
          });
        } else {
          const recipientIds = new Set([
            proposal.creatorId,
            ...proposal.ticket.stewardAssignments.map(
              ({ userId }) => userId,
            ),
          ]);
          recipientIds.delete(user.id);
          await createNotifications(
            transaction,
            [...recipientIds],
            {
              type: NotificationType.FiaTicket,
              priority: NotificationPriority.High,
              title: `Strafenvorschlag #${proposal.id} ${reviewLabel}`,
              message:
                parsed.data.reason ??
                "Der Vorschlag wurde geprüft.",
              href: `/fia/${proposal.ticketId}`,
              relatedEntity: {
                type: "PenaltyProposal",
                id: proposal.id,
              },
              dedupeKey: `fia-proposal-reviewed:${proposal.id}`,
            },
          );
        }
        ticketId = proposal.ticketId;
      },
      {
        isolationLevel:
          Prisma.TransactionIsolationLevel.Serializable,
      },
    );
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "NO_MAJORITY") {
      return failure(
        "Eine Genehmigung erfordert eine Mehrheit dafür. Der Vorschlag kann abgelehnt oder zur Überarbeitung zurückgegeben werden.",
      );
    }
    if (code === "INVALID_WORKFLOW") {
      return failure(
        "Dieser Vorschlag wartet nicht mehr auf eine Entscheidung.",
      );
    }
    return failure(
      "Die Prüfung des Vorschlags konnte nicht gespeichert werden.",
    );
  }

  revalidateProposal(ticketId);
  revalidatePath("/championship");
  return success(
    parsed.data.action === "APPROVE"
      ? "Vorschlag genehmigt und als offizielle FIA-Entscheidung veröffentlicht."
      : parsed.data.action === "REJECT"
        ? "Vorschlag wurde abgelehnt."
        : "Änderungen wurden angefordert.",
  );
}
