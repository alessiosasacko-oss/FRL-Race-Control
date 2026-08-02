"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  PenaltyType as PrismaPenaltyType,
  Prisma,
  RaceSession as PrismaRaceSession,
  Role as PrismaRole,
  TicketAuditAction as PrismaTicketAuditAction,
  TicketStatus as PrismaTicketStatus,
  EvidenceType as PrismaEvidenceType,
  EvidenceUploadStatus,
} from "@/generated/prisma/client";
import {
  NotificationPriority,
  NotificationType,
  penaltyTypeLabels,
  ticketStatusLabels,
  TicketStatus,
  WebhookEventType,
} from "@/domain";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import {
  requirePermission,
} from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { recordWebhookEvent } from "@/lib/integrations/events";
import { recalculateChampionship } from "@/lib/championship/recalculation";
import { synchronizeGlobalTeamPrincipalChampionship } from "@/lib/championship/team-principal-championship";
import { createNotifications } from "@/lib/notifications/service";
import { publicRaceTrack } from "@/lib/races/visibility";
import {
  addEvidenceSchema,
  createFiaTicketSchema,
  decisionSchema,
  discussionMessageSchema,
  ticketIdSchema,
  voteSchema,
} from "@/lib/fia/schemas";
import type { FiaActionState } from "@/lib/fia/types";
import { canParticipateInProposal } from "@/lib/fia/proposal-policy";
import { mentionsAreValid } from "@/lib/fia/chat-policy";
import { getVideoUploadLimits } from "@/lib/storage/evidence-config";
import type {
  TicketEvidenceInput,
  UploadedVideoMetadata,
} from "@/lib/storage/evidence-types";

function validationFailure(
  message: string,
  fieldErrors?: Record<string, string[]>,
): FiaActionState {
  return {
    status: "error",
    message,
    fieldErrors,
  };
}

function mutationFailure(resetUploads = false): FiaActionState {
  return {
    ...validationFailure(
      resetUploads
        ? "Das Ticket wurde nicht vollständig erstellt. Bitte lade den Videobeweis erneut hoch."
        : "Die Änderung konnte nicht gespeichert werden. Bitte versuche es erneut.",
    ),
    resetUploads,
  };
}

function parseEvidence(formData: FormData): unknown {
  const value = formData.get("evidence");
  if (typeof value !== "string" || value === "") return [];

  try {
    return JSON.parse(value) as unknown;
  } catch {
    return null;
  }
}

async function revalidateTicket(ticketId: number): Promise<void> {
  revalidatePath("/fia");
  revalidatePath(`/fia/${ticketId}`);
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  await touchAppDataRevisionSafely(getPrismaClient(), ["fia", "notifications", "results", "championship"]);
}

