import "server-only";
import {
  AutomationJobType,
  NotificationPriority,
  NotificationType,
} from "@/domain";
import {
  AutomationJobStatus as PrismaJobStatus,
  AutomationJobType as PrismaJobType,
  type Prisma,
} from "@/generated/prisma/client";
import { publishDueAnnouncements } from "@/lib/announcements/service";
import { processDiscordOutbox } from "@/lib/discord/outbox";
import { synchronizeDiscordRoles } from "@/lib/discord/roles";
import { processEmailOutbox } from "@/lib/email/outbox";
import { getPrismaClient } from "@/lib/db/prisma";
import {
  createNotifications,
  leagueUserIds,
} from "@/lib/notifications/service";
import { generateAttendanceNotifications } from "@/lib/notifications/scheduler";
import { logger } from "@/lib/observability/logger";

type JobDefinition = {
  type: AutomationJobType;
  name: string;
  intervalMinutes: number;
};

const jobDefinitions: readonly JobDefinition[] = [
  { type: AutomationJobType.AttendanceReminders, name: "Rennanmeldungs-Erinnerungen", intervalMinutes: 60 },
  { type: AutomationJobType.UpcomingRaceReminders, name: "Rennwochenend-Erinnerungen", intervalMinutes: 60 },
  { type: AutomationJobType.ChampionshipVerification, name: "Meisterschaftsprüfung", intervalMinutes: 360 },
  { type: AutomationJobType.NotificationCleanup, name: "Benachrichtigungs-Bereinigung", intervalMinutes: 1440 },
  { type: AutomationJobType.EmailQueue, name: "E-Mail-Outbox", intervalMinutes: 5 },
  { type: AutomationJobType.DiscordQueue, name: "Discord-Outbox", intervalMinutes: 2 },
  { type: AutomationJobType.MysteryRacePublication, name: "Mystery-Race-Veröffentlichung", intervalMinutes: 30 },
  { type: AutomationJobType.StatisticsRefresh, name: "Statistik-Aktualisierung", intervalMinutes: 60 },
  { type: AutomationJobType.AnnouncementPublication, name: "Geplante Mitteilungen", intervalMinutes: 2 },
  { type: AutomationJobType.DiscordRoleSync, name: "Discord-Rollensynchronisierung", intervalMinutes: 30 },
] as const;

export async function ensureAutomationJobs(): Promise<void> {
  const prisma = getPrismaClient();
  for (const definition of jobDefinitions) {
    await prisma.automationJob.upsert({
      where: { type: definition.type as PrismaJobType },
      update: {
        name: definition.name,
        intervalMinutes: definition.intervalMinutes,
      },
      create: {
        type: definition.type as PrismaJobType,
        name: definition.name,
        intervalMinutes: definition.intervalMinutes,
        nextRunAt: new Date(),
      },
    });
  }
}

async function upcomingRaceReminders() {
  const prisma = getPrismaClient();
  const now = new Date();
  const until = new Date(now.getTime() + 36 * 60 * 60 * 1000);
  const races = await prisma.race.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { gt: now, lte: until },
    },
    include: {
      season: { include: { league: true } },
    },
  });

  for (const race of races) {
    const recipients = await leagueUserIds(prisma, race.season.leagueId);
    await createNotifications(
      prisma,
      recipients,
      {
        type: NotificationType.RaceReminder,
        priority: NotificationPriority.High,
        title: `${race.season.league.name}: Rennwochenende`,
        message: `${race.name} auf ${race.circuit} startet am ${new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short", timeZone: race.timezone }).format(race.scheduledAt)}.`,
        href: `/calendar?raceId=${race.id}`,
        relatedEntity: { type: "Race", id: race.id },
        dedupeKey: `race-weekend:${race.id}`,
      },
      {
        leagueId: race.season.leagueId,
        discordContext: {
          league: race.season.league.name,
          season: race.season.name,
          race: race.name,
          track: race.mystery ? "Mystery Race" : race.circuit,
        },
      },
    );
  }
  return { races: races.length };
}

async function verifyChampionships() {
  const prisma = getPrismaClient();
  const championships = await prisma.championship.findMany({
    include: {
      season: { select: { active: true } },
      driverStandings: { select: { position: true } },
      teamStandings: { select: { position: true } },
    },
  });
  const issues = championships.filter((championship) => {
    const driverPositions = championship.driverStandings
      .map((standing) => standing.position)
      .sort((a, b) => a - b);
    const teamPositions = championship.teamStandings
      .map((standing) => standing.position)
      .sort((a, b) => a - b);
    return (
      driverPositions.some((position, index) => position !== index + 1) ||
      teamPositions.some((position, index) => position !== index + 1)
    );
  });
  if (issues.length > 0) {
    throw new Error(
      `Invalid standing positions in championships: ${issues.map((item) => item.id).join(", ")}`,
    );
  }
  return { checked: championships.length, issues: 0 };
}

async function cleanupNotifications() {
  const prisma = getPrismaClient();
  const notificationCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const eventCutoff = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const [notifications, webhooks] = await prisma.$transaction([
    prisma.notification.deleteMany({
      where: { archivedAt: { lt: notificationCutoff } },
    }),
    prisma.webhookEvent.deleteMany({
      where: { status: "PROCESSED", processedAt: { lt: eventCutoff } },
    }),
  ]);
  return {
    deletedNotifications: notifications.count,
    deletedWebhookEvents: webhooks.count,
  };
}

