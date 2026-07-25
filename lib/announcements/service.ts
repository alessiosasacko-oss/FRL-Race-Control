import "server-only";
import {
  AnnouncementStatus,
  AnnouncementTarget,
  DiscordChannelPurpose,
  NotificationType,
} from "@/domain";
import {
  AnnouncementStatus as PrismaAnnouncementStatus,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import { enqueueDiscordDelivery } from "@/lib/discord/outbox";
import {
  activeUserIds,
  createNotifications,
} from "@/lib/notifications/service";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function includesTarget(
  target: AnnouncementTarget,
  channel: AnnouncementTarget,
): boolean {
  return target === AnnouncementTarget.All || target === channel;
}

export async function publishAnnouncement(
  database: DatabaseClient,
  announcementId: number,
): Promise<void> {
  const announcement = await database.announcement.findUnique({
    where: { id: announcementId },
  });
  if (
    !announcement ||
    announcement.status !== PrismaAnnouncementStatus.SCHEDULED ||
    announcement.scheduledFor > new Date()
  ) {
    return;
  }

  const target = announcement.target as AnnouncementTarget;
  const app = includesTarget(target, AnnouncementTarget.App);
  const email = includesTarget(target, AnnouncementTarget.Email);
  const discord = includesTarget(target, AnnouncementTarget.Discord);

  if (app || email) {
    const recipients = await activeUserIds(database);
    await createNotifications(
      database,
      recipients,
      {
        type: NotificationType.AdminAnnouncement,
        priority: announcement.priority as import("@/domain").NotificationPriority,
        title: announcement.title,
        message: announcement.content,
        href: announcement.href,
        relatedEntity: { type: "Announcement", id: announcement.id },
        dedupeKey: `announcement:${announcement.id}`,
      },
      {
        inApp: app,
        allowEmail: email,
        allowDiscord: false,
      },
    );
  }

  if (discord) {
    await enqueueDiscordDelivery(database, {
      purpose: DiscordChannelPurpose.AdminAnnouncement,
      announcementId: announcement.id,
      payload: {
        title: announcement.title,
        description: announcement.content,
        href: announcement.href,
        color:
          announcement.priority === "URGENT"
            ? "#DC2626"
            : announcement.priority === "HIGH"
              ? "#F59E0B"
              : "#2563EB",
        fields: announcement.pinned
          ? [{ name: "Hinweis", value: "Angepinnte Mitteilung" }]
          : undefined,
      },
      dedupeKey: `announcement:${announcement.id}`,
    });
  }

  await database.announcement.update({
    where: { id: announcement.id },
    data: {
      status: AnnouncementStatus.Published,
      publishedAt: new Date(),
      lastError: null,
    },
  });
}

export async function publishDueAnnouncements(
  limit = 25,
): Promise<{ published: number; failed: number }> {
  const database = (await import("@/lib/db/prisma")).getPrismaClient();
  const due = await database.announcement.findMany({
    where: {
      status: PrismaAnnouncementStatus.SCHEDULED,
      scheduledFor: { lte: new Date() },
    },
    orderBy: [{ scheduledFor: "asc" }, { id: "asc" }],
    take: Math.min(Math.max(limit, 1), 100),
    select: { id: true },
  });
  let published = 0;
  let failed = 0;

  for (const announcement of due) {
    try {
      await database.$transaction((transaction) =>
        publishAnnouncement(transaction, announcement.id),
      );
      published += 1;
    } catch (error: unknown) {
      failed += 1;
      await database.announcement.update({
        where: { id: announcement.id },
        data: {
          status: PrismaAnnouncementStatus.FAILED,
          lastError:
            error instanceof Error ? error.message.slice(0, 2000) : String(error),
        },
      });
    }
  }
  return { published, failed };
}
