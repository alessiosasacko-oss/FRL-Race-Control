import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  EvidenceType as PrismaEvidenceType,
  EvidenceUploadStatus,
  Prisma,
  TicketAuditAction as PrismaTicketAuditAction,
} from "@/generated/prisma/client";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { canModifyFiaEvidence } from "@/lib/fia/evidence-access";
import { getVideoUploadLimits } from "@/lib/storage/evidence-config";
import {
  completeVideoUploadSchema,
  videoUploadCompletionSchema,
} from "@/lib/storage/evidence-schemas";
import {
  EvidenceStorageError,
  verifyStoredVideo,
} from "@/lib/storage/evidence-storage";
import type {
  UploadedVideoMetadata,
  VideoUploadCompletion,
} from "@/lib/storage/evidence-types";

function errorResponse(
  message: string,
  status: number,
  code: string,
): NextResponse {
  return NextResponse.json({ error: message, code }, { status });
}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function completionResponse(
  upload: UploadedVideoMetadata,
  evidenceId?: number,
): NextResponse {
  const response: VideoUploadCompletion = {
    upload,
    ...(evidenceId ? { evidenceId } : {}),
  };
  return NextResponse.json(videoUploadCompletionSchema.parse(response));
}

function storedUploadMetadata(upload: {
  id: string;
  storagePath: string;
  originalFilename: string;
  mimeType: string;
  fileSize: number;
  label: string | null;
  uploadedAt: Date | null;
  completedAt: Date | null;
}): UploadedVideoMetadata | null {
  const timestamp = upload.uploadedAt ?? upload.completedAt;
  if (!upload.label || !timestamp) return null;
  return {
    kind: "upload",
    temporaryUploadId: upload.id,
    storagePath: upload.storagePath,
    originalFilename: upload.originalFilename,
    mimeType: upload.mimeType,
    fileSize: upload.fileSize,
    label: upload.label,
    uploadedAt: timestamp.toISOString(),
  };
}

