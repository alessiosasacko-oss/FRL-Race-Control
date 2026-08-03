import "server-only";
import {
  DiscordDeliveryStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import type { DiscordChannelPurpose } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { isControlledResultGraphicUrl } from "@/lib/graphics/result-graphic-storage";
import { logger } from "@/lib/observability/logger";
import { getConnectedDiscordClient } from "./client";
import { buildDiscordEmbed } from "./embeds";
import {
  discordMessagePayloadSchema,
  type DiscordMessagePayload,
} from "./types";
import { RESULT_GRAPHIC_DISCORD_MAX_ATTEMPTS, resultGraphicScopeKeys } from "./result-graphic-policy";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;
const MAX_ATTEMPTS = 5;

export async function enqueueDiscordDelivery(
  database: DatabaseClient,
  input: {
    purpose: DiscordChannelPurpose;
    leagueId?: number | null;
    announcementId?: number | null;
    resultGraphicId?: number | null;
    renderingVersion?: number | null;
    payload: DiscordMessagePayload;
    dedupeKey: string;
    scheduledFor?: Date;
  },
): Promise<number> {
  const settings = await database.discordGuildSettings.findMany({
    where: input.resultGraphicId
      ? { enabled: true }
      : {
          enabled: true,
          channelMappings: {
            some: {
              enabled: true,
              purpose: input.purpose,
              OR: [
                { scopeKey: "GLOBAL" },
                ...(input.leagueId
                  ? [{ scopeKey: `LEAGUE:${input.leagueId}` }]
                  : []),
              ],
            },
          },
        },
    select: { id: true },
  });

  for (const guild of settings) {
    await database.discordDelivery.upsert({
      where: { dedupeKey: `${input.dedupeKey}:guild:${guild.id}` },
      update: {},
      create: {
        guildSettingsId: guild.id,
        leagueId: input.leagueId ?? null,
        announcementId: input.announcementId ?? null,
        resultGraphicId: input.resultGraphicId ?? null,
        renderingVersion: input.renderingVersion ?? null,
        purpose: input.purpose,
        payload: input.payload,
        dedupeKey: `${input.dedupeKey}:guild:${guild.id}`,
        scheduledFor: input.scheduledFor ?? new Date(),
      },
    });
  }

  return settings.length;
}

export async function processDiscordOutbox(
  limit = 25,
): Promise<{ sent: number; failed: number; skipped: number }> {
  const prisma = getPrismaClient();
  const now = new Date();
  await prisma.discordDelivery.updateMany({
    where: {
      status: DiscordDeliveryStatus.SENDING,
      updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) },
    },
    data: {
      status: DiscordDeliveryStatus.FAILED,
      scheduledFor: now,
      lastError: "Interrupted delivery recovered by outbox processor.",
    },
  });

  const deliveries = await prisma.discordDelivery.findMany({
    where: {
      status: {
        in: [
          DiscordDeliveryStatus.PENDING,
          DiscordDeliveryStatus.FAILED,
        ],
      },
      OR: [
        { resultGraphicId: null, attempts: { lt: MAX_ATTEMPTS } },
        {
          resultGraphicId: { not: null },
          attempts: { lt: RESULT_GRAPHIC_DISCORD_MAX_ATTEMPTS },
        },
      ],
      scheduledFor: { lte: now },
    },
    include: {
      guildSettings: {
        select: {
          guildId: true,
          enabled: true,
          channelMappings: {
            where: { enabled: true },
            select: {
              scopeKey: true,
              purpose: true,
              channelId: true,
            },
          },
        },
      },
    },
    orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
  });
  if (deliveries.length === 0) return { sent: 0, failed: 0, skipped: 0 };

  const client = await getConnectedDiscordClient();
  let sent = 0;
  let failed = 0;
  let skipped = 0;

  for (const delivery of deliveries) {
    const claimed = await prisma.discordDelivery.updateMany({
      where: {
        id: delivery.id,
        status: {
          in: [
            DiscordDeliveryStatus.PENDING,
            DiscordDeliveryStatus.FAILED,
          ],
        },
      },
      data: {
        status: DiscordDeliveryStatus.SENDING,
        attempts: { increment: 1 },
        lastError: null,
      },
    });
    if (claimed.count === 0) continue;

    try {
      if (!delivery.guildSettings.enabled) {
        await prisma.discordDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DiscordDeliveryStatus.SKIPPED,
            lastError: "Discord guild integration is disabled.",
          },
        });
        skipped += 1;
        continue;
      }

      const scopeKeys = delivery.leagueId
        ? delivery.resultGraphicId
          ? resultGraphicScopeKeys(delivery.leagueId)
          : [`LEAGUE:${delivery.leagueId}`, "GLOBAL"]
        : ["GLOBAL"];
      const mapping = scopeKeys
        .map((scopeKey) =>
          delivery.guildSettings.channelMappings.find(
            (candidate) =>
              candidate.scopeKey === scopeKey &&
              candidate.purpose === delivery.purpose,
          ),
        )
        .find((candidate) => candidate !== undefined);

      if (!mapping) {
        await prisma.discordDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DiscordDeliveryStatus.SKIPPED,
            lastError: "No enabled channel mapping is configured.",
          },
        });
        skipped += 1;
        continue;
      }

      const guild = await client.guilds.fetch(
        delivery.guildSettings.guildId,
      );
      const channel = await guild.channels.fetch(mapping.channelId);
      if (!channel?.isTextBased() || !("send" in channel)) {
        throw new Error("Configured Discord channel is not text-based.");
      }

      const payload = discordMessagePayloadSchema.parse(delivery.payload);
      if (
        payload.attachmentUrl &&
        (!delivery.resultGraphicId ||
          !isControlledResultGraphicUrl(payload.attachmentUrl))
      ) {
        throw new Error("Discord attachment does not match the stored result graphic.");
      }
      const messagePayload = {
        embeds: [buildDiscordEmbed(payload)],
        files: payload.attachmentUrl
          ? [
              {
                attachment: payload.attachmentUrl,
                name: payload.attachmentName ?? "frl-result.png",
              },
            ]
          : undefined,
      };
      const existingMessage = delivery.discordMessageId && "messages" in channel
        ? await channel.messages.fetch(delivery.discordMessageId).catch(() => null)
        : null;
      const message = existingMessage
        ? await existingMessage.edit({ ...messagePayload, attachments: [] })
        : await channel.send(messagePayload);
      await prisma.$transaction([
        prisma.discordDelivery.update({
          where: { id: delivery.id },
          data: {
            status: DiscordDeliveryStatus.SENT,
            channelId: mapping.channelId,
            discordMessageId: message.id,
            sentAt: new Date(),
          },
        }),
        prisma.systemAuditLog.create({
          data: { action: "DISCORD_DELIVERY_SENT", entityType: "DiscordDelivery", entityId: delivery.id, metadata: { purpose: delivery.purpose, leagueId: delivery.leagueId, resultGraphicId: delivery.resultGraphicId } },
        }),
      ]);
      sent += 1;
    } catch (error: unknown) {
      const attempts = delivery.attempts + 1;
      const maxAttempts = delivery.resultGraphicId
        ? RESULT_GRAPHIC_DISCORD_MAX_ATTEMPTS
        : MAX_ATTEMPTS;
      const lastError =
        error instanceof Error ? error.message.slice(0, 2000) : String(error);
      await prisma.discordDelivery.update({
        where: { id: delivery.id },
        data: {
          status:
            attempts >= maxAttempts
              ? DiscordDeliveryStatus.SKIPPED
              : DiscordDeliveryStatus.FAILED,
          lastError,
          scheduledFor: new Date(
            Date.now() + Math.min(24, 2 ** attempts) * 60 * 60 * 1000,
          ),
        },
      });
      await prisma.systemAuditLog.create({
        data: { action: "DISCORD_DELIVERY_FAILED", entityType: "DiscordDelivery", entityId: delivery.id, metadata: { purpose: delivery.purpose, leagueId: delivery.leagueId, resultGraphicId: delivery.resultGraphicId, attempts } },
      }).catch(() => undefined);
      logger.error("Discord delivery failed", error, {
        deliveryId: delivery.id,
        attempts,
      });
      failed += 1;
    }
  }

  return { sent, failed, skipped };
}
