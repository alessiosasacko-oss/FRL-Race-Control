import "server-only";
import {
  WebhookEventStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import type { WebhookEventType } from "@/domain";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export async function recordWebhookEvent(
  database: DatabaseClient,
  input: {
    type: WebhookEventType;
    source: string;
    dedupeKey: string;
    payload: Prisma.InputJsonValue;
  },
): Promise<void> {
  await database.webhookEvent.upsert({
    where: { dedupeKey: input.dedupeKey },
    update: {},
    create: {
      type: input.type,
      source: input.source,
      dedupeKey: input.dedupeKey,
      payload: input.payload,
      status: WebhookEventStatus.PROCESSED,
      processedAt: new Date(),
    },
  });
}
