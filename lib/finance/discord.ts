import "server-only";

import { z } from "zod";
import {
  DiscordChannelPurpose,
  DiscordDeliveryStatus,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { buildDiscordEmbed } from "@/lib/discord/embeds";
import { getConnectedDiscordClient } from "@/lib/discord/client";
import { logger } from "@/lib/observability/logger";
import { publicRaceTrack } from "@/lib/races/visibility";
import { formatEuro } from "./rules";

const financePayloadSchema = z.object({
  kind: z.literal("FINANCE"),
  title: z.string().trim().min(1).max(256),
  description: z.string().trim().min(1).max(4096),
  color: z.string().regex(/^#[0-9A-F]{6}$/i),
  league: z.string().max(160),
  season: z.string().max(160),
  race: z.string().max(160),
  mentionRoleId: z.string().regex(/^\d{17,20}$/).nullable(),
});

export type FinanceDiscordPreview = z.infer<typeof financePayloadSchema> & {
  channelId: string;
  channelName: string | null;
  roleName: string | null;
  settlementId: number;
  revision: number;
};

export function renderFinanceTemplate(
  template: string,
  values: { league: string; season: string; race: string; round: number; date: string },
): string {
  const replacements: Record<string, string> = {
    league: values.league,
    season: values.season,
    race: values.race,
    round: String(values.round),
    date: values.date,
  };
  return template.replace(/\{(league|season|race|round|date)\}/g, (_, key: string) => replacements[key] ?? "");
}

export async function buildFinanceDiscordPreview(raceId: number, leagueId: number): Promise<FinanceDiscordPreview> {
  const prisma = getPrismaClient();
  const settlement = await prisma.raceFinanceSettlement.findUnique({
    where: { raceId_leagueId: { raceId, leagueId } },
    select: {
      id: true,
      revision: true,
      race: { select: { id: true, name: true, circuit: true, countryCode: true, mystery: true, scheduledAt: true, round: true } },
      league: { select: { id: true, code: true, name: true, color: true } },
      season: { select: { id: true, name: true } },
      transactions: { select: { accountId: true, amountEuro: true } },
    },
  });
  if (!settlement) throw new Error("FINANCE_SETTLEMENT_NOT_FOUND");
  const setting = await prisma.financePublishSetting.findUnique({ where: { leagueId } });
  if (!setting?.enabled) throw new Error("FINANCE_PUBLISHING_DISABLED");
  const accounts = await prisma.teamFinanceAccount.findMany({
    where: { leagueId, seasonId: settlement.season.id },
    orderBy: [{ balanceEuro: "desc" }, { team: { name: "asc" } }],
    select: { id: true, balanceEuro: true, team: { select: { name: true } } },
  });
  const deltaByAccount = new Map<number, bigint>();
  for (const transaction of settlement.transactions) {
    deltaByAccount.set(transaction.accountId, (deltaByAccount.get(transaction.accountId) ?? BigInt(0)) + transaction.amountEuro);
  }
  const track = publicRaceTrack(settlement.race);
  const safeRaceName = track.name;
  const date = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: "Europe/Berlin" }).format(settlement.race.scheduledAt);
  const intro = renderFinanceTemplate(setting.messageTemplate, {
    league: `FRL ${settlement.league.code}`,
    season: settlement.season.name,
    race: safeRaceName,
    round: settlement.race.round,
    date,
  });
  const rows = accounts.map((account, index) => {
    const balance = setting.showBalances ? `\n${formatEuro(account.balanceEuro)}` : "";
    const delta = deltaByAccount.get(account.id) ?? BigInt(0);
    const deltaText = setting.showDelta ? `\n${delta >= BigInt(0) ? "+" : "−"}${formatEuro(delta >= BigInt(0) ? delta : -delta)}` : "";
    return `**${index + 1}. ${account.team.name}**${balance}${deltaText}`;
  });
  return {
    kind: "FINANCE",
    title: `FRL ${settlement.league.code} · Teamfinanzen`,
    description: `${intro}\n\n${rows.join("\n\n")}`.slice(0, 4096),
    color: settlement.league.color ?? "#3B82F6",
    league: settlement.league.name,
    season: settlement.season.name,
    race: safeRaceName,
    mentionRoleId: setting.pingRoleId,
    channelId: setting.channelId,
    channelName: setting.channelName,
    roleName: setting.pingRoleName,
    settlementId: settlement.id,
    revision: settlement.revision,
  };
}

