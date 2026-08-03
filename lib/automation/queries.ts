import "server-only";
import type {
  AnnouncementTarget,
  AutomationJobStatus,
  AutomationJobType,
  DiscordChannelPurpose,
  NotificationPriority,
  Role,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { buildLeagueChannelMatrixRows } from "@/lib/discord/channel-matrix";
import { getDiscordChannelCatalogState } from "@/lib/discord/channels";
import type {
  AnnouncementListItem,
  AutomationDashboardData,
} from "./types";

export async function getAutomationDashboardData(): Promise<AutomationDashboardData> {
  const prisma = getPrismaClient();
  const [
    guilds,
    leagues,
    jobs,
    recentRuns,
    discordPending,
    discordFailed,
    emailPending,
    emailFailed,
    scheduledAnnouncements,
    failedAnnouncements,
    pendingWebhooks,
    resultGraphicDeliveries,
  ] = await prisma.$transaction([
    prisma.discordGuildSettings.findMany({
      orderBy: { guildName: "asc" },
      include: {
        channelMappings: { orderBy: [{ scopeKey: "asc" }, { purpose: "asc" }] },
        roleMappings: { orderBy: { role: "asc" } },
      },
    }),
    prisma.league.findMany({
      where: { code: { in: ["F1", "F2", "F3", "F4", "F5", "F6"] } },
      orderBy: { code: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.automationJob.findMany({ orderBy: { name: "asc" } }),
    prisma.automationJobRun.findMany({
      orderBy: { startedAt: "desc" },
      take: 20,
      include: { job: { select: { name: true } } },
    }),
    prisma.discordDelivery.count({ where: { status: "PENDING" } }),
    prisma.discordDelivery.count({ where: { status: "FAILED" } }),
    prisma.emailDelivery.count({ where: { status: "PENDING" } }),
    prisma.emailDelivery.count({ where: { status: "FAILED" } }),
    prisma.announcement.count({ where: { status: "SCHEDULED" } }),
    prisma.announcement.count({ where: { status: "FAILED" } }),
    prisma.webhookEvent.count({ where: { status: { in: ["PENDING", "FAILED"] } } }),
    prisma.discordDelivery.findMany({
      where: { resultGraphicId: { not: null } },
      orderBy: { updatedAt: "desc" },
      take: 30,
      include: {
        league: { select: { code: true } },
        resultGraphic: {
          include: { race: { select: { name: true } } },
        },
      },
    }),
  ]);
  const matrixGuild = guilds[0] ?? null;
  const channelState = matrixGuild
    ? await getDiscordChannelCatalogState(matrixGuild.guildId)
    : { status: "error" as const, message: "Zuerst einen Discord-Server speichern.", catalog: null };
  const matrixMappings = matrixGuild?.channelMappings.map((mapping) => ({
    leagueId: mapping.leagueId,
    purpose: mapping.purpose as DiscordChannelPurpose,
    channelId: mapping.channelId,
    enabled: mapping.enabled,
  })) ?? [];

  return {
    guilds: guilds.map((guild) => ({
      id: guild.id,
      guildId: guild.guildId,
      guildName: guild.guildName,
      enabled: guild.enabled,
      botUsername: guild.botUsername,
      heartbeatHealthy: Boolean(
        guild.lastHeartbeatAt &&
          Date.now() - guild.lastHeartbeatAt.getTime() < 10 * 60 * 1000,
      ),
      lastConnectedAt: guild.lastConnectedAt?.toISOString() ?? null,
      lastHeartbeatAt: guild.lastHeartbeatAt?.toISOString() ?? null,
      lastError: guild.lastError,
      channels: guild.channelMappings.map((channel) => ({
        id: channel.id,
        leagueId: channel.leagueId,
        scopeKey: channel.scopeKey,
        purpose: channel.purpose as DiscordChannelPurpose,
        channelId: channel.channelId,
        channelName: channel.channelName,
        enabled: channel.enabled,
      })),
      roles: guild.roleMappings.map((role) => ({
        id: role.id,
        role: role.role as Role,
        discordRoleId: role.discordRoleId,
        discordRoleName: role.discordRoleName,
        enabled: role.enabled,
      })),
    })),
    leagues,
    jobs: jobs.map((job) => ({
      id: job.id,
      type: job.type as AutomationJobType,
      name: job.name,
      status: job.status as AutomationJobStatus,
      enabled: job.enabled,
      intervalMinutes: job.intervalMinutes,
      nextRunAt: job.nextRunAt.toISOString(),
      lastRunAt: job.lastRunAt?.toISOString() ?? null,
      lastError: job.lastError,
    })),
    recentRuns: recentRuns.map((run) => ({
      id: run.id,
      jobName: run.job.name,
      status: run.status as AutomationJobStatus,
      startedAt: run.startedAt.toISOString(),
      finishedAt: run.finishedAt?.toISOString() ?? null,
      error: run.error,
    })),
    queues: {
      discordPending,
      discordFailed,
      emailPending,
      emailFailed,
      scheduledAnnouncements,
      failedAnnouncements,
      pendingWebhooks,
    },
    resultGraphicDeliveries: resultGraphicDeliveries.flatMap((delivery) =>
      delivery.resultGraphic
        ? [{
            id: delivery.id,
            graphicId: delivery.resultGraphic.id,
            type: delivery.resultGraphic.type,
            league: delivery.league?.code ?? `Liga ${delivery.leagueId ?? "–"}`,
            race: delivery.resultGraphic.race.name,
            version: delivery.resultGraphic.version,
            renderingVersion: delivery.renderingVersion ?? delivery.resultGraphic.renderingVersion,
            status: delivery.status,
            attempts: delivery.attempts,
            channelId: delivery.channelId,
            discordMessageId: delivery.discordMessageId,
            publicUrl: delivery.resultGraphic.publicUrl,
            lastError: delivery.lastError,
            updatedAt: delivery.updatedAt.toISOString(),
          }]
        : [],
    ),
    discordChannelMatrix: {
      guildSettingsId: matrixGuild?.id ?? null,
      guildName: matrixGuild?.guildName ?? null,
      rows: buildLeagueChannelMatrixRows(
        leagues,
        matrixMappings,
        channelState.catalog?.channels ?? [],
      ),
      channelState,
    },
  };
}

export async function getAnnouncements(): Promise<AnnouncementListItem[]> {
  const announcements = await getPrismaClient().announcement.findMany({
    orderBy: [{ pinned: "desc" }, { scheduledFor: "desc" }],
    take: 100,
    include: { createdBy: { select: { displayName: true } } },
  });
  return announcements.map((announcement) => ({
    id: announcement.id,
    title: announcement.title,
    content: announcement.content,
    href: announcement.href,
    priority: announcement.priority as NotificationPriority,
    target: announcement.target as AnnouncementTarget,
    status: announcement.status,
    pinned: announcement.pinned,
    scheduledFor: announcement.scheduledFor.toISOString(),
    publishedAt: announcement.publishedAt?.toISOString() ?? null,
    author: announcement.createdBy.displayName,
    lastError: announcement.lastError,
  }));
}
