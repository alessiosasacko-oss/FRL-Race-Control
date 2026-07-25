"use server";

import { revalidatePath } from "next/cache";
import { NotificationType as PrismaNotificationType } from "@/generated/prisma/client";
import { WebhookEventType } from "@/domain";
import { requireAuthenticatedUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { recordWebhookEvent } from "@/lib/integrations/events";
import {
  notificationSettingsSchema,
  profileSettingsSchema,
} from "@/lib/notifications/schemas";
import type { SettingsActionState } from "./types";

function errorState(
  message: string,
  fieldErrors?: Record<string, string[]>,
): SettingsActionState {
  return { status: "error", message, fieldErrors };
}

function validationState(result: {
  error: { flatten: () => { fieldErrors: unknown } };
}): SettingsActionState {
  return errorState(
    "Bitte prüfe die markierten Angaben.",
    result.error.flatten().fieldErrors as Record<string, string[]>,
  );
}

function timeToMinute(value: string | null): number | null {
  if (!value) return null;
  const [hours, minutes] = value.split(":").map(Number);
  return hours * 60 + minutes;
}

function validTimezone(timezone: string): boolean {
  try {
    new Intl.DateTimeFormat("de-DE", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

function revalidateUserExperience(): void {
  revalidatePath("/settings");
  revalidatePath("/profile");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
}

export async function updateProfileSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireAuthenticatedUser();
  const parsed = profileSettingsSchema.safeParse({
    displayName: formData.get("displayName"),
    flag: formData.get("flag"),
    driverNumber: formData.get("driverNumber"),
  });
  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();
  const driver = await prisma.driver.findUnique({
    where: { userId: user.id },
    select: { id: true },
  });
  if (
    driver &&
    (parsed.data.flag === null ||
      parsed.data.driverNumber === null)
  ) {
    return errorState("Flagge und Fahrernummer werden benötigt.");
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const updatedUser = await transaction.user.update({
        where: { id: user.id },
        data: { displayName: parsed.data.displayName },
      });
      if (driver) {
        await transaction.driver.update({
          where: { id: driver.id },
          data: {
            name: parsed.data.displayName,
            flag: parsed.data.flag as string,
            number: parsed.data.driverNumber as number,
          },
        });
      }
      await recordWebhookEvent(transaction, {
        type: WebhookEventType.UserUpdated,
        source: "settings-action",
        dedupeKey: `user-updated:${user.id}:${updatedUser.updatedAt.getTime()}`,
        payload: {
          userId: user.id,
          driverId: driver?.id ?? null,
          fields: ["displayName", ...(driver ? ["driver"] : [])],
        },
      });
    });
  } catch {
    return errorState(
      "Das Profil konnte nicht gespeichert werden. Die Fahrernummer ist möglicherweise bereits vergeben.",
    );
  }

  revalidateUserExperience();
  return { status: "success", message: "Profil gespeichert." };
}

export async function updateNotificationSettingsAction(
  _previousState: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const user = await requireAuthenticatedUser();
  const parsed = notificationSettingsSchema.safeParse({
    inAppEnabled: formData.get("inAppEnabled") === "on",
    inAppCategories: formData.getAll("inAppCategory"),
    emailEnabled: formData.get("emailEnabled") === "on",
    emailCategories: formData.getAll("emailCategory"),
    quietHoursEnabled: formData.get("quietHoursEnabled") === "on",
    quietHoursStart: formData.get("quietHoursStart"),
    quietHoursEnd: formData.get("quietHoursEnd"),
    timezone: formData.get("timezone"),
    theme: formData.get("theme"),
    language: formData.get("language"),
  });
  if (!parsed.success) return validationState(parsed);
  if (!validTimezone(parsed.data.timezone)) {
    return errorState("Die Zeitzone ist ungültig.", {
      timezone: ["Bitte eine gültige IANA-Zeitzone angeben."],
    });
  }

  try {
    await getPrismaClient().userSettings.upsert({
      where: { userId: user.id },
      update: {
        inAppEnabled: parsed.data.inAppEnabled,
        inAppCategories:
          parsed.data.inAppCategories as PrismaNotificationType[],
        emailEnabled: parsed.data.emailEnabled,
        emailCategories:
          parsed.data.emailCategories as PrismaNotificationType[],
        quietHoursEnabled: parsed.data.quietHoursEnabled,
        quietHoursStartMinute: timeToMinute(
          parsed.data.quietHoursStart,
        ),
        quietHoursEndMinute: timeToMinute(
          parsed.data.quietHoursEnd,
        ),
        timezone: parsed.data.timezone,
        theme: parsed.data.theme,
        language: parsed.data.language,
      },
      create: {
        userId: user.id,
        inAppEnabled: parsed.data.inAppEnabled,
        inAppCategories:
          parsed.data.inAppCategories as PrismaNotificationType[],
        emailEnabled: parsed.data.emailEnabled,
        emailCategories:
          parsed.data.emailCategories as PrismaNotificationType[],
        quietHoursEnabled: parsed.data.quietHoursEnabled,
        quietHoursStartMinute: timeToMinute(
          parsed.data.quietHoursStart,
        ),
        quietHoursEndMinute: timeToMinute(
          parsed.data.quietHoursEnd,
        ),
        timezone: parsed.data.timezone,
        theme: parsed.data.theme,
        language: parsed.data.language,
      },
    });
  } catch {
    return errorState(
      "Die Benachrichtigungseinstellungen konnten nicht gespeichert werden.",
    );
  }

  revalidateUserExperience();
  return {
    status: "success",
    message: "Benachrichtigungseinstellungen gespeichert.",
  };
}