function verificationFailure(error: unknown): {
  code: string;
  status: number;
  message: string;
} {
  const code =
    error instanceof EvidenceStorageError
      ? error.code
      : error instanceof Error
        ? error.message
        : "UNKNOWN";
  if (
    code === "UPLOADED_VIDEO_METADATA_MISMATCH" ||
    code === "UPLOADED_VIDEO_SIGNATURE_INVALID" ||
    code === "INVALID_STORAGE_PATH"
  ) {
    return {
      code,
      status: 422,
      message:
        "Das gespeicherte Video stimmt nicht mit den Upload-Daten überein.",
    };
  }
  if (code === "UPLOADED_VIDEO_NOT_FOUND") {
    return {
      code,
      status: 404,
      message: "Das gespeicherte Video konnte nicht gefunden werden.",
    };
  }
  return {
    code,
    status: 502,
    message:
      "Das Video wurde hochgeladen, konnte aber noch nicht bestätigt werden. Versuche die Verknüpfung erneut.",
  };
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(
      "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
      401,
      "SESSION_EXPIRED",
    );
  }
  if (!hasPermission(user.roles, Permission.SubmitFiaTicket)) {
    return errorResponse(
      "Keine Berechtigung für FIA-Beweise.",
      403,
      "FORBIDDEN",
    );
  }

  const parsed = completeVideoUploadSchema.safeParse(
    await requestBody(request),
  );
  if (!parsed.success) {
    return errorResponse(
      "Die Upload-Daten sind ungültig.",
      400,
      "INVALID_REQUEST",
    );
  }

  const prisma = getPrismaClient();
  const pendingUpload = await prisma.evidenceUpload.findFirst({
    where: {
      id: parsed.data.temporaryUploadId,
      userId: user.id,
      storagePath: parsed.data.storagePath,
    },
    select: {
      id: true,
      ticketId: true,
      evidenceId: true,
      submissionKey: true,
      storagePath: true,
      originalFilename: true,
      mimeType: true,
      fileSize: true,
      label: true,
      status: true,
      uploadedAt: true,
      completedAt: true,
    },
  });

  if (!pendingUpload) {
    return errorResponse(
      "Der temporäre Upload konnte nicht gefunden werden.",
      404,
      "TEMPORARY_UPLOAD_NOT_FOUND",
    );
  }

  if (pendingUpload.status === EvidenceUploadStatus.COMPLETED) {
    const upload = storedUploadMetadata(pendingUpload);
    if (!upload) {
      return errorResponse(
        "Der abgeschlossene Upload ist unvollständig.",
        409,
        "COMPLETED_UPLOAD_INVALID",
      );
    }
    return completionResponse(
      upload,
      pendingUpload.evidenceId ?? undefined,
    );
  }

  await prisma.evidenceUpload.update({
    where: { id: pendingUpload.id },
    data: {
      status: EvidenceUploadStatus.FINALIZING,
      label: parsed.data.label,
      failureCode: null,
      uploadedAt: pendingUpload.uploadedAt ?? new Date(),
    },
  });

  let verified: UploadedVideoMetadata;
  try {
    verified = await verifyStoredVideo(user.id, {
      temporaryUploadId: pendingUpload.id,
      storagePath: pendingUpload.storagePath,
      originalFilename: pendingUpload.originalFilename,
      mimeType: pendingUpload.mimeType,
      fileSize: pendingUpload.fileSize,
      label: parsed.data.label,
    });
  } catch (error: unknown) {
    const failure = verificationFailure(error);
    await prisma.evidenceUpload.update({
      where: { id: pendingUpload.id },
      data: {
        status: EvidenceUploadStatus.FAILED,
        failureCode: failure.code,
      },
    });
    console.error("[fia-upload] Upload finalization failed.", {
      temporaryUploadId: pendingUpload.id,
      userId: user.id,
      code: failure.code,
    });
    return errorResponse(failure.message, failure.status, failure.code);
  }

  if (pendingUpload.ticketId === null) {
    await prisma.evidenceUpload.update({
      where: { id: pendingUpload.id },
      data: {
        status: EvidenceUploadStatus.COMPLETED,
        label: verified.label,
        mimeType: verified.mimeType,
        fileSize: verified.fileSize,
        uploadedAt: new Date(verified.uploadedAt),
        completedAt: new Date(),
        failureCode: null,
      },
    });
    return completionResponse(verified);
  }

  const ticketId = pendingUpload.ticketId;
  try {
    const evidenceId = await prisma.$transaction(
      async (transaction) => {
        const ticket = await transaction.fiaTicket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            archivedAt: true,
            reportedByUserId: true,
            drivers: {
              select: { driver: { select: { userId: true } } },
            },
            evidence: {
              where: { storagePath: { not: null } },
              select: { id: true, storagePath: true },
            },
          },
        });

        if (!ticket) throw new Error("TICKET_NOT_FOUND");
        if (!canModifyFiaEvidence(user, ticket)) {
          throw new Error("FORBIDDEN");
        }

        const existing = ticket.evidence.find(
          (evidence) =>
            evidence.storagePath === pendingUpload.storagePath,
        );
        if (existing) {
          await transaction.evidenceUpload.update({
            where: { id: pendingUpload.id },
            data: {
              evidenceId: existing.id,
              status: EvidenceUploadStatus.COMPLETED,
              label: verified.label,
              mimeType: verified.mimeType,
              fileSize: verified.fileSize,
              uploadedAt: new Date(verified.uploadedAt),
              completedAt: new Date(),
              failureCode: null,
            },
          });
          return existing.id;
        }

        if (ticket.evidence.length >= getVideoUploadLimits().maxFiles) {
          throw new Error("LIMIT_REACHED");
        }

        const evidence = await transaction.evidence.create({
          data: {
            ticketId,
            submittedByUserId: user.id,
            type: PrismaEvidenceType.VIDEO,
            url: null,
            label: verified.label,
            storagePath: verified.storagePath,
            originalFilename: verified.originalFilename,
            mimeType: verified.mimeType,
            fileSize: verified.fileSize,
            createdAt: new Date(verified.uploadedAt),
          },
          select: { id: true },
        });

        await transaction.evidenceUpload.update({
          where: { id: pendingUpload.id },
          data: {
            evidenceId: evidence.id,
            status: EvidenceUploadStatus.COMPLETED,
            label: verified.label,
            mimeType: verified.mimeType,
            fileSize: verified.fileSize,
            uploadedAt: new Date(verified.uploadedAt),
            completedAt: new Date(),
            failureCode: null,
          },
        });

        await transaction.fiaTicketAuditLog.create({
          data: {
            ticketId,
            actorId: user.id,
            action: PrismaTicketAuditAction.EVIDENCE_ADDED,
            details: `Video hochgeladen: ${verified.originalFilename}`,
          },
        });

        return evidence.id;
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
    );

    revalidatePath(`/fia/${ticketId}`);
    revalidatePath("/fia");
    return completionResponse(verified, evidenceId);
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    const failedUpload = await prisma.evidenceUpload.update({
      where: { id: pendingUpload.id },
      data: {
        status: EvidenceUploadStatus.FAILED,
        failureCode: code.slice(0, 80),
      },
      select: {
        id: true,
        ticketId: true,
        evidenceId: true,
        submissionKey: true,
        storagePath: true,
        originalFilename: true,
        mimeType: true,
        fileSize: true,
        label: true,
        status: true,
        uploadedAt: true,
        completedAt: true,
      },
    });
    console.error("[fia-upload] Evidence linking failed.", {
      temporaryUploadId: failedUpload.id,
      userId: user.id,
      ticketId: failedUpload.ticketId,
      code,
    });
    if (code === "FORBIDDEN") {
      return errorResponse(
        "Zu diesem Ticket können keine Beweise hinzugefügt werden.",
        403,
        code,
      );
    }
    if (code === "TICKET_NOT_FOUND") {
      return errorResponse(
        "Das Ticket konnte nicht gefunden werden.",
        404,
        code,
      );
    }
    if (code === "LIMIT_REACHED") {
      return errorResponse(
        "Das Datei-Limit für dieses Ticket ist erreicht.",
        409,
        code,
      );
    }
    return errorResponse(
      "Das Video wurde hochgeladen, konnte aber noch nicht mit dem Ticket verknüpft werden. Versuche die Verknüpfung erneut.",
      500,
      "EVIDENCE_LINK_FAILED",
    );
  }
}