export async function createFiaTicketAction(
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.SubmitFiaTicket);
  const parsed = createFiaTicketSchema.safeParse({
    submissionKey: formData.get("submissionKey"),
    leagueId: formData.get("leagueId"),
    raceId: formData.get("raceId"),
    title: formData.get("title"),
    description: formData.get("description"),
    session: formData.get("session"),
    lap: formData.get("lap"),
    driverIds: formData.getAll("driverId"),
    evidence: parseEvidence(formData),
  });

  if (!parsed.success) {
    return validationFailure(
      "Bitte prüfe die Angaben im Ticket.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

  const uploadedEvidence = parsed.data.evidence.filter(
    (evidence): evidence is Extract<TicketEvidenceInput, { kind: "upload" }> =>
      evidence.kind === "upload",
  );
  const uploadLimits = getVideoUploadLimits();
  const prisma = getPrismaClient();
  const existingTicket = await prisma.fiaTicket.findFirst({
    where: {
      submissionKey: parsed.data.submissionKey,
      reportedByUserId: user.id,
    },
    select: { id: true },
  });
  if (existingTicket) {
    redirect(`/fia/${existingTicket.id}`);
  }

  if (uploadedEvidence.length > uploadLimits.maxFiles) {
    return validationFailure(
      `Pro Ticket sind höchstens ${uploadLimits.maxFiles} Video-Dateien erlaubt.`,
    );
  }

  const completedUploads = await prisma.evidenceUpload.findMany({
    where: {
      id: {
        in: uploadedEvidence.map(
          (evidence) => evidence.temporaryUploadId,
        ),
      },
      userId: user.id,
      submissionKey: parsed.data.submissionKey,
      status: EvidenceUploadStatus.COMPLETED,
      evidenceId: null,
    },
    select: {
      id: true,
      storagePath: true,
      originalFilename: true,
      mimeType: true,
      fileSize: true,
      label: true,
      uploadedAt: true,
    },
  });
  const completedById = new Map(
    completedUploads.map((upload) => [upload.id, upload]),
  );
  const verifiedUploads: UploadedVideoMetadata[] = [];
  for (const evidence of uploadedEvidence) {
    const completed = completedById.get(evidence.temporaryUploadId);
    if (
      !completed ||
      completed.storagePath !== evidence.storagePath ||
      !completed.label ||
      !completed.uploadedAt
    ) {
      console.error("[fia-upload] Completed upload record missing.", {
        temporaryUploadId: evidence.temporaryUploadId,
        userId: user.id,
      });
      return validationFailure(
        "Der Videobeweis ist noch nicht vollständig bestätigt. Versuche die Verknüpfung erneut.",
      );
    }
    verifiedUploads.push({
      kind: "upload",
      temporaryUploadId: completed.id,
      storagePath: completed.storagePath,
      originalFilename: completed.originalFilename,
      mimeType: completed.mimeType,
      fileSize: completed.fileSize,
      label: completed.label,
      uploadedAt: completed.uploadedAt.toISOString(),
    });
  }

  const verifiedUploadsByPath = new Map(
    verifiedUploads.map((evidence) => [evidence.storagePath, evidence]),
  );
  const evidenceCreateData = parsed.data.evidence.map((evidence) => {
    if (evidence.kind === "external") {
      return {
        submittedByUserId: user.id,
        type: PrismaEvidenceType.LINK,
        url: evidence.url,
        label: evidence.label,
      };
    }

    const verified = verifiedUploadsByPath.get(evidence.storagePath);
    if (!verified) throw new Error("INVALID_UPLOAD");
    return {
      submittedByUserId: user.id,
      type: PrismaEvidenceType.VIDEO,
      url: null,
      label: evidence.label,
      storagePath: verified.storagePath,
      originalFilename: verified.originalFilename,
      mimeType: verified.mimeType,
      fileSize: verified.fileSize,
      createdAt: new Date(verified.uploadedAt),
    };
  });
  let ticketId: number;

  try {
    ticketId = await prisma.$transaction(async (transaction) => {
      const race = await transaction.race.findFirst({
        where: {
          id: parsed.data.raceId,
          season: {
            participatingLeagues: {
              some: { id: parsed.data.leagueId, active: true },
            },
          },
        },
        select: { id: true, seasonId: true, sessions: true },
      });

      if (
        !race ||
        !race.sessions.includes(
          parsed.data.session as PrismaRaceSession,
        )
      ) {
        throw new Error("INVALID_RACE");
      }

      const validDriverCount = await transaction.driver.count({
        where: {
          id: { in: parsed.data.driverIds },
          leagueId: parsed.data.leagueId,
          active: true,
        },
      });

      if (validDriverCount !== parsed.data.driverIds.length) {
        throw new Error("INVALID_DRIVERS");
      }

      const ticket = await transaction.fiaTicket.create({
        data: {
          submissionKey: parsed.data.submissionKey,
          leagueId: parsed.data.leagueId,
          seasonId: race.seasonId,
          raceId: parsed.data.raceId,
          reportedByUserId: user.id,
          title: parsed.data.title,
          description: parsed.data.description,
          session: parsed.data.session as PrismaRaceSession,
          lap: parsed.data.lap ?? null,
          drivers: {
            create: parsed.data.driverIds.map((driverId) => ({ driverId })),
          },
          evidence: {
            create: evidenceCreateData,
          },
        },
        select: {
          id: true,
          drivers: {
            select: {
              driver: { select: { userId: true } },
            },
          },
          evidence: {
            where: { storagePath: { not: null } },
            select: { id: true, storagePath: true },
          },
        },
      });

      for (const upload of verifiedUploads) {
        const evidence = ticket.evidence.find(
          (item) => item.storagePath === upload.storagePath,
        );
        if (!evidence) throw new Error("INVALID_UPLOAD");
        await transaction.evidenceUpload.update({
          where: { id: upload.temporaryUploadId },
          data: {
            ticketId: ticket.id,
            evidenceId: evidence.id,
          },
        });
      }

      await transaction.fiaTicketAuditLog.createMany({
        data: [
          {
            ticketId: ticket.id,
            actorId: user.id,
            action: PrismaTicketAuditAction.CREATED,
            fromStatus: null,
            toStatus: PrismaTicketStatus.OPEN,
            details:
              parsed.data.evidence.length > 0
                ? `Ticket mit ${parsed.data.evidence.length} Beweisnachweis(en) erstellt`
                : "Ticket erstellt",
          },
          ...verifiedUploads.map((evidence) => ({
            ticketId: ticket.id,
            actorId: user.id,
            action: PrismaTicketAuditAction.EVIDENCE_ADDED,
            details: `Video hochgeladen: ${evidence.originalFilename}`,
          })),
        ],
      });

      const raceControlUsers = await transaction.user.findMany({
        where: {
          active: true,
          roles: {
            hasSome: [
              PrismaRole.SUPER_ADMIN,
              PrismaRole.ADMIN,
              PrismaRole.FIA_PRESIDENT,
              PrismaRole.STEWARD,
            ],
          },
        },
        select: { id: true },
      });
      const recipients = new Set(
        raceControlUsers.map((recipient) => recipient.id),
      );
      ticket.drivers.forEach(({ driver }) => {
        if (driver.userId) recipients.add(driver.userId);
      });
      recipients.delete(user.id);
      await createNotifications(transaction, [...recipients], {
        type: NotificationType.FiaTicket,
        priority: NotificationPriority.Normal,
        title: `Neues FIA-Ticket #${ticket.id}`,
        message: parsed.data.title,
        href: `/fia/${ticket.id}`,
        relatedEntity: { type: "FiaTicket", id: ticket.id },
        dedupeKey: `fia-ticket:${ticket.id}`,
      });

      await synchronizeGlobalTeamPrincipalChampionship(
        transaction,
        parsed.data.raceId,
        user.id,
      );
      return ticket.id;
    });
  } catch (error: unknown) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      const duplicate = await prisma.fiaTicket.findFirst({
        where: {
          submissionKey: parsed.data.submissionKey,
          reportedByUserId: user.id,
        },
        select: { id: true },
      });
      if (duplicate) redirect(`/fia/${duplicate.id}`);
    }

    if (error instanceof Error && error.message === "INVALID_RACE") {
      return {
        ...validationFailure(
          "Das gewählte Rennen gehört nicht zur Liga oder unterstützt die Session nicht.",
        ),
        resetUploads: false,
      };
    }

    if (error instanceof Error && error.message === "INVALID_DRIVERS") {
      return {
        ...validationFailure(
          "Mindestens ein gewählter Fahrer ist für diese Liga nicht verfügbar.",
        ),
        resetUploads: false,
      };
    }

    console.error("[fia-ticket] Ticket creation failed.", {
      submissionKey: parsed.data.submissionKey,
      error: error instanceof Error ? error.message : "Unknown",
    });
    return mutationFailure(false);
  }

  await revalidateTicket(ticketId);
  redirect(`/fia/${ticketId}`);
}

