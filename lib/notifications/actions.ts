"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { NotificationType } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import {
  requireAuthenticatedUser,
  requirePermission,
} from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { announcementSchema } from "./schemas";
import {
  activeUserIds,
  createNotifications,
} from "./service";
import type { NotificationActionState } from "./types";

const notificationIdSchema = z.number().int().positive();

function revalidateNotifications(): void {
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
}

export async function markNotificationReadAction(
  notificationIdInput: number,
): Promise<void> {
  const user = await requireAuthenticatedUser();
  const notificationId =
    notificationIdSchema.safeParse(notificationIdInput);
  if (!notificationId.success) return;
  await getPrismaClient().notification.updateMany({
    where: { id: notificationId.data, userId: user.id },
    data: { readAt: new Date() },
  });
  revalidateNotifications();
}

export async function openNotificationAction(
  notificationIdInput: number,
): Promise<never> {
  const user = await requireAuthenticatedUser();
  const notificationId =
    notificationIdSchema.safeParse(notificationIdInput);
  if (!notificationId.success) redirect("/notifications");
  const notification = await getPrismaClient().notification.findFirst({
    where: { id: notificationId.data, userId: user.id },
    select: { href: true },
  });
  if (!notification) redirect("/notifications");

  await getPrismaClient().notification.update({
    where: { id: notificationId.data },
    data: { readAt: new Date() },
  });
  revalidateNotifications();
  redirect(notification.href ?? "/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  await getPrismaClient().notification.updateMany({
    where: { userId: user.id, readAt: null, archivedAt: null },
    data: { readAt: new Date() },
  });
  revalidateNotifications();
}

export async function archiveNotificationAction(
  notificationIdInput: number,
): Promise<void> {
  const user = await requireAuthenticatedUser();
  const notificationId =
    notificationIdSchema.safeParse(notificationIdInput);
  if (!notificationId.success) return;
  await getPrismaClient().notification.updateMany({
    where: { id: notificationId.data, userId: user.id },
    data: { archivedAt: new Date(), readAt: new Date() },
  });
  revalidateNotifications();
}

export async function deleteNotificationAction(
  notificationIdInput: number,
): Promise<void> {
  const user = await requireAuthenticatedUser();
  const notificationId =
    notificationIdSchema.safeParse(notificationIdInput);
  if (!notificationId.success) return;
  await getPrismaClient().notification.deleteMany({
    where: { id: notificationId.data, userId: user.id },
  });
  revalidateNotifications();
}

export async function createAdminAnnouncementAction(
  _previousState: NotificationActionState,
  formData: FormData,
): Promise<NotificationActionState> {
  const actor = await requirePermission(
    Permission.ManageAdministration,
  );
  const parsed = announcementSchema.safeParse({
    title: formData.get("title"),
    message: formData.get("message"),
    href: formData.get("href"),
    priority: formData.get("priority"),
    type:
      formData.get("type") ??
      NotificationType.AdminAnnouncement,
    email: formData.get("email") === "on",
  });
  if (!parsed.success) {
    return {
      status: "error",
      message: "Bitte prüfe die Mitteilung.",
      fieldErrors: parsed.error.flatten().fieldErrors as Record<
        string,
        string[]
      >,
    };
  }

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      const recipients = await activeUserIds(transaction);
      await createNotifications(
        transaction,
        recipients,
        {
          type: parsed.data.type,
          priority: parsed.data.priority,
          title: parsed.data.title,
          message: parsed.data.message,
          href: parsed.data.href,
          relatedEntity: { type: "User", id: actor.id },
        },
        { allowEmail: parsed.data.email },
      );
    });
  } catch {
    return {
      status: "error",
      message: "Die Mitteilung konnte nicht veröffentlicht werden.",
    };
  }

  revalidateNotifications();
  return {
    status: "success",
    message: "Die Mitteilung wurde veröffentlicht.",
  };
}
