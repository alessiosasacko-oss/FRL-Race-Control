import "server-only";
import {
  NotificationPriority,
  NotificationType,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { createNotifications } from "./service";

export async function generateAttendanceNotifications(): Promise<void> {
  const prisma = getPrismaClient();
  const now = new Date();
  const inTwentyFourHours = new Date(
    now.getTime() + 24 * 60 * 60 * 1000,
  );
  const recentPast = new Date(
    now.getTime() - 30 * 24 * 60 * 60 * 1000,
  );
  const races = await prisma.race.findMany({
    where: {
      attendanceDeadline: { not: null, gte: recentPast },
      scheduledAt: { gte: recentPast },
    },
    include: {
      season: {
        include: {
          league: {
            include: {
              drivers: {
                where: {
                  active: true,
                  userId: { not: null },
                },
                select: { userId: true, team: { select: { seasonId: true } } },
              },
            },
          },
        },
      },
    },
  });

  await prisma.$transaction(async (transaction) => {
    for (const race of races) {
      const recipients = race.season.league.drivers
        .filter((driver) => driver.team?.seasonId === race.seasonId)
        .flatMap((driver) =>
          driver.userId === null ? [] : [driver.userId],
        );
      if (recipients.length === 0 || !race.attendanceDeadline) continue;

      const base = {
        href: `/attendance?raceId=${race.id}`,
        relatedEntity: { type: "Race", id: race.id },
      };
      if (race.attendanceDeadline > now) {
        await createNotifications(
          transaction,
          recipients,
          {
            ...base,
            type: NotificationType.AttendanceOpen,
            title: `Rennanmeldung für Runde ${race.round} geöffnet`,
            message: `Du kannst deine Teilnahme bis ${new Intl.DateTimeFormat(
              "de-DE",
              { dateStyle: "medium", timeStyle: "short" },
            ).format(race.attendanceDeadline)} bestätigen.`,
            dedupeKey: `attendance-open:${race.id}`,
          },
          {
            leagueId: race.season.leagueId,
            discordContext: {
              league: race.season.league.name,
              season: race.season.name,
              race: race.mystery ? "Mystery Race" : race.name,
              track: race.mystery ? "Noch geheim" : race.circuit,
            },
          },
        );
      }

      if (
        race.attendanceDeadline > now &&
        race.attendanceDeadline <= inTwentyFourHours
      ) {
        await createNotifications(
          transaction,
          recipients,
          {
            ...base,
            type: NotificationType.AttendanceClosingSoon,
            priority: NotificationPriority.High,
            title: `Anmeldeschluss für Runde ${race.round} naht`,
            message: "Die Rennanmeldung schließt in weniger als 24 Stunden.",
            dedupeKey: `attendance-closing:${race.id}`,
          },
          {
            leagueId: race.season.leagueId,
            discordContext: {
              league: race.season.league.name,
              season: race.season.name,
              race: race.mystery ? "Mystery Race" : race.name,
              track: race.mystery ? "Noch geheim" : race.circuit,
            },
          },
        );
      }
      if (race.attendanceDeadline <= now) {
        await createNotifications(
          transaction,
          recipients,
          {
            ...base,
            type: NotificationType.AttendanceClosed,
            title: `Rennanmeldung für Runde ${race.round} geschlossen`,
            message: "Der reguläre Anmeldezeitraum ist beendet.",
            dedupeKey: `attendance-closed:${race.id}`,
          },
          {
            leagueId: race.season.leagueId,
            discordContext: {
              league: race.season.league.name,
              season: race.season.name,
              race: race.mystery ? "Mystery Race" : race.name,
              track: race.mystery ? "Noch geheim" : race.circuit,
            },
          },
        );
      }
    }
  });
}