export async function startFiaReviewAction(
  ticketIdInput: number,
): Promise<void> {
  const user = await requirePermission(Permission.ReviewFiaTicket);
  const ticketId = ticketIdSchema.parse(ticketIdInput);
  const prisma = getPrismaClient();

  await prisma.$transaction(async (transaction) => {
    const result = await transaction.fiaTicket.updateMany({
      where: {
        id: ticketId,
        archivedAt: null,
        status: PrismaTicketStatus.OPEN,
      },
      data: { status: PrismaTicketStatus.IN_REVIEW },
    });

    if (result.count === 0) {
      return;
    }

    await transaction.fiaTicketSteward.upsert({
      where: { ticketId_userId: { ticketId, userId: user.id } },
      update: {},
      create: { ticketId, userId: user.id },
    });

    await transaction.fiaTicketAuditLog.create({
      data: {
        ticketId,
        actorId: user.id,
        action: PrismaTicketAuditAction.STATUS_CHANGED,
        fromStatus: PrismaTicketStatus.OPEN,
        toStatus: PrismaTicketStatus.IN_REVIEW,
        details: `${ticketStatusLabels[TicketStatus.Open]} → ${ticketStatusLabels[TicketStatus.InReview]}`,
      },
    });
  });

  await revalidateTicket(ticketId);
}

