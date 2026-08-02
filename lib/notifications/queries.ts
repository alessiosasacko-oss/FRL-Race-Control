import "server-only";
import { cache } from "react";
import {
  NotificationPriority,
  NotificationType,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { notificationListQuerySchema } from "./schemas";
import type {
  NotificationItem,
  NotificationListQuery,
  NotificationPageData,
} from "./types";

const PAGE_SIZE = 20;

export function parseNotificationListQuery(
  input: Record<string, string | string[] | undefined>,
): NotificationListQuery {
  return notificationListQuerySchema.parse(input);
}

function mapNotification(notification: {
  id: number;
  type: string;
  priority: string;
  title: string;
  message: string;
  href: string | null;
  readAt: Date | null;
  archivedAt: Date | null;
  createdAt: Date;
}): NotificationItem {
  return {
    ...notification,
    type: notification.type as NotificationType,
    priority: notification.priority as NotificationPriority,
    readAt: notification.readAt?.toISOString() ?? null,
    archivedAt: notification.archivedAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  };
}

export async function getNotificationPageData(
  userId: number,
  query: NotificationListQuery,
): Promise<NotificationPageData> {
  const prisma = getPrismaClient();
  const stateWhere =
    query.state === "archived"
      ? { archivedAt: { not: null } }
      : query.state === "unread"
        ? { archivedAt: null, readAt: null }
        : query.state === "read"
          ? { archivedAt: null, readAt: { not: null } }
          : { archivedAt: null };
  const where = {
    userId,
    ...stateWhere,
    type: query.type,
    priority: query.priority,
    OR: query.q
      ? [
          { title: { contains: query.q, mode: "insensitive" as const } },
          {
            message: {
              contains: query.q,
              mode: "insensitive" as const,
            },
          },
        ]
      : undefined,
  };
  const [total, unreadCount] = await prisma.$transaction([
    prisma.notification.count({ where }),
    prisma.notification.count({
      where: { userId, readAt: null, archivedAt: null },
    }),
  ]);
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const page = Math.min(query.page, pageCount);
  const items = await prisma.notification.findMany({
    where,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      type: true,
      priority: true,
      title: true,
      message: true,
      href: true,
      readAt: true,
      archivedAt: true,
      createdAt: true,
    },
  });

  return {
    items: items.map(mapNotification),
    total,
    page,
    pageCount,
    unreadCount,
  };
}

export async function getRecentNotifications(
  userId: number,
  take = 5,
): Promise<NotificationItem[]> {
  const notifications = await getPrismaClient().notification.findMany({
    where: { userId, archivedAt: null },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take,
    select: {
      id: true,
      type: true,
      priority: true,
      title: true,
      message: true,
      href: true,
      readAt: true,
      archivedAt: true,
      createdAt: true,
    },
  });
  return notifications.map(mapNotification);
}

export const getUnreadNotificationCount = cache(async function getUnreadNotificationCount(
  userId: number,
): Promise<number> {
  return getPrismaClient().notification.count({
    where: { userId, readAt: null, archivedAt: null },
  });
});
