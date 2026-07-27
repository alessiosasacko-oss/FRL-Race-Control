import "server-only";
import {
  NotificationPriority,
  NotificationType,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { publicRaceTrack } from "@/lib/races/visibility";
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
  const schedules = await prisma.raceLeagueSchedule.findMany({
    where: {
      attendanceDeadline: { not: null, gte: recentPast },
      scheduledAt: { gte: recentPast },
    },
    include: {
      league: {
        include: {
          drivers: {
            where: {
              active: true,
              userId: { not: null },
            },
            select: {
              userId: true,
              team: { select: { seasonId: true } },
            },
          },
        },
      },
      race: {
        include: {
          season: { select: { id: true, name: true } },
        },
      },
    },
  });

  await prisma.$transaction(async (transaction) => {
    for (const schedule of schedules) {
      const race = schedule.race;
      const league = schedule.league;
      const deadline = schedule.attendanceDeadline;
      if (!deadline) continue;
      const track = publicRaceTrack(race, now);
      const recipients = league.drivers
        .filter((driver) => driver.team?.seasonId === race.season.id)
        .flatMap((driver) =>
          driver.userId === null ? [] : [driver.userId],
        );
      if (recipients.length === 0) continue;

      const base = {
        href: `/attendance?raceId=${race.id}&leagueId=${league.id}`,
        relatedEntity: { type: "Race", id: race.id },
      };
      const context = {
        leagueId: league.id,
        discordContext: {
          league: league.name,
          season: race.season.name,
          race: track.name,
          track: track.circuit ?? "Mystery Track",
        },
      };

      if (deadline > now) {
        await createNotifications(
          transaction,
          recipients,
          {
            ...base,
            type: NotificationType.AttendanceOpen,
            title: `Rennanmeldung für Runde ${race.round} geöffnet`,
            message: `Du kannst deine Teilnahme bis ${new Intl.DateTimeFormat(
              "de-DE",
              {
                dateStyle: "medium",
                timeStyle: "short",
                timeZone: schedule.timezone,
              },
            ).format(deadline)} bestätigen.`,
            dedupeKey: `attendance-open:${race.id}:${league.id}`,
          },
          context,
        );
      }

      if (deadline > now && deadline <= inTwentyFourHours) {
        await createNotifications(
          transaction,
          recipients,
          {
            ...base,
            type: NotificationType.AttendanceClosingSoon,
            priority: NotificationPriority.High,
            title: `Anmeldeschluss für Runde ${race.round} naht`,
            message: "Die Rennanmeldung schließt in weniger als 24 Stunden.",
            dedupeKey: `attendance-closing:${race.id}:${league.id}`,
          },
          context,
        );
      }

      if (deadline <= now) {
        await createNotifications(
          transaction,
          recipients,
          {
            ...base,
            type: NotificationType.AttendanceClosed,
            title: `Rennanmeldung für Runde ${race.round} geschlossen`,
            message: "Der reguläre Anmeldezeitraum ist beendet.",
            dedupeKey: `attendance-closed:${race.id}:${league.id}`,
          },
          context,
        );
      }
    }
  });
}