export async function addFiaEvidenceAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.SubmitFiaTicket);
  const ticketIdResult = ticketIdSchema.safeParse(ticketIdInput);
  const parsed = addEvidenceSchema.safeParse({
    kind: "external",
    url: formData.get("url"),
    label: formData.get("label"),
  });

  if (!ticketIdResult.success || !parsed.success) {
    return validationFailure(
      "Bitte gib eine gültige Bezeichnung, URL und Beweisart an.",
      parsed.success
        ? undefined
        : (parsed.error.flatten().fieldErrors as Record<string, string[]>),
    );
  }

  const ticketId = ticketIdResult.data;
  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.fiaTicket.findUnique({
        where: { id: ticketId },
        select: {
          status: true,
          archivedAt: true,
          reportedByUserId: true,
          drivers: { select: { driver: { select: { userId: true } } } },
        },
      });

      const isRelated =
        ticket?.reportedByUserId === user.id ||
        ticket?.drivers.some(({ driver }) => driver.userId === user.id);
      const canReview = hasPermission(
        user.roles,
        Permission.ReviewFiaTicket,
      );

      if (
        !ticket ||
        ticket.archivedAt !== null ||
        ticket.status === PrismaTicketStatus.RESOLVED ||
        (!isRelated && !canReview)
      ) {
        throw new Error("FORBIDDEN");
      }

      await transaction.evidence.create({
        data: {
          ticketId,
          submittedByUserId: user.id,
          type: PrismaEvidenceType.LINK,
          url: parsed.data.url,
          label: parsed.data.label,
        },
      });

      await transaction.fiaTicketAuditLog.create({
        data: {
          ticketId,
          actorId: user.id,
          action: PrismaTicketAuditAction.EVIDENCE_ADDED,
          details: `Beweis hinzugefügt: ${parsed.data.label}`,
        },
      });
    });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "FORBIDDEN") {
      return validationFailure(
        "Zu diesem Ticket können keine Beweise hinzugefügt werden.",
      );
    }

    return mutationFailure();
  }

  await revalidateTicket(ticketId);
  return { status: "success", message: "Beweis wurde gespeichert." };
}

export async function addFiaDiscussionMessageAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.ReviewFiaTicket);
  const ticketIdResult = ticketIdSchema.safeParse(ticketIdInput);
  const parsed = discussionMessageSchema.safeParse({
    message: formData.get("message"),
    clientMessageId: formData.get("clientMessageId"),
    mentionUserIds: formData.getAll("mentionUserId"),
  });

  if (!ticketIdResult.success || !parsed.success) {
    return validationFailure(
      "Der Kommentar muss zwischen 2 und 5.000 Zeichen lang sein.",
    );
  }

  const ticketId = ticketIdResult.data;
  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.fiaTicket.findUnique({
        where: { id: ticketId },
        select: { status: true, archivedAt: true },
      });

      if (
        !ticket ||
        ticket.archivedAt !== null ||
        ticket.status === PrismaTicketStatus.RESOLVED
      ) {
        throw new Error("CLOSED");
      }

      const existing = await transaction.discussionMessage.findUnique({
        where: { clientMessageId: parsed.data.clientMessageId },
        select: { ticketId: true, authorId: true },
      });
      if (existing) {
        if (existing.ticketId !== ticketId || existing.authorId !== user.id) {
          throw new Error("DUPLICATE_MESSAGE_ID");
        }
        return;
      }

      const mentionedUsers = await transaction.user.findMany({
        where: {
          id: { in: parsed.data.mentionUserIds },
          active: true,
          roles: {
            hasSome: [
              PrismaRole.SUPER_ADMIN,
              PrismaRole.ADMIN,
              PrismaRole.FIA_PRESIDENT,
              PrismaRole.STEWARD,
            ],
          },
        },
        select: { id: true, displayName: true },
      });
      if (mentionedUsers.length !== parsed.data.mentionUserIds.length) {
        throw new Error("INVALID_MENTION");
      }
      if (
        !mentionsAreValid(
          parsed.data.message,
          parsed.data.mentionUserIds,
          mentionedUsers,
        )
      ) {
        throw new Error("INVALID_MENTION");
      }

      const message = await transaction.discussionMessage.create({
        data: {
          ticketId,
          authorId: user.id,
          clientMessageId: parsed.data.clientMessageId,
          message: parsed.data.message,
          mentions: {
            create: mentionedUsers.map(({ id }) => ({ userId: id })),
          },
        },
        select: { id: true },
      });

      await transaction.fiaTicketAuditLog.create({
        data: {
          ticketId,
          actorId: user.id,
          action: PrismaTicketAuditAction.DISCUSSION_MESSAGE_ADDED,
          details: "Steward-Kommentar hinzugefügt",
        },
      });

      await createNotifications(
        transaction,
        mentionedUsers
          .map(({ id }) => id)
          .filter((id) => id !== user.id),
        {
          type: NotificationType.FiaTicket,
          priority: NotificationPriority.Normal,
          title: `${user.displayName} hat dich in Ticket #${ticketId} erwähnt`,
          message: parsed.data.message.slice(0, 300),
          href: `/fia/${ticketId}#message-${message.id}`,
          relatedEntity: {
            type: "DiscussionMessage",
            id: message.id,
          },
          dedupeKey: `fia-mention:${message.id}`,
        },
        { allowDiscord: false },
      );
    });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "INVALID_MENTION") {
      return validationFailure(
        "Mindestens eine Erwähnung ist für diesen internen Chat nicht zulässig.",
      );
    }
    if (code === "DUPLICATE_MESSAGE_ID") {
      return validationFailure(
        "Diese Nachricht konnte nicht eindeutig zugeordnet werden.",
      );
    }
    return mutationFailure();
  }

  await revalidateTicket(ticketId);
  return { status: "success", message: "Kommentar wurde gespeichert." };
}

