import "server-only";

import {
  DiscussionMessageType,
  PenaltyType,
  type Prisma,
  TicketAuditAction,
  TicketStatus,
} from "@/generated/prisma/client";
import {
  NotificationPriority,
  NotificationType,
  penaltyTypeLabels,
  TicketStatus as DomainTicketStatus,
  ticketStatusLabels,
  WebhookEventType,
} from "@/domain";
import { recalculateChampionship } from "@/lib/championship/recalculation";
import { recordWebhookEvent } from "@/lib/integrations/events";
import { createNotifications } from "@/lib/notifications/service";
import { publicRaceTrack } from "@/lib/races/visibility";

export type OfficialFiaDecisionInput = {
  ticketId: number;
  actorId: number;
  affectedDriverId?: number;
  penaltyType: PenaltyType;
  penaltyValue: number | null;
  reason: string;
  stewardIds: readonly number[];
  proposalId?: number;
  requireLegacyVote?: boolean;
};

export async function createOfficialFiaDecision(
  transaction: Prisma.TransactionClient,
  input: OfficialFiaDecisionInput,
): Promise<number> {
  const ticket = await transaction.fiaTicket.findUnique({
    where: { id: input.ticketId },
    select: {
      title: true,
      seasonId: true,
      leagueId: true,
      league: { select: { name: true } },
      status: true,
      reportedByUserId: true,
      season: { select: { name: true } },
      race: {
        select: {
          name: true,
          circuit: true,
          countryCode: true,
          mystery: true,
          scheduledAt: true,
        },
      },
      drivers: {
        select: {
          driverId: true,
          driver: { select: { userId: true } },
        },
      },
      stewardAssignments: { select: { userId: true } },
      votes: {
        where: { proposalId: null },
        select: { voterId: true },
      },
      decision: { select: { id: true } },
    },
  });

  if (
    !ticket ||
    ticket.status !== TicketStatus.IN_REVIEW ||
    ticket.decision ||
    (input.requireLegacyVote && ticket.votes.length === 0)
  ) {
    throw new Error("INVALID_WORKFLOW");
  }
  if (
    input.affectedDriverId &&
    !ticket.drivers.some(
      ({ driverId }) => driverId === input.affectedDriverId,
    )
  ) {
    throw new Error("INVALID_AFFECTED_DRIVER");
  }

  const stewardIds = Array.from(
    new Set([
      ...input.stewardIds,
      ...ticket.votes.map((vote) => vote.voterId),
      input.actorId,
    ]),
  );
  const decision = await transaction.decision.create({
    data: {
      ticketId: input.ticketId,
      proposalId: input.proposalId,
      affectedDriverId: input.affectedDriverId,
      penaltyType: input.penaltyType,
      penaltyValue: input.penaltyValue,
      reason: input.reason,
      decidedAt: new Date(),
      stewards: {
        create: stewardIds.map((userId) => ({ userId })),
      },
    },
    select: { id: true },
  });

  await transaction.fiaTicket.update({
    where: { id: input.ticketId },
    data: { status: TicketStatus.RESOLVED },
  });

  await transaction.fiaTicketAuditLog.createMany({
    data: [
      {
        ticketId: input.ticketId,
        actorId: input.actorId,
        action: TicketAuditAction.DECISION_PUBLISHED,
        details: `Entscheidung: ${penaltyTypeLabels[input.penaltyType]}`,
      },
      {
        ticketId: input.ticketId,
        actorId: input.actorId,
        action: TicketAuditAction.STATUS_CHANGED,
        fromStatus: TicketStatus.IN_REVIEW,
        toStatus: TicketStatus.RESOLVED,
        details: `${ticketStatusLabels[DomainTicketStatus.InReview]} → ${ticketStatusLabels[DomainTicketStatus.Resolved]}`,
      },
    ],
  });

  if (input.proposalId) {
    await transaction.discussionMessage.create({
      data: {
        ticketId: input.ticketId,
        authorId: input.actorId,
        type: DiscussionMessageType.SYSTEM,
        eventKey: `proposal:${input.proposalId}:official-decision`,
        message: `Offizielle FIA-Entscheidung veröffentlicht: ${penaltyTypeLabels[input.penaltyType]}.`,
      },
    });
  }

  const recipientIds = new Set<number>();
  if (ticket.reportedByUserId) {
    recipientIds.add(ticket.reportedByUserId);
  }
  ticket.drivers.forEach(({ driver }) => {
    if (driver.userId) recipientIds.add(driver.userId);
  });
  ticket.stewardAssignments.forEach(({ userId }) =>
    recipientIds.add(userId),
  );
  recipientIds.delete(input.actorId);
  const track = publicRaceTrack(ticket.race);

  await createNotifications(
    transaction,
    [...recipientIds],
    {
      type: NotificationType.FiaDecision,
      priority: NotificationPriority.High,
      title: `Entscheidung zu Ticket #${input.ticketId}`,
      message: `${ticket.title}: ${penaltyTypeLabels[input.penaltyType]}`,
      href: `/fia/${input.ticketId}`,
      relatedEntity: { type: "FiaTicket", id: input.ticketId },
      dedupeKey: `fia-decision:${input.ticketId}`,
    },
    {
      leagueId: ticket.leagueId,
      discordContext: {
        league: ticket.league.name,
        season: ticket.season.name,
        race: track.name,
        track: track.circuit ?? "Mystery Track",
      },
    },
  );
  await recordWebhookEvent(transaction, {
    type: WebhookEventType.FiaDecision,
    source: input.proposalId
      ? "fia-proposal-approval"
      : "fia-decision-action",
    dedupeKey: `fia-decision-webhook:${input.ticketId}`,
    payload: {
      ticketId: input.ticketId,
      decisionId: decision.id,
      proposalId: input.proposalId ?? null,
      penaltyType: input.penaltyType,
      penaltyValue: input.penaltyValue,
      actorId: input.actorId,
    },
  });

  if (input.penaltyType !== PenaltyType.NO_FURTHER_ACTION) {
    const affectedUsers = ticket.drivers.flatMap(
      ({ driverId, driver }) =>
        (!input.affectedDriverId ||
          driverId === input.affectedDriverId) &&
        driver.userId &&
        driver.userId !== input.actorId
        ? [driver.userId]
        : []
    );
    await createNotifications(
      transaction,
      affectedUsers,
      {
        type: NotificationType.Penalty,
        priority: NotificationPriority.Urgent,
        title: `Strafe aus Ticket #${input.ticketId}`,
        message: `${ticket.title}: ${penaltyTypeLabels[input.penaltyType]}`,
        href: `/fia/${input.ticketId}`,
        relatedEntity: { type: "Decision", id: decision.id },
        dedupeKey: `fia-penalty:${decision.id}`,
      },
      {
        leagueId: ticket.leagueId,
        discordContext: {
          league: ticket.league.name,
          season: ticket.season.name,
          race: track.name,
          track: track.circuit ?? "Mystery Track",
        },
      },
    );
  }

  if (input.penaltyType === PenaltyType.POINTS_DEDUCTION) {
    await recalculateChampionship(
      transaction,
      ticket.leagueId,
      ticket.seasonId,
      input.actorId,
    );
  }

  return decision.id;
}
