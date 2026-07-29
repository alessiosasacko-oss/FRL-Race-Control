import { NextResponse } from "next/server";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { canModifyFiaEvidence } from "@/lib/fia/evidence-access";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  cancelVideoUploadSchema,
  videoUploadRequestSchema,
  videoUploadPreparationSchema,
} from "@/lib/storage/evidence-schemas";
import {
  createSignedVideoUpload,
  isOwnedPendingStoragePath,
  removeStoredEvidenceFiles,
} from "@/lib/storage/evidence-storage";

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function requestBody(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

export async function POST(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(
      "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
      401,
    );
  }
  if (!hasPermission(user.roles, Permission.SubmitFiaTicket)) {
    return errorResponse("Keine Berechtigung für FIA-Beweise.", 403);
  }

  const rateLimit = consumeRateLimit(`fia-video-upload:${user.id}`, {
    limit: 20,
    windowMs: 60 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: "Zu viele Upload-Versuche. Bitte warte kurz." },
      {
        status: 429,
        headers: { "Retry-After": String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const parsed = videoUploadRequestSchema.safeParse(
    await requestBody(request),
  );
  if (!parsed.success) {
    return errorResponse("Die Dateimetadaten sind ungültig.", 400);
  }

  try {
    const prisma = getPrismaClient();

    if (parsed.data.ticketId !== undefined) {
      const ticket = await prisma.fiaTicket.findUnique({
        where: { id: parsed.data.ticketId },
        select: {
          status: true,
          archivedAt: true,
          reportedByUserId: true,
          drivers: {
            select: { driver: { select: { userId: true } } },
          },
        },
      });
      if (!ticket) {
        return errorResponse("Das Ticket konnte nicht gefunden werden.", 404);
      }
      if (!canModifyFiaEvidence(user, ticket)) {
        return errorResponse(
          "Zu diesem Ticket können keine Beweise hinzugefügt werden.",
          403,
        );
      }
    }

    const upload = await createSignedVideoUpload(user.id, parsed.data);
    const pendingUpload = await prisma.evidenceUpload.create({
      data: {
        userId: user.id,
        ticketId: parsed.data.ticketId,
        submissionKey: parsed.data.submissionKey,
        storagePath: upload.storagePath,
        originalFilename: parsed.data.originalFilename,
        mimeType: parsed.data.mimeType.toLowerCase(),
        fileSize: parsed.data.fileSize,
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      },
      select: { id: true },
    });
    const response = videoUploadPreparationSchema.parse({
      temporaryUploadId: pendingUpload.id,
      ...upload,
    });
    return NextResponse.json(response, { status: 201 });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "UNSUPPORTED_VIDEO_TYPE") {
      return errorResponse("Dieses Videoformat wird nicht unterstützt.", 400);
    }
    if (code === "VIDEO_TOO_LARGE") {
      return errorResponse(
        "Die Videodatei ist zu groß. Bitte beachte das angezeigte Größenlimit.",
        400,
      );
    }
    if (code === "EVIDENCE_STORAGE_NOT_CONFIGURED") {
      return errorResponse("Der Video-Upload ist noch nicht konfiguriert.", 503);
    }
    console.error("[fia-upload] Upload preparation failed.", {
      userId: user.id,
      code: code || "UNKNOWN",
    });
    return errorResponse("Die Datei konnte nicht hochgeladen werden.", 502);
  }
}

export async function DELETE(request: Request): Promise<NextResponse> {
  const user = await getCurrentUser();
  if (!user) {
    return errorResponse(
      "Deine Sitzung ist abgelaufen. Bitte melde dich erneut an.",
      401,
    );
  }

  const parsed = cancelVideoUploadSchema.safeParse(
    await requestBody(request),
  );
  if (
    !parsed.success ||
    !isOwnedPendingStoragePath(parsed.data.storagePath, user.id)
  ) {
    return errorResponse("Der Upload-Pfad ist ungültig.", 400);
  }

  const attachedEvidence = await getPrismaClient().evidence.findUnique({
    where: { storagePath: parsed.data.storagePath },
    select: { id: true },
  });
  if (attachedEvidence) {
    return errorResponse(
      "Bereits zugeordnete Beweise können hier nicht entfernt werden.",
      409,
    );
  }

  try {
    await removeStoredEvidenceFiles([parsed.data.storagePath]);
    await getPrismaClient().evidenceUpload.deleteMany({
      where: {
        userId: user.id,
        storagePath: parsed.data.storagePath,
        ...(parsed.data.temporaryUploadId
          ? { id: parsed.data.temporaryUploadId }
          : {}),
        evidenceId: null,
      },
    });
    return NextResponse.json({ success: true });
  } catch {
    return errorResponse("Der abgebrochene Upload konnte nicht entfernt werden.", 502);
  }
}