export async function queueFinanceDiscordPublication(
  raceId: number,
  leagueId: number,
  options: { force?: boolean } = {},
) {
  const prisma = getPrismaClient();
  const preview = await buildFinanceDiscordPreview(raceId, leagueId);
  const setting = await prisma.financePublishSetting.findUnique({ where: { leagueId }, select: { guildSettingsId: true } });
  if (!setting) throw new Error("FINANCE_PUBLISHING_DISABLED");
  const dedupeKey = `finance:${preview.settlementId}:revision:${preview.revision}:guild:${setting.guildSettingsId}`;
  const existing = await prisma.discordDelivery.findUnique({ where: { dedupeKey }, select: { id: true, status: true } });
  if (existing && !options.force) return { deliveryId: existing.id, queued: false };
  const delivery = await prisma.discordDelivery.upsert({
    where: { dedupeKey },
    update: {
      payload: preview,
      channelId: preview.channelId,
      status: DiscordDeliveryStatus.PENDING,
      scheduledFor: new Date(),
      lastError: null,
    },
    create: {
      guildSettingsId: setting.guildSettingsId,
      leagueId,
      purpose: DiscordChannelPurpose.FINANCE_STANDINGS,
      status: DiscordDeliveryStatus.PENDING,
      payload: preview,
      dedupeKey,
      channelId: preview.channelId,
    },
  });
  return { deliveryId: delivery.id, queued: true };
}

export async function queueAutomaticFinancePublication(raceId: number, leagueId: number, changed: boolean): Promise<boolean> {
  if (!changed) return false;
  const setting = await getPrismaClient().financePublishSetting.findUnique({ where: { leagueId }, select: { enabled: true, autoPublish: true } });
  if (!setting?.enabled || !setting.autoPublish) return false;
  return (await queueFinanceDiscordPublication(raceId, leagueId)).queued;
}

export async function processFinanceDiscordOutbox(limit = 10): Promise<{ sent: number; failed: number }> {
  const prisma = getPrismaClient();
  const now = new Date();
  await prisma.discordDelivery.updateMany({
    where: { purpose: DiscordChannelPurpose.FINANCE_STANDINGS, status: DiscordDeliveryStatus.SENDING, updatedAt: { lt: new Date(now.getTime() - 15 * 60 * 1000) } },
    data: { status: DiscordDeliveryStatus.FAILED, scheduledFor: now, lastError: "Unterbrochene Finance-Veröffentlichung wiederhergestellt." },
  });
  const deliveries = await prisma.discordDelivery.findMany({
    where: {
      purpose: DiscordChannelPurpose.FINANCE_STANDINGS,
      status: { in: [DiscordDeliveryStatus.PENDING, DiscordDeliveryStatus.FAILED] },
      attempts: { lt: 5 },
      scheduledFor: { lte: now },
    },
    include: { guildSettings: { select: { guildId: true, enabled: true } } },
    orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 25),
  });
  if (deliveries.length === 0) return { sent: 0, failed: 0 };
  const client = await getConnectedDiscordClient();
  let sent = 0;
  let failed = 0;
  for (const delivery of deliveries) {
    const claimed = await prisma.discordDelivery.updateMany({
      where: { id: delivery.id, status: { in: [DiscordDeliveryStatus.PENDING, DiscordDeliveryStatus.FAILED] } },
      data: { status: DiscordDeliveryStatus.SENDING, attempts: { increment: 1 }, lastError: null },
    });
    if (claimed.count === 0) continue;
    try {
      if (!delivery.guildSettings.enabled || !delivery.channelId) throw new Error("FINANCE_DISCORD_TARGET_UNAVAILABLE");
      const payload = financePayloadSchema.parse(delivery.payload);
      const guild = await client.guilds.fetch(delivery.guildSettings.guildId);
      const channel = await guild.channels.fetch(delivery.channelId);
      if (!channel?.isTextBased() || !("send" in channel)) throw new Error("FINANCE_DISCORD_CHANNEL_INVALID");
      const messagePayload = {
        content: payload.mentionRoleId ? `<@&${payload.mentionRoleId}>` : undefined,
        allowedMentions: payload.mentionRoleId ? { parse: [] as never[], roles: [payload.mentionRoleId] } : { parse: [] as never[] },
        embeds: [buildDiscordEmbed(payload)],
      };
      const existingMessage = delivery.discordMessageId && "messages" in channel
        ? await channel.messages.fetch(delivery.discordMessageId).catch(() => null)
        : null;
      const message = existingMessage ? await existingMessage.edit(messagePayload) : await channel.send(messagePayload);
      await prisma.$transaction([
        prisma.discordDelivery.update({ where: { id: delivery.id }, data: { status: DiscordDeliveryStatus.SENT, discordMessageId: message.id, sentAt: new Date(), lastError: null } }),
        prisma.systemAuditLog.create({ data: { action: "FINANCE_DISCORD_SENT", entityType: "DiscordDelivery", entityId: delivery.id, metadata: { leagueId: delivery.leagueId } } }),
      ]);
      sent += 1;
    } catch {
      const attempts = delivery.attempts + 1;
      await prisma.discordDelivery.update({
        where: { id: delivery.id },
        data: {
          status: attempts >= 5 ? DiscordDeliveryStatus.SKIPPED : DiscordDeliveryStatus.FAILED,
          lastError: "Finance-Veröffentlichung konnte nicht zugestellt werden.",
          scheduledFor: new Date(Date.now() + Math.min(24, 2 ** attempts) * 60 * 60 * 1000),
        },
      });
      logger.error("Finance Discord delivery failed", new Error("Finance Discord delivery failed"), { deliveryId: delivery.id, attempts });
      failed += 1;
    }
  }
  return { sent, failed };
}
