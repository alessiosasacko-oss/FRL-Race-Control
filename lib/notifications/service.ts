import "server-only";
import {
  EmailDeliveryStatus as PrismaEmailDeliveryStatus,
  NotificationPriority as PrismaNotificationPriority,
  NotificationType as PrismaNotificationType,
  Role as PrismaRole,
  type Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  NotificationPriority,
  type NotificationType,
} from "@/domain";
import { zonedLocalToUtc } from "@/lib/master-data/timezone";
import { renderNotificationEmail } from "@/lib/email/templates";
import type { NotificationPayload } from "./types";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

function categoryEnabled(
  categories: readonly string[],
  type: NotificationType,
): boolean {
  return categories.includes(type);
}

function zonedParts(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value);

  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour: get("hour"),
    minute: get("minute"),
  };
}

function nextDeliveryTime(
  now: Date,
  settings: {
    quietHoursEnabled: boolean;
    quietHoursStartMinute: number | null;
    quietHoursEndMinute: number | null;
    timezone: string;
  },
): Date {
  const { quietHoursStartMinute: start, quietHoursEndMinute: end } =
    settings;
  if (
    !settings.quietHoursEnabled ||
    start === null ||
    end === null ||
    start === end
  ) {
    return now;
  }

  const local = zonedParts(now, settings.timezone);
  const minute = local.hour * 60 + local.minute;
  const inQuietHours =
    start < end
      ? minute >= start && minute < end
      : minute >= start || minute < end;
  if (!inQuietHours) return now;

  const endHour = Math.floor(end / 60);
  const endMinute = end % 60;
  const nextDay = start > end && minute >= start;
  const localDate = new Date(
    Date.UTC(local.year, local.month - 1, local.day + (nextDay ? 1 : 0)),
  );
  const pad = (value: number) => String(value).padStart(2, "0");
  const localEnd = `${localDate.getUTCFullYear()}-${pad(
    localDate.getUTCMonth() + 1,
  )}-${pad(localDate.getUTCDate())}T${pad(endHour)}:${pad(endMinute)}`;

  try {
    return zonedLocalToUtc(localEnd, settings.timezone);
  } catch {
    return new Date(now.getTime() + 60 * 60 * 1000);
  }
}

export async function createNotifications(
  database: DatabaseClient,
  recipientIds: readonly number[],
  payload: NotificationPayload,
  options: { allowEmail?: boolean } = {},
): Promise<void> {
  const uniqueRecipientIds = [...new Set(recipientIds)];
  if (uniqueRecipientIds.length === 0) return;

  const users = await database.user.findMany({
    where: { id: { in: uniqueRecipientIds }, active: true },
    include: { settings: true },
  });
  const priority =
    payload.priority ?? NotificationPriority.Normal;

  for (const user of users) {
    const settings = user.settings;
    const inAppEnabled =
      (settings?.inAppEnabled ?? true) &&
      (settings
        ? categoryEnabled(settings.inAppCategories, payload.type)
        : true);
    const emailEnabled =
      Boolean(user.email) &&
      options.allowEmail !== false &&
      settings?.emailEnabled === true &&
      categoryEnabled(settings.emailCategories, payload.type);

    let notificationId: number | null = null;
    if (inAppEnabled) {
      const notification = await database.notification.upsert({
        where: {
          dedupeKey: payload.dedupeKey
            ? `${payload.dedupeKey}:${user.id}`
            : `runtime:${crypto.randomUUID()}`,
        },
        update: {},
        create: {
          userId: user.id,
          type: payload.type as PrismaNotificationType,
          priority: priority as PrismaNotificationPriority,
          title: payload.title,
          message: payload.message,
          href: payload.href ?? null,
          relatedEntityType: payload.relatedEntity?.type,
          relatedEntityId: payload.relatedEntity?.id,
          dedupeKey: payload.dedupeKey
            ? `${payload.dedupeKey}:${user.id}`
            : null,
        },
        select: { id: true },
      });
      notificationId = notification.id;
    }

    if (emailEnabled && user.email) {
      const scheduledFor = nextDeliveryTime(
        new Date(),
        settings ?? {
          quietHoursEnabled: false,
          quietHoursStartMinute: null,
          quietHoursEndMinute: null,
          timezone: "Europe/Berlin",
        },
      );
      const data = {
        userId: user.id,
        recipient: user.email,
        subject: `[FRL] ${payload.title}`,
        html: renderNotificationEmail({
          displayName: user.displayName,
          type: payload.type,
          priority,
          title: payload.title,
          message: payload.message,
          href: payload.href,
        }),
        status: PrismaEmailDeliveryStatus.PENDING,
        scheduledFor,
      };

      if (notificationId) {
        await database.emailDelivery.upsert({
          where: { notificationId },
          update: {},
          create: { ...data, notificationId },
        });
      } else {
        await database.emailDelivery.create({ data });
      }
    }
  }
}

export async function activeUserIds(
  database: DatabaseClient,
): Promise<number[]> {
  const users = await database.user.findMany({
    where: { active: true },
    select: { id: true },
  });
  return users.map((user) => user.id);
}

export async function leagueUserIds(
  database: DatabaseClient,
  leagueId: number,
): Promise<number[]> {
  const users = await database.user.findMany({
    where: {
      active: true,
      OR: [
        { driver: { leagueId } },
        { principalTeams: { some: { leagueId } } },
        {
          roles: {
            hasSome: [
              PrismaRole.SUPER_ADMIN,
              PrismaRole.ADMIN,
              PrismaRole.FIA_PRESIDENT,
              PrismaRole.STEWARD,
            ],
          },
        },
      ],
    },
    select: { id: true },
  });
  return users.map((user) => user.id);
}
