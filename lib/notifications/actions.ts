"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";

const notificationIdSchema = z.number().int().positive();

async function revalidateNotifications(): Promise<void> {
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  await touchAppDataRevisionSafely(getPrismaClient(), ["notifications"]);
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
  await revalidateNotifications();
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
  await revalidateNotifications();
  redirect(notification.href ?? "/notifications");
}

export async function markAllNotificationsReadAction(): Promise<void> {
  const user = await requireAuthenticatedUser();
  await getPrismaClient().notification.updateMany({
    where: { userId: user.id, readAt: null, archivedAt: null },
    data: { readAt: new Date() },
  });
  await revalidateNotifications();
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
  await revalidateNotifications();
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
  await revalidateNotifications();
}
