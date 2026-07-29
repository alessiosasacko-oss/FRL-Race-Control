import "server-only";

import { EvidenceUploadStatus } from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { removeStoredEvidenceFiles } from "@/lib/storage/evidence-storage";

type CleanupResult = {
  processed: number;
  failed: number;
};

export async function processEvidenceStorageCleanupQueue(
  options: { storagePaths?: string[]; limit?: number } = {},
): Promise<CleanupResult> {
  const prisma = getPrismaClient();
  let processed = 0;
  let failed = 0;
  const now = new Date();
  await prisma.evidenceUpload.updateMany({
    where: {
      evidenceId: null,
      expiresAt: { lte: now },
      status: {
        in: [
          EvidenceUploadStatus.PREPARED,
          EvidenceUploadStatus.FINALIZING,
          EvidenceUploadStatus.FAILED,
        ],
      },
    },
    data: { status: EvidenceUploadStatus.ORPHANED },
  });

  const staleOrphans = await prisma.evidenceUpload.findMany({
    where: {
      evidenceId: null,
      status: EvidenceUploadStatus.ORPHANED,
      updatedAt: {
        lte: new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000),
      },
    },
    select: { id: true, storagePath: true },
    orderBy: { updatedAt: "asc" },
    take: options.limit ?? 50,
  });
  for (const orphan of staleOrphans) {
    try {
      await removeStoredEvidenceFiles([orphan.storagePath]);
      const deleted = await prisma.evidenceUpload.deleteMany({
        where: { id: orphan.id, evidenceId: null },
      });
      processed += deleted.count;
    } catch {
      failed += 1;
    }
  }

  const jobs = await prisma.evidenceStorageCleanup.findMany({
    where: options.storagePaths?.length
      ? { storagePath: { in: options.storagePaths } }
      : undefined,
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 50,
  });
  for (const job of jobs) {
    try {
      await removeStoredEvidenceFiles([job.storagePath]);
      const deleted = await prisma.evidenceStorageCleanup.deleteMany({
        where: { id: job.id },
      });
      processed += deleted.count;
    } catch (error: unknown) {
      await prisma.evidenceStorageCleanup.updateMany({
        where: { id: job.id },
        data: {
          attempts: { increment: 1 },
          lastError:
            error instanceof Error ? error.message.slice(0, 2000) : "Unknown",
        },
      });
      failed += 1;
    }
  }

  return { processed, failed };
}