export async function castFiaVoteAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.ReviewFiaTicket);
  const ticketIdResult = ticketIdSchema.safeParse(ticketIdInput);
  const parsed = voteSchema.safeParse({
    penaltyType: formData.get("penaltyType"),
    penaltyValue: formData.get("penaltyValue"),
    reason: formData.get("reason"),
  });

  if (!ticketIdResult.success || !parsed.success) {
    return validationFailure(
      "Bitte wähle eine Strafe und gib eine nachvollziehbare Begründung an.",
      parsed.success
        ? undefined
        : (parsed.error.flatten().fieldErrors as Record<string, string[]>),
    );
  }

  const ticketId = ticketIdResult.data;
  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.fiaTicket.findUnique({
        where: { id: ticketId },
        select: {
          status: true,
          archivedAt: true,
          stewardAssignments: { select: { userId: true } },
        },
      });

      if (
        ticket?.archivedAt !== null ||
        ticket?.status !== PrismaTicketStatus.IN_REVIEW ||
        !canParticipateInProposal({
          roles: user.roles,
          userId: user.id,
          assignedStewardIds:
            ticket?.stewardAssignments.map(
              ({ userId }) => userId,
            ) ?? [],
        })
      ) {
        throw new Error("NOT_IN_REVIEW");
      }

      const existingVote = await transaction.vote.findFirst({
        where: { ticketId, voterId: user.id, proposalId: null },
        select: { id: true },
      });
      if (existingVote) {
        await transaction.vote.update({
          where: { id: existingVote.id },
          data: {
            penaltyType:
              parsed.data.penaltyType as PrismaPenaltyType,
            penaltyValue: parsed.data.penaltyValue ?? null,
            reason: parsed.data.reason,
          },
        });
      } else {
        await transaction.vote.create({
          data: {
            ticketId,
            voterId: user.id,
            penaltyType:
              parsed.data.penaltyType as PrismaPenaltyType,
            penaltyValue: parsed.data.penaltyValue ?? null,
            reason: parsed.data.reason,
          },
        });
      }

      await transaction.fiaTicketAuditLog.create({
        data: {
          ticketId,
          actorId: user.id,
          action: PrismaTicketAuditAction.VOTE_RECORDED,
          details: `Bewertung: ${penaltyTypeLabels[parsed.data.penaltyType]}`,
        },
      });
    });
  } catch {
    return mutationFailure();
  }

  await revalidateTicket(ticketId);
  return { status: "success", message: "Bewertung wurde gespeichert." };
}

