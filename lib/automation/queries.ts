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
  ] = await prisma.$transaction([
    prisma.discordGuildSettings.findMany({
      orderBy: { guildName: "asc" },
      include: {
        channelMappings: { orderBy: [{ scopeKey: "asc" }, { purpose: "asc" }] },
        roleMappings: { orderBy: { role: "asc" } },
      },
    }),
    prisma.league.findMany({
      where: { active: true },
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
  ]);

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
