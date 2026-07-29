import { revalidatePath } from "next/cache";
import { NextResponse } from "next/server";
import {
  TicketAuditAction as PrismaTicketAuditAction,
} from "@/generated/prisma/client";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  canAccessFiaEvidence,
  canModifyFiaEvidence,
} from "@/lib/fia/evidence-access";
import { ticketIdSchema } from "@/lib/fia/schemas";
import { logger } from "@/lib/observability/logger";
import {
  createSignedVideoViewUrl,
} from "@/lib/storage/evidence-storage";
import { processEvidenceStorageCleanupQueue } from "@/lib/storage/evidence-cleanup";

async function loadEvidence(id: number) {
  return getPrismaClient().evidence.findUnique({
    where: { id },
    select: {
      id: true,
      label: true,
      storagePath: true,
      ticketId: true,
        ticket: {
          select: {
            status: true,
            archivedAt: true,
          reportedByUserId: true,
          drivers: {
            select: { driver: { select: { userId: true } } },
          },
        },
      },
    },
  });
}

export async function GET(
  _request: Request,
  context: RouteContext<"/api/fia/evidence/[id]">,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const { id } = await context.params;
  const parsedId = ticketIdSchema.safeParse(id);
  if (!parsedId.success) return new Response("Nicht gefunden.", { status: 404 });

  const evidence = await loadEvidence(parsedId.data);
  if (
    !evidence?.storagePath ||
    !canAccessFiaEvidence(user, evidence.ticket)
  ) {
    return new Response("Nicht gefunden.", { status: 404 });
  }

  try {
    const signedUrl = await createSignedVideoViewUrl(evidence.storagePath);
    return NextResponse.redirect(signedUrl);
  } catch {
    return new Response("Der Beweis ist aktuell nicht verfügbar.", {
      status: 503,
    });
  }
}

export async function DELETE(
  _request: Request,
  context: RouteContext<"/api/fia/evidence/[id]">,
): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) return new Response("Nicht angemeldet.", { status: 401 });

  const { id } = await context.params;
  const parsedId = ticketIdSchema.safeParse(id);
  if (!parsedId.success) return new Response("Nicht gefunden.", { status: 404 });

  const evidence = await loadEvidence(parsedId.data);
  if (!evidence || !canModifyFiaEvidence(user, evidence.ticket)) {
    return new Response("Nicht gefunden.", { status: 404 });
  }

  const prisma = getPrismaClient();
  await prisma.$transaction(async (transaction) => {
    await transaction.evidenceUpload.deleteMany({
      where: { evidenceId: evidence.id },
    });
    await transaction.evidence.delete({ where: { id: evidence.id } });
    await transaction.fiaTicketAuditLog.create({
      data: {
        ticketId: evidence.ticketId,
        actorId: user.id,
        action: PrismaTicketAuditAction.EVIDENCE_REMOVED,
        details: `Beweis entfernt: ${evidence.label}`,
      },
    });
  });

  if (evidence.storagePath) {
    try {
      const cleanup = await processEvidenceStorageCleanupQueue({
        storagePaths: [evidence.storagePath],
      });
      if (cleanup.failed > 0) {
        logger.warn("Private evidence object cleanup queued for retry", {
          evidenceId: evidence.id,
          storagePath: evidence.storagePath,
        });
      }
    } catch (error: unknown) {
      logger.warn("Private evidence object cleanup failed", {
        evidenceId: evidence.id,
        storagePath: evidence.storagePath,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  revalidatePath(`/fia/${evidence.ticketId}`);
  revalidatePath("/fia");
  return NextResponse.json({ success: true });
}