export async function publishFiaDecisionAction(
  ticketIdInput: number,
  _previousState: FiaActionState,
  formData: FormData,
): Promise<FiaActionState> {
  const user = await requirePermission(Permission.DecideFiaTicket);
  const ticketIdResult = ticketIdSchema.safeParse(ticketIdInput);
  const parsed = decisionSchema.safeParse({
    penaltyType: formData.get("penaltyType"),
    penaltyValue: formData.get("penaltyValue"),
    reason: formData.get("reason"),
  });

  if (!ticketIdResult.success || !parsed.success) {
    return validationFailure(
      "Bitte vervollständige die finale Entscheidung.",
      parsed.success
        ? undefined
        : (parsed.error.flatten().fieldErrors as Record<string, string[]>),
    );
  }

  const ticketId = ticketIdResult.data;
  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(async (transaction) => {
      const ticket = await transaction.fiaTicket.findUnique({
        where: { id: ticketId },
        select: {
          title: true,
          seasonId: true,
          leagueId: true,
          league: { select: { name: true } },
          status: true,
          archivedAt: true,
          reportedByUserId: true,
          season: {
            select: {
              name: true,
            },
          },
          race: {
            select: {
              name: true,
              circuit: true,
              countryCode: true,
              mystery: true,
              scheduledAt: true,
            },
          },
          drivers: { select: { driver: { select: { userId: true } } } },
          stewardAssignments: { select: { userId: true } },
          votes: {
            where: { proposalId: null },
            select: { voterId: true },
          },
          penaltyProposals: {
            select: { id: true },
            take: 1,
          },
          decision: { select: { id: true } },
        },
      });

      if (
        !ticket ||
        ticket.archivedAt !== null ||
        ticket.status !== PrismaTicketStatus.IN_REVIEW ||
        ticket.decision ||
        ticket.votes.length === 0 ||
        ticket.penaltyProposals.length > 0
      ) {
        throw new Error("INVALID_WORKFLOW");
      }

      const stewardIds = Array.from(
        new Set([...ticket.votes.map((vote) => vote.voterId), user.id]),
      );
      const decision = await transaction.decision.create({
        data: {
          ticketId,
          penaltyType: parsed.data.penaltyType as PrismaPenaltyType,
          penaltyValue: parsed.data.penaltyValue ?? null,
          reason: parsed.data.reason,
          decidedAt: new Date(),
          stewards: {
            create: stewardIds.map((userId) => ({ userId })),
          },
        },
        select: { id: true },
      });

      await transaction.fiaTicket.update({
        where: { id: ticketId },
        data: { status: PrismaTicketStatus.RESOLVED },
      });

      await transaction.fiaTicketAuditLog.createMany({
        data: [
          {
            ticketId,
            actorId: user.id,
            action: PrismaTicketAuditAction.DECISION_PUBLISHED,
            details: `Entscheidung: ${penaltyTypeLabels[parsed.data.penaltyType]}`,
          },
          {
            ticketId,
            actorId: user.id,
            action: PrismaTicketAuditAction.STATUS_CHANGED,
            fromStatus: PrismaTicketStatus.IN_REVIEW,
            toStatus: PrismaTicketStatus.RESOLVED,
            details: `${ticketStatusLabels[TicketStatus.InReview]} → ${ticketStatusLabels[TicketStatus.Resolved]}`,
          },
        ],
      });

      const recipientIds = new Set<number>();

      if (ticket.reportedByUserId) {
        recipientIds.add(ticket.reportedByUserId);
      }

      ticket.drivers.forEach(({ driver }) => {
        if (driver.userId) {
          recipientIds.add(driver.userId);
        }
      });
      ticket.stewardAssignments.forEach(({ userId }) =>
        recipientIds.add(userId),
      );
      recipientIds.delete(user.id);
      const track = publicRaceTrack(ticket.race);

      await createNotifications(
        transaction,
        [...recipientIds],
        {
          type: NotificationType.FiaDecision,
          priority: NotificationPriority.High,
          title: `Entscheidung zu Ticket #${ticketId}`,
          message: `${ticket.title}: ${penaltyTypeLabels[parsed.data.penaltyType]}`,
          href: `/fia/${ticketId}`,
          relatedEntity: { type: "FiaTicket", id: ticketId },
          dedupeKey: `fia-decision:${ticketId}`,
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
        source: "fia-decision-action",
        dedupeKey: `fia-decision-webhook:${ticketId}`,
        payload: {
          ticketId,
          decisionId: decision.id,
          penaltyType: parsed.data.penaltyType,
          penaltyValue: parsed.data.penaltyValue ?? null,
          actorId: user.id,
        },
      });
      if (parsed.data.penaltyType !== "NO_FURTHER_ACTION") {
        const affectedUsers = ticket.drivers.flatMap(({ driver }) =>
          driver.userId && driver.userId !== user.id
            ? [driver.userId]
            : [],
        );
        await createNotifications(
          transaction,
          affectedUsers,
          {
            type: NotificationType.Penalty,
            priority: NotificationPriority.Urgent,
            title: `Strafe aus Ticket #${ticketId}`,
            message: `${ticket.title}: ${penaltyTypeLabels[parsed.data.penaltyType]}`,
            href: `/fia/${ticketId}`,
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

      if (parsed.data.penaltyType === "POINTS_DEDUCTION") {
        await recalculateChampionship(
          transaction,
          ticket.leagueId,
          ticket.seasonId,
          user.id,
        );
      }

      return decision.id;
    });
  } catch (error: unknown) {
    if (
      error instanceof Error &&
      error.message === "INVALID_WORKFLOW"
    ) {
      return validationFailure(
        "Eine Entscheidung erfordert ein Ticket in Bearbeitung, mindestens eine Steward-Bewertung und darf nur einmal veröffentlicht werden.",
      );
    }

    return mutationFailure();
  }

  await revalidateTicket(ticketId);
  revalidatePath("/championship");
  return {
    status: "success",
    message: "Entscheidung wurde veröffentlicht.",
  };
}
