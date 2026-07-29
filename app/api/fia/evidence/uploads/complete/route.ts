import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  EvidenceType as PrismaEvidenceType,
  Prisma,
  TicketAuditAction as PrismaTicketAuditAction,
} from "@/generated/prisma/client";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  canModifyFiaEvidence,
} from "@/lib/fia/evidence-access";
import { ticketIdSchema } from "@/lib/fia/schemas";
import { getVideoUploadLimits } from "@/lib/storage/evidence-config";
import { completeVideoUploadSchema } from "@/lib/storage/evidence-schemas";
import { verifyStoredVideo } from "@/lib/storage/evidence-storage";

function errorResponse(message: string, status: number): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

async function requestBody(
  request: Request,
): Promise<{ ticketId?: unknown; upload?: unknown }> {
  try {
    const value = (await request.json()) as unknown;
    return value && typeof value === "object"
      ? (value as { ticketId?: unknown; upload?: unknown })
      : {};
  } catch {
    return {};
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

  const body = await requestBody(request);
  const parsedUpload = completeVideoUploadSchema.safeParse(body.upload);
  const parsedTicketId =
    body.ticketId === undefined
      ? { success: true as const, data: undefined }
      : ticketIdSchema.safeParse(body.ticketId);

  if (!parsedUpload.success || !parsedTicketId.success) {
    return errorResponse("Die Upload-Daten sind ungültig.", 400);
  }

  let verified;
  try {
    verified = await verifyStoredVideo(user.id, parsedUpload.data);
  } catch {
    return errorResponse(
      "Das hochgeladene Video hat die Sicherheitsprüfung nicht bestanden.",
      400,
    );
  }

  if (parsedTicketId.data === undefined) {
    return NextResponse.json({ upload: verified });
  }

  const ticketId = parsedTicketId.data;
  const prisma = getPrismaClient();

  try {
    const evidenceId = await prisma.$transaction(
      async (transaction) => {
        const ticket = await transaction.fiaTicket.findUnique({
          where: { id: ticketId },
          select: {
            status: true,
            reportedByUserId: true,
            drivers: {
              select: { driver: { select: { userId: true } } },
            },
            evidence: {
              where: { storagePath: { not: null } },
              select: { id: true },
            },
          },
        });

        if (!ticket || !canModifyFiaEvidence(user, ticket)) {
          throw new Error("FORBIDDEN");
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
    return NextResponse.json({ evidenceId, upload: verified });
  } catch (error: unknown) {
    const code = error instanceof Error ? error.message : "";
    if (code === "FORBIDDEN") {
      return errorResponse(
        "Zu diesem Ticket können keine Beweise hinzugefügt werden.",
        403,
      );
    }
    if (code === "LIMIT_REACHED") {
      return errorResponse("Das Datei-Limit für dieses Ticket ist erreicht.", 409);
    }
    return errorResponse("Die Datei konnte nicht hochgeladen werden.", 500);
  }
}
