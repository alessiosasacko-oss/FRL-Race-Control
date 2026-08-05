import "server-only";

import { getPrismaClient } from "@/lib/db/prisma";

const COMPLETED_RECORD_RETENTION_MS = 24 * 60 * 60 * 1_000;
const SESSION_RECORD_RETENTION_MS = 30 * 24 * 60 * 60 * 1_000;

export function mobileAuthCleanupCutoffs(now = new Date()) {
  return {
    now,
    completedBefore: new Date(now.getTime() - COMPLETED_RECORD_RETENTION_MS),
    sessionBefore: new Date(now.getTime() - SESSION_RECORD_RETENTION_MS),
  };
}

export async function cleanupMobileAuthRecords(now = new Date()): Promise<{
  authorizationCodes: number;
  oauthAttempts: number;
  sessions: number;
}> {
  const prisma = getPrismaClient();
  const cutoffs = mobileAuthCleanupCutoffs(now);
  return prisma.$transaction(async (transaction) => {
    const authorizationCodes =
      await transaction.mobileAuthorizationCode.deleteMany({
        where: {
          OR: [
            { expiresAt: { lt: cutoffs.now } },
            { usedAt: { lt: cutoffs.completedBefore } },
          ],
        },
      });
    const oauthAttempts = await transaction.mobileOAuthAttempt.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoffs.now } },
          { completedAt: { lt: cutoffs.completedBefore } },
        ],
      },
    });
    const sessions = await transaction.mobileSession.deleteMany({
      where: {
        OR: [
          { expiresAt: { lt: cutoffs.sessionBefore } },
          { revokedAt: { lt: cutoffs.sessionBefore } },
        ],
      },
    });
    return {
      authorizationCodes: authorizationCodes.count,
      oauthAttempts: oauthAttempts.count,
      sessions: sessions.count,
    };
  });
}
