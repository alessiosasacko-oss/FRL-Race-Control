import "server-only";
import type {
  Prisma,
  PrismaClient,
} from "@/generated/prisma/client";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function writeSystemAudit(
  database: DatabaseClient,
  input: {
    actorId?: number | null;
    action: string;
    entityType: string;
    entityId?: number | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await database.systemAuditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId ?? null,
      metadata: input.metadata,
    },
  });
}
