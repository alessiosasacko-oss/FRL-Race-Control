import "server-only";

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
  const jobs = await prisma.evidenceStorageCleanup.findMany({
    where: options.storagePaths?.length
      ? { storagePath: { in: options.storagePaths } }
      : undefined,
    orderBy: { createdAt: "asc" },
    take: options.limit ?? 50,
  });
  let processed = 0;
  let failed = 0;

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