async function publishMysteryRaces() {
  const prisma = getPrismaClient();
  const cutoff = new Date(Date.now() + 48 * 60 * 60 * 1000);
  const races = await prisma.race.findMany({
    where: {
      mystery: true,
      status: "SCHEDULED",
      scheduledAt: { lte: cutoff },
    },
    include: { season: { include: { league: true } } },
  });
  for (const race of races) {
    await prisma.$transaction(async (transaction) => {
      await transaction.race.update({
        where: { id: race.id },
        data: { mystery: false },
      });
      const recipients = await leagueUserIds(
        transaction,
        race.season.leagueId,
      );
      await createNotifications(
        transaction,
        recipients,
        {
          type: NotificationType.NewRace,
          priority: NotificationPriority.High,
          title: `Mystery Race enthüllt: ${race.name}`,
          message: `Gefahren wird auf ${race.circuit}.`,
          href: `/calendar?raceId=${race.id}`,
          relatedEntity: { type: "Race", id: race.id },
          dedupeKey: `mystery-published:${race.id}`,
        },
        {
          leagueId: race.season.leagueId,
          discordContext: {
            league: race.season.league.name,
            season: race.season.name,
            race: race.name,
            track: race.circuit,
          },
        },
      );
    });
  }
  return { published: races.length };
}

async function refreshStatistics() {
  const prisma = getPrismaClient();
  const [activeUsers, upcomingRaces, openTickets, pendingDeliveries] =
    await prisma.$transaction([
      prisma.user.count({ where: { active: true } }),
      prisma.race.count({
        where: { status: "SCHEDULED", scheduledAt: { gte: new Date() } },
      }),
      prisma.fiaTicket.count({ where: { status: { not: "RESOLVED" } } }),
      prisma.discordDelivery.count({
        where: { status: { in: ["PENDING", "FAILED"] } },
      }),
    ]);
  return { activeUsers, upcomingRaces, openTickets, pendingDeliveries };
}

async function executeJob(
  type: AutomationJobType,
): Promise<Prisma.InputJsonValue> {
  switch (type) {
    case AutomationJobType.AttendanceReminders:
      await generateAttendanceNotifications();
      return { generated: true };
    case AutomationJobType.UpcomingRaceReminders:
      return upcomingRaceReminders();
    case AutomationJobType.ChampionshipVerification:
      return verifyChampionships();
    case AutomationJobType.NotificationCleanup:
      return cleanupNotifications();
    case AutomationJobType.EmailQueue:
      return processEmailOutbox();
    case AutomationJobType.DiscordQueue:
      return processDiscordOutbox();
    case AutomationJobType.MysteryRacePublication:
      return publishMysteryRaces();
    case AutomationJobType.StatisticsRefresh:
      return refreshStatistics();
    case AutomationJobType.AnnouncementPublication:
      return publishDueAnnouncements();
    case AutomationJobType.DiscordRoleSync:
      return synchronizeDiscordRoles();
  }
}

export async function runDueAutomationJobs(
  limit = 10,
): Promise<{ completed: number; failed: number }> {
  await ensureAutomationJobs();
  const prisma = getPrismaClient();
  const now = new Date();
  await prisma.automationJob.updateMany({
    where: {
      status: PrismaJobStatus.RUNNING,
      lockedAt: { lt: new Date(now.getTime() - 30 * 60 * 1000) },
    },
    data: {
      status: PrismaJobStatus.FAILED,
      lockedAt: null,
      lastError: "Interrupted job recovered by automation runner.",
      nextRunAt: now,
    },
  });
  const jobs = await prisma.automationJob.findMany({
    where: {
      enabled: true,
      status: {
        in: [PrismaJobStatus.SCHEDULED, PrismaJobStatus.FAILED, PrismaJobStatus.COMPLETED],
      },
      nextRunAt: { lte: now },
    },
    orderBy: [{ nextRunAt: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 25),
  });
  let completed = 0;
  let failed = 0;

  for (const job of jobs) {
    const claimed = await prisma.automationJob.updateMany({
      where: {
        id: job.id,
        enabled: true,
        status: { not: PrismaJobStatus.RUNNING },
      },
      data: {
        status: PrismaJobStatus.RUNNING,
        lockedAt: new Date(),
        attempts: { increment: 1 },
      },
    });
    if (claimed.count === 0) continue;

    const run = await prisma.automationJobRun.create({
      data: { jobId: job.id, status: PrismaJobStatus.RUNNING },
    });
    try {
      const result = await executeJob(job.type as AutomationJobType);
      const finishedAt = new Date();
      await prisma.$transaction([
        prisma.automationJobRun.update({
          where: { id: run.id },
          data: {
            status: PrismaJobStatus.COMPLETED,
            finishedAt,
            result,
          },
        }),
        prisma.automationJob.update({
          where: { id: job.id },
          data: {
            status: PrismaJobStatus.COMPLETED,
            lockedAt: null,
            lastRunAt: finishedAt,
            nextRunAt: new Date(
              finishedAt.getTime() + job.intervalMinutes * 60 * 1000,
            ),
            lastError: null,
            lastResult: result,
            attempts: 0,
          },
        }),
      ]);
      completed += 1;
    } catch (error: unknown) {
      const message =
        error instanceof Error ? error.message.slice(0, 2000) : String(error);
      const finishedAt = new Date();
      await prisma.$transaction([
        prisma.automationJobRun.update({
          where: { id: run.id },
          data: {
            status: PrismaJobStatus.FAILED,
            finishedAt,
            error: message,
          },
        }),
        prisma.automationJob.update({
          where: { id: job.id },
          data: {
            status: PrismaJobStatus.FAILED,
            lockedAt: null,
            lastRunAt: finishedAt,
            nextRunAt: new Date(
              finishedAt.getTime() +
                Math.min(360, 2 ** (job.attempts + 1)) * 60 * 1000,
            ),
            lastError: message,
          },
        }),
      ]);
      logger.error("Automation job failed", error, {
        jobId: job.id,
        jobType: job.type,
      });
      failed += 1;
    }
  }
  return { completed, failed };
}
