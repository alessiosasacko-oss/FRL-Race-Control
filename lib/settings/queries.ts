import "server-only";
import type {
  NotificationType,
  Role,
} from "@/domain";
import { NotificationType as NotificationTypeValues } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import type { SettingsPageData } from "./types";

function minuteToTime(value: number | null): string {
  if (value === null) return "";
  const hours = Math.floor(value / 60);
  const minutes = value % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(
    2,
    "0",
  )}`;
}

export async function getSettingsPageData(
  userId: number,
): Promise<SettingsPageData> {
  const user = await getPrismaClient().user.findUnique({
    where: { id: userId },
    include: {
      settings: true,
      accounts: {
        where: { provider: "discord" },
        select: { providerAccountId: true },
        take: 1,
      },
      driver: {
        include: {
          team: { select: { name: true } },
          league: { select: { name: true, code: true } },
        },
      },
    },
  });
  if (!user) throw new Error("USER_NOT_FOUND");

  return {
    user: {
      displayName: user.displayName,
      email: user.email,
      avatarUrl: user.avatarUrl,
      discordId:
        user.discordId ?? user.accounts[0]?.providerAccountId ?? null,
      roles: user.roles as Role[],
    },
    driver: user.driver
      ? {
          id: user.driver.id,
          name: user.driver.name,
          number: user.driver.number,
          flag: user.driver.flag,
          team: user.driver.team?.name ?? null,
          league: user.driver.league.code,
        }
      : null,
    settings: {
      inAppEnabled: user.settings?.inAppEnabled ?? true,
      inAppCategories:
        user.settings
          ? (user.settings.inAppCategories as NotificationType[])
          : Object.values(NotificationTypeValues),
      emailEnabled: user.settings?.emailEnabled ?? false,
      emailCategories:
        user.settings
          ? (user.settings.emailCategories as NotificationType[])
          : Object.values(NotificationTypeValues),
      quietHoursEnabled:
        user.settings?.quietHoursEnabled ?? false,
      quietHoursStart: minuteToTime(
        user.settings?.quietHoursStartMinute ?? null,
      ),
      quietHoursEnd: minuteToTime(
        user.settings?.quietHoursEndMinute ?? null,
      ),
      timezone: user.settings?.timezone ?? "Europe/Berlin",
      theme: "dark",
      language: "de",
    },
  };
}
