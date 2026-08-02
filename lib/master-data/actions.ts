"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import {
  type Prisma,
  ChampionshipAuditAction as PrismaChampionshipAuditAction,
  RaceSession as PrismaRaceSession,
  RaceStatus as PrismaRaceStatus,
} from "@/generated/prisma/client";
import {
  DiscordChannelPurpose,
  DriverLineupStatus,
  NotificationType,
  RaceSession,
} from "@/domain";
import { enqueueDiscordDelivery } from "@/lib/discord/outbox";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { recalculateChampionship } from "@/lib/championship/recalculation";
import { synchronizeGlobalTeamPrincipalChampionship } from "@/lib/championship/team-principal-championship";
import {
  createNotifications,
  leagueUserIds,
} from "@/lib/notifications/service";
import {
  driverSchema,
  entityIdSchema,
  leagueUpdateSchema,
  raceDeadlineOverrideSchema,
  raceSchema,
  seasonSchema,
  teamArchiveSchema,
  teamDeleteSchema,
  teamRestoreSchema,
  teamSchema,
  teamOrganizationSchema,
} from "./schemas";
import { zonedLocalToUtc } from "./timezone";
import { publicRaceTrack } from "@/lib/races/visibility";
import { calculateLeagueRaceSchedule } from "@/lib/races/scheduling";
import { writeSystemAudit } from "@/lib/audit/system";
import { getTeamDependencySnapshot } from "./team-dependencies";
import {
  canPermanentlyDeleteTeam,
  teamDeleteConfirmationMatches,
  teamDependencyMessages,
} from "./team-lifecycle";
import type { MasterDataActionState } from "./types";
import { ensureInternalTeamSlot } from "./internal-team-slots";

function errorState(
  message: string,
  fieldErrors?: Record<string, string[]>,
): MasterDataActionState {
  return { status: "error", message, fieldErrors };
}

function successState(message: string): MasterDataActionState {
  return { status: "success", message };
}

function validationState(
  result: { error: { flatten: () => { fieldErrors: unknown } } },
): MasterDataActionState {
  return errorState(
    "Bitte prüfe die markierten Angaben.",
    result.error.flatten().fieldErrors as Record<string, string[]>,
  );
}

function databaseError(): MasterDataActionState {
  return errorState(
    "Die Änderung konnte nicht gespeichert werden. Prüfe eindeutige Namen, Kürzel, Startnummern und Verknüpfungen.",
  );
}

async function revalidateMasterData(): Promise<void> {
  revalidatePath("/admin");
  revalidatePath("/admin/leagues");
  revalidatePath("/admin/seasons");
  revalidatePath("/admin/races");
  revalidatePath("/admin/drivers");
  revalidatePath("/admin/teams");
  revalidatePath("/calendar");
  revalidatePath("/attendance");
  revalidatePath("/championship");
  revalidatePath("/championship/team-principals");
  revalidatePath("/results/[id]", "page");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/results");
  revalidatePath("/drivers");
  revalidatePath("/drivers/[id]", "page");
  revalidatePath("/teams");
  revalidatePath("/teams/[id]", "page");
  revalidatePath("/fia");
  revalidatePath("/fia/new");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  await touchAppDataRevisionSafely(getPrismaClient(), [
    "drivers", "teams", "seasons", "leagues", "calendar", "attendance", "results", "championship", "fia", "notifications",
  ]);
}

async function authorize() {
  return requirePermission(Permission.ManageMasterData);
}

export async function updateLeagueAction(
  leagueIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const user = await authorize();
  const leagueId = entityIdSchema.safeParse(leagueIdInput);
  const parsed = leagueUpdateSchema.safeParse({
    name: formData.get("name"),
    description: formData.get("description"),
    currentSeasonId: formData.get("currentSeasonId"),
    active: formData.get("active"),
    raceWeekday: formData.get("raceWeekday"),
    raceStartTime: formData.get("raceStartTime"),
    raceTimezone: formData.get("raceTimezone"),
    defaultAttendanceDeadlineHours: formData.get(
      "defaultAttendanceDeadlineHours",
    ),
    displayOrder: formData.get("displayOrder"),
    updateFutureSchedules: formData.get("updateFutureSchedules"),
    confirmFutureScheduleUpdate: formData.get(
      "confirmFutureScheduleUpdate",
    ),
  });

  if (!leagueId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültige Liga.")
      : validationState(parsed);
  }

  const prisma = getPrismaClient();
  if (
    parsed.data.updateFutureSchedules &&
    !parsed.data.confirmFutureScheduleUpdate
  ) {
    return errorState(
      "Bitte bestätige die Vorschau, bevor bestehende Termine aktualisiert werden.",
    );
  }
  const [startHour, startMinute] = parsed.data.raceStartTime
    .split(":")
    .map(Number);
  const raceStartMinute = startHour * 60 + startMinute;
  const defaultAttendanceDeadlineMinutes =
    parsed.data.defaultAttendanceDeadlineHours === null
      ? null
      : parsed.data.defaultAttendanceDeadlineHours * 60;

  try {
    if (parsed.data.currentSeasonId) {
      const season = await prisma.season.findFirst({
        where: {
          id: parsed.data.currentSeasonId,
          active: true,
          archivedAt: null,
          participatingLeagues: { some: { id: leagueId.data } },
        },
        select: { id: true },
      });

      if (!season) {
        return errorState("Die aktuelle Saison muss zu dieser Liga gehören.");
      }
    }

    await prisma.$transaction(async (transaction) => {
      const previous = await transaction.league.findUniqueOrThrow({
        where: { id: leagueId.data },
      });
      await transaction.league.update({
        where: { id: leagueId.data },
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
          currentSeasonId: parsed.data.currentSeasonId,
          active: parsed.data.active,
          raceWeekday: parsed.data.raceWeekday,
          raceStartMinute,
          raceTimezone: parsed.data.raceTimezone,
          defaultAttendanceDeadlineMinutes,
          displayOrder: parsed.data.displayOrder,
        },
      });

      let updatedScheduleCount = 0;
      if (parsed.data.updateFutureSchedules) {
        const schedules = await transaction.raceLeagueSchedule.findMany({
          where: {
            leagueId: leagueId.data,
            scheduledAt: { gte: new Date() },
            race: { status: { notIn: ["COMPLETED", "CANCELLED"] } },
          },
          include: {
            race: { select: { id: true, weekendDate: true } },
          },
        });
        const affectedRaceIds = new Set<number>();
        for (const schedule of schedules) {
          const calculated = calculateLeagueRaceSchedule(
            schedule.race.weekendDate.toISOString().slice(0, 10),
            {
              raceWeekday: parsed.data.raceWeekday,
              raceStartMinute,
              raceTimezone: parsed.data.raceTimezone,
              defaultAttendanceDeadlineMinutes,
            },
          );
          await transaction.raceLeagueSchedule.update({
            where: { id: schedule.id },
            data: {
              scheduledAt: calculated.scheduledAt,
              timezone: calculated.timezone,
              attendanceDeadline: calculated.attendanceDeadline,
            },
          });
          affectedRaceIds.add(schedule.race.id);
          updatedScheduleCount += 1;
        }

        for (const raceId of affectedRaceIds) {
          const firstSchedule =
            await transaction.raceLeagueSchedule.findFirst({
              where: { raceId },
              orderBy: { scheduledAt: "asc" },
            });
          if (firstSchedule) {
            await transaction.race.update({
              where: { id: raceId },
              data: {
                scheduledAt: firstSchedule.scheduledAt,
                timezone: firstSchedule.timezone,
                attendanceDeadline:
                  firstSchedule.attendanceDeadline,
              },
            });
          }
        }
      }

      await transaction.systemAuditLog.create({
        data: {
          actorId: user.id,
          action: "LEAGUE_RACE_SCHEDULE_UPDATED",
          entityType: "League",
          entityId: leagueId.data,
          metadata: {
            previous: {
              raceWeekday: previous.raceWeekday,
              raceStartMinute: previous.raceStartMinute,
              raceTimezone: previous.raceTimezone,
              defaultAttendanceDeadlineMinutes:
                previous.defaultAttendanceDeadlineMinutes,
              displayOrder: previous.displayOrder,
            },
            next: {
              raceWeekday: parsed.data.raceWeekday,
              raceStartMinute,
              raceTimezone: parsed.data.raceTimezone,
              defaultAttendanceDeadlineMinutes,
              displayOrder: parsed.data.displayOrder,
            },
            updatedScheduleCount,
          },
        },
      });
    });
  } catch {
    return databaseError();
  }

  await revalidateMasterData();
  return successState(
    parsed.data.updateFutureSchedules
      ? "Liga und zukünftige Renntermine wurden aktualisiert."
      : "Liga wurde aktualisiert. Der neue Zeitplan gilt für neue Rennen.",
  );
}

function seasonPayload(formData: FormData) {
  return {
    leagueId: formData.get("leagueId"),
    name: formData.get("name"),
    startsOn: formData.get("startsOn"),
    endsOn: formData.get("endsOn"),
    active: formData.get("active"),
  };
}

export async function createSeasonAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const parsed = seasonSchema.safeParse(seasonPayload(formData));

  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(async (transaction) => {
      const season = await transaction.season.create({
        data: {
          leagueId: parsed.data.leagueId,
          name: parsed.data.name,
          startsOn: new Date(`${parsed.data.startsOn}T00:00:00.000Z`),
          endsOn: new Date(`${parsed.data.endsOn}T00:00:00.000Z`),
          active: parsed.data.active,
          participatingLeagues: {
            connect: await transaction.league.findMany({
              where: { active: true },
              select: { id: true },
            }),
          },
        },
        include: {
          participatingLeagues: {
            where: { active: true },
            orderBy: { code: "asc" },
          },
        },
      });
      for (const league of season.participatingLeagues) {
        const recipients = await leagueUserIds(transaction, league.id);
        await createNotifications(
          transaction,
          recipients,
          {
            type: NotificationType.NewSeason,
            title: `Neue Saison: ${season.name}`,
            message:
              "Eine neue FRL-Saison wurde angelegt und ist in Kalender und Meisterschaft verfügbar.",
            href: `/championship?leagueId=${league.id}&seasonId=${season.id}`,
            relatedEntity: { type: "Season", id: season.id },
            dedupeKey: `new-season:${season.id}:${league.id}`,
          },
          {
            leagueId: league.id,
            discordContext: {
              league: league.name,
              season: season.name,
            },
          },
        );
      }
    });
  } catch {
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Saison wurde erstellt.");
}

export async function updateSeasonAction(
  seasonIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const seasonId = entityIdSchema.safeParse(seasonIdInput);
  const parsed = seasonSchema.safeParse(seasonPayload(formData));

  if (!seasonId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültige Saison.")
      : validationState(parsed);
  }

  const prisma = getPrismaClient();

  try {
    const current = await prisma.season.findUnique({
      where: { id: seasonId.data },
      select: { leagueId: true },
    });

    if (!current) return errorState("Saison wurde nicht gefunden.");

    await prisma.$transaction(async (transaction) => {
      await transaction.season.update({
        where: { id: seasonId.data },
        data: {
          leagueId: parsed.data.leagueId,
          name: parsed.data.name,
          startsOn: new Date(`${parsed.data.startsOn}T00:00:00.000Z`),
          endsOn: new Date(`${parsed.data.endsOn}T00:00:00.000Z`),
          active: parsed.data.active,
          archivedAt: parsed.data.active ? null : undefined,
          participatingLeagues: parsed.data.active
            ? {
                connect: await transaction.league.findMany({
                  where: { active: true },
                  select: { id: true },
                }),
              }
            : undefined,
        },
      });

      if (
        current.leagueId !== parsed.data.leagueId ||
        !parsed.data.active
      ) {
        await transaction.league.updateMany({
          where: { currentSeasonId: seasonId.data },
          data: { currentSeasonId: null },
        });
      }
    });
  } catch {
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Saison wurde aktualisiert.");
}

export async function archiveSeasonAction(
  seasonIdInput: number,
  previousState: MasterDataActionState,
): Promise<MasterDataActionState> {
  void previousState;
  await authorize();
  const seasonId = entityIdSchema.safeParse(seasonIdInput);

  if (!seasonId.success) return errorState("Ungültige Saison.");

  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(async (transaction) => {
      const season = await transaction.season.update({
        where: { id: seasonId.data },
        data: { active: false, archivedAt: new Date() },
        include: {
          participatingLeagues: {
            orderBy: { code: "asc" },
          },
        },
      });
      await transaction.league.updateMany({
        where: { currentSeasonId: seasonId.data },
        data: { currentSeasonId: null },
      });
      for (const league of season.participatingLeagues) {
        await enqueueDiscordDelivery(transaction, {
          purpose: DiscordChannelPurpose.SeasonFinished,
          leagueId: league.id,
          payload: {
            title: `${season.name} beendet`,
            description: "Die Saison wurde abgeschlossen und archiviert.",
            href: `/championship?leagueId=${league.id}&seasonId=${season.id}`,
            league: league.name,
            season: season.name,
          },
          dedupeKey: `season-finished:${season.id}:${league.id}`,
        });
      }
    });
  } catch {
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Saison wurde archiviert.");
}

function racePayload(formData: FormData) {
  return {
    seasonId: formData.get("seasonId"),
    trackId: formData.get("trackId"),
    name: formData.get("name"),
    circuit: formData.get("circuit"),
    countryCode: formData.get("countryCode"),
    round: formData.get("round"),
    weekendDate: formData.get("weekendDate"),
    status: formData.get("status"),
    sprint: formData.get("sprint"),
    doublePoints: formData.get("doublePoints"),
    mystery: formData.get("mystery"),
  };
}

async function validateRaceSeason(
  seasonId: number,
  activeOnly = true,
): Promise<boolean> {
  const prisma = getPrismaClient();
  return Boolean(
    await prisma.season.findFirst({
      where: {
        id: seasonId,
        active: activeOnly ? true : undefined,
        archivedAt: activeOnly ? null : undefined,
        participatingLeagues: { some: { active: true } },
      },
      select: { id: true },
    }),
  );
}

function raceSessions(sprint: boolean): PrismaRaceSession[] {
  return [
    RaceSession.Practice,
    RaceSession.Qualifying,
    ...(sprint ? [RaceSession.Sprint] : []),
    RaceSession.Race,
  ] as PrismaRaceSession[];
}

export async function createRaceAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  const parsed = raceSchema.safeParse(racePayload(formData));

  if (!parsed.success) return validationState(parsed);
  if (!(await validateRaceSeason(parsed.data.seasonId))) {
    return errorState("Die Saison ist für keinen aktiven Ligabetrieb verfügbar.");
  }

  const prisma = getPrismaClient();
  const season = await prisma.season.findUnique({
    where: { id: parsed.data.seasonId },
    include: {
      participatingLeagues: {
        where: { active: true },
        orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      },
    },
  });
  if (!season || season.participatingLeagues.length === 0) {
    return errorState("Für diese Saison sind keine aktiven Ligen verfügbar.");
  }
  let calculatedSchedules: Array<{
    league: (typeof season.participatingLeagues)[number];
    scheduledAt: Date;
    attendanceDeadline: Date | null;
    timezone: string;
  }>;
  try {
    calculatedSchedules = season.participatingLeagues.map((league) => ({
      league,
      ...calculateLeagueRaceSchedule(parsed.data.weekendDate, league),
    }));
  } catch {
    return errorState(
      "Mindestens ein Liga-Zeitplan enthält eine ungültige Startzeit.",
    );
  }
  const firstSchedule = [...calculatedSchedules].sort(
    (left, right) =>
      left.scheduledAt.getTime() - right.scheduledAt.getTime(),
  )[0];
  const weekendDate = new Date(
    `${parsed.data.weekendDate}T00:00:00.000Z`,
  );
  const revealReached =
    firstSchedule.scheduledAt.getTime() - 60 * 60 * 1000 <= Date.now();
  const circuit =
    parsed.data.mystery && !revealReached
      ? null
      : parsed.data.circuit;
  const countryCode =
    parsed.data.mystery && !revealReached
      ? null
      : parsed.data.countryCode;

  try {
    await prisma.$transaction(async (transaction) => {
      const race = await transaction.race.create({
        data: {
          seasonId: parsed.data.seasonId,
          trackId: parsed.data.trackId,
          name: parsed.data.name,
          circuit,
          countryCode,
          round: parsed.data.round,
          weekendDate,
          scheduledAt: firstSchedule.scheduledAt,
          attendanceDeadline: firstSchedule.attendanceDeadline,
          timezone: firstSchedule.timezone,
          status: parsed.data.status as PrismaRaceStatus,
          sessions: raceSessions(parsed.data.sprint),
          sprint: parsed.data.sprint,
          doublePoints: parsed.data.doublePoints,
          mystery: parsed.data.mystery,
          leagueSchedules: {
            create: calculatedSchedules.map((schedule) => ({
              leagueId: schedule.league.id,
              scheduledAt: schedule.scheduledAt,
              timezone: schedule.timezone,
              attendanceDeadline: schedule.attendanceDeadline,
            })),
          },
        },
        include: {
          season: {
            include: {
              participatingLeagues: {
                where: { active: true },
                orderBy: { code: "asc" },
              },
            },
          },
        },
      });
      const track = publicRaceTrack(race);
      for (const league of race.season.participatingLeagues) {
        const leagueSchedule = calculatedSchedules.find(
          (schedule) => schedule.league.id === league.id,
        );
        if (!leagueSchedule) continue;
        const recipients = await leagueUserIds(transaction, league.id);
        await createNotifications(
          transaction,
          recipients,
          {
            type: NotificationType.NewRace,
            title: `Neues Rennen: ${track.name}`,
            message: `Runde ${race.round} wurde dem gemeinsamen Rennkalender hinzugefügt.`,
            href: "/calendar",
            relatedEntity: { type: "Race", id: race.id },
            dedupeKey: `new-race:${race.id}:${league.id}`,
          },
          {
            leagueId: league.id,
            discordContext: {
              league: league.name,
              season: race.season.name,
              race: track.name,
              track: track.circuit ?? "Mystery Track",
            },
          },
        );

        if (
          leagueSchedule.attendanceDeadline &&
          leagueSchedule.attendanceDeadline > new Date()
        ) {
          const drivers = await transaction.driver.findMany({
            where: {
              leagueId: league.id,
              active: true,
              userId: { not: null },
              team: { seasonId: parsed.data.seasonId },
            },
            select: { userId: true },
          });
          await createNotifications(
            transaction,
            drivers.flatMap((driver) =>
              driver.userId === null ? [] : [driver.userId],
            ),
            {
              type: NotificationType.AttendanceOpen,
              title: `Rennanmeldung für Runde ${race.round} geöffnet`,
              message:
                "Du kannst deine Teilnahme jetzt in FRL Race Control bestätigen.",
              href: `/attendance?raceId=${race.id}&leagueId=${league.id}`,
              relatedEntity: { type: "Race", id: race.id },
              dedupeKey: `attendance-open:${race.id}:${league.id}`,
            },
            {
              leagueId: league.id,
              discordContext: {
                league: league.name,
                season: race.season.name,
                race: track.name,
                track: track.circuit ?? "Mystery Track",
              },
            },
          );
        }
      }
    });
  } catch {
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Rennen wurde erstellt.");
}

export async function updateRaceAction(
  raceIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const user = await authorize();
  const raceId = entityIdSchema.safeParse(raceIdInput);
  const parsed = raceSchema.safeParse(racePayload(formData));

  if (!raceId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültiges Rennen.")
      : validationState(parsed);
  }

  if (!(await validateRaceSeason(parsed.data.seasonId, false))) {
    return errorState("Die Saison ist für keinen Ligabetrieb verfügbar.");
  }

  const prisma = getPrismaClient();

  try {
    const existing = await prisma.race.findUnique({
      where: { id: raceId.data },
      include: {
        season: {
          select: {
            participatingLeagues: {
              orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
            },
          },
        },
        leagueSchedules: true,
        resultSessions: {
          select: { session: true },
        },
        _count: {
          select: {
            attendanceEntries: true,
            resultSessions: true,
          },
        },
      },
    });
    if (!existing) return errorState("Rennen wurde nicht gefunden.");
    if (
      existing.seasonId !== parsed.data.seasonId &&
      (existing._count.attendanceEntries > 0 ||
        existing._count.resultSessions > 0)
    ) {
      return errorState(
        "Rennen mit Anmeldungen oder Ergebnissen können nicht in eine andere Saison verschoben werden.",
      );
    }
    if (
      !parsed.data.sprint &&
      existing.resultSessions.some(
        (session) => session.session === "SPRINT",
      )
    ) {
      return errorState(
        "Das Sprint-Flag kann nicht entfernt werden, solange ein Sprint-Ergebnis existiert.",
      );
    }
    const targetSeason =
      existing.seasonId === parsed.data.seasonId
        ? existing.season
        : await prisma.season.findUnique({
            where: { id: parsed.data.seasonId },
            select: {
              participatingLeagues: {
                orderBy: [
                  { displayOrder: "asc" },
                  { code: "asc" },
                ],
              },
            },
          });
    const calculatedSchedules = (
      targetSeason?.participatingLeagues ?? []
    ).map(
      (league) => ({
        league,
        ...calculateLeagueRaceSchedule(parsed.data.weekendDate, league),
      }),
    );
    if (calculatedSchedules.length === 0) {
      return errorState("Für diese Saison sind keine Ligen verfügbar.");
    }
    for (const schedule of calculatedSchedules) {
      const rawDeadline = formData.get(
        `attendanceDeadline-${schedule.league.id}`,
      );
      if (rawDeadline === null) {
        if (
          existing.weekendDate.toISOString().slice(0, 10) ===
          parsed.data.weekendDate
        ) {
          schedule.attendanceDeadline =
            existing.leagueSchedules.find(
              (current) =>
                current.leagueId === schedule.league.id,
            )?.attendanceDeadline ?? schedule.attendanceDeadline;
        }
        continue;
      }
      const deadline = raceDeadlineOverrideSchema.safeParse({
        leagueId: schedule.league.id,
        localDeadline: rawDeadline,
      });
      if (!deadline.success) {
        return errorState(
          `Der Anmeldeschluss für ${schedule.league.code} ist ungültig.`,
        );
      }
      try {
        schedule.attendanceDeadline = deadline.data.localDeadline
          ? zonedLocalToUtc(
              deadline.data.localDeadline,
              schedule.timezone,
            )
          : null;
      } catch {
        return errorState(
          `Der Anmeldeschluss für ${schedule.league.code} existiert in der Zeitzone nicht.`,
        );
      }
    }
    const firstSchedule = [...calculatedSchedules].sort(
      (left, right) =>
        left.scheduledAt.getTime() - right.scheduledAt.getTime(),
    )[0];
    const revealReached =
      firstSchedule.scheduledAt.getTime() - 60 * 60 * 1000 <= Date.now();
    const circuit =
      parsed.data.mystery && !revealReached
        ? null
        : parsed.data.circuit;
    const countryCode =
      parsed.data.mystery && !revealReached
        ? null
        : parsed.data.countryCode;
    const weekendDate = new Date(
      `${parsed.data.weekendDate}T00:00:00.000Z`,
    );

    await prisma.$transaction(async (transaction) => {
      await transaction.race.update({
        where: { id: raceId.data },
        data: {
          seasonId: parsed.data.seasonId,
          trackId: parsed.data.trackId,
          name:
            existing.mystery &&
            parsed.data.name === "Mystery Track"
              ? existing.name
              : parsed.data.name,
          circuit,
          countryCode,
          round: parsed.data.round,
          weekendDate,
          scheduledAt: firstSchedule.scheduledAt,
          attendanceDeadline: firstSchedule.attendanceDeadline,
          timezone: firstSchedule.timezone,
          status: parsed.data.status as PrismaRaceStatus,
          sessions: raceSessions(parsed.data.sprint),
          sprint: parsed.data.sprint,
          doublePoints: parsed.data.doublePoints,
          mystery: parsed.data.mystery,
        },
      });
      for (const schedule of calculatedSchedules) {
        await transaction.raceLeagueSchedule.upsert({
          where: {
            raceId_leagueId: {
              raceId: raceId.data,
              leagueId: schedule.league.id,
            },
          },
          update: {
            scheduledAt: schedule.scheduledAt,
            timezone: schedule.timezone,
            attendanceDeadline: schedule.attendanceDeadline,
          },
          create: {
            raceId: raceId.data,
            leagueId: schedule.league.id,
            scheduledAt: schedule.scheduledAt,
            timezone: schedule.timezone,
            attendanceDeadline: schedule.attendanceDeadline,
          },
        });
      }
      if (existing.seasonId !== parsed.data.seasonId) {
        await transaction.raceLeagueSchedule.deleteMany({
          where: {
            raceId: raceId.data,
            leagueId: {
              notIn: calculatedSchedules.map(
                (schedule) => schedule.league.id,
              ),
            },
          },
        });
      }
      if (existing.doublePoints !== parsed.data.doublePoints) {
        for (const league of existing.season.participatingLeagues) {
          await transaction.championshipAudit.create({
            data: {
              leagueId: league.id,
              seasonId: existing.seasonId,
              raceId: existing.id,
              actorId: user.id,
              action:
                PrismaChampionshipAuditAction.SCORING_CHANGED,
              entityType: "Race",
              entityId: existing.id,
              previousState: {
                doublePoints: existing.doublePoints,
              },
              newState: {
                doublePoints: parsed.data.doublePoints,
              },
            },
          });
          await recalculateChampionship(
            transaction,
            league.id,
            existing.seasonId,
            user.id,
          );
        }
      }
    });
  } catch {
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Rennen wurde aktualisiert.");
}

export async function deleteRaceAction(
  raceIdInput: number,
  previousState: MasterDataActionState,
): Promise<MasterDataActionState> {
  void previousState;
  await authorize();
  const raceId = entityIdSchema.safeParse(raceIdInput);

  if (!raceId.success) return errorState("Ungültiges Rennen.");

  const prisma = getPrismaClient();

  try {
    const [ticketCount, attendanceCount, resultCount] =
      await prisma.$transaction([
        prisma.fiaTicket.count({
          where: { raceId: raceId.data },
        }),
        prisma.raceAttendance.count({
          where: { raceId: raceId.data },
        }),
        prisma.raceResultSession.count({
          where: { raceId: raceId.data },
        }),
      ]);

    if (ticketCount > 0 || attendanceCount > 0 || resultCount > 0) {
      return errorState(
        "Rennen mit FIA-Tickets, Anmeldungen oder Ergebnissen können nicht gelöscht werden. Setze den Status stattdessen auf Abgesagt.",
      );
    }

    await prisma.race.delete({ where: { id: raceId.data } });
  } catch {
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Rennen wurde gelöscht.");
}

function driverPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    number: formData.get("number"),
    countryCode: formData.get("countryCode"),
    userId: formData.get("userId"),
    seasonId: formData.get("seasonId"),
    leagueId: formData.get("leagueId"),
    organizationId: formData.get("organizationId"),
    lineupStatus: formData.get("lineupStatus"),
    active: formData.get("active"),
  };
}

type DriverAssignmentInput = ReturnType<typeof driverSchema.parse>;

function prismaErrorCode(error: unknown): string | null {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : null;
}

function driverAssignmentError(
  error: unknown,
  input: DriverAssignmentInput,
): MasterDataActionState {
  const message = error instanceof Error ? error.message : "";
  if (message === "SEASON_INACTIVE") {
    return errorState("Die ausgewählte Saison ist nicht aktiv.");
  }
  if (message === "ASSIGNMENT_INCONSISTENT") {
    return errorState(
      "Die Fahrerzuordnung ist nicht konsistent. Bitte Liga und Team erneut auswählen.",
    );
  }
  if (message === "TEAM_ARCHIVED") {
    return errorState(
      "Dieses Team ist archiviert und kann nicht für neue Fahrer verwendet werden.",
    );
  }
  if (message.startsWith("PRIMARY_SLOT_FULL:")) {
    const [, organizationName, leagueCode] = message.split(":");
    return errorState(
      `${organizationName} besitzt in ${leagueCode} bereits zwei aktive Stammfahrer.`,
    );
  }
  if (message.startsWith("DRIVER_NUMBER_CONFLICT:")) {
    const leagueCode = message.split(":")[1];
    return errorState(
      `Die Startnummer ${input.number} ist in ${leagueCode} bereits vergeben.`,
    );
  }
  if (prismaErrorCode(error) === "P2002") {
    return errorState(
      `Die Startnummer ${input.number} ist in der gewählten Liga bereits vergeben.`,
    );
  }
  if (message === "USER_ALREADY_LINKED" || message === "USER_UNAVAILABLE") {
    return errorState(
      "Der ausgewählte Discord-Benutzer ist bereits mit einem anderen Fahrer verknüpft.",
    );
  }
  if (message === "TECHNICAL_TEAM_SLOT_FAILED") {
    return errorState("Der technische Teamplatz konnte nicht vorbereitet werden.");
  }
  if (prismaErrorCode(error) === "P2034") {
    return errorState(
      "Die Zuordnung wurde gleichzeitig geändert. Bitte prüfe Startnummer und Stammplätze und versuche es erneut.",
    );
  }
  return databaseError();
}

async function saveDriverAssignment(
  transaction: Prisma.TransactionClient,
  input: DriverAssignmentInput,
  actorId: number,
  driverId: number | null,
): Promise<void> {
  const [season, league, organization, existingDriver] = await Promise.all([
    transaction.season.findUnique({
      where: { id: input.seasonId },
      select: {
        id: true,
        active: true,
        archivedAt: true,
        participatingLeagues: {
          where: { id: input.leagueId },
          select: { id: true },
        },
      },
    }),
    transaction.league.findUnique({
      where: { id: input.leagueId },
      select: { id: true, code: true, active: true },
    }),
    input.organizationId
      ? transaction.teamOrganization.findUnique({
          where: { id: input.organizationId },
          select: { id: true, name: true, active: true, archivedAt: true },
        })
      : Promise.resolve(null),
    driverId
      ? transaction.driver.findUnique({
          where: { id: driverId },
          select: {
            id: true,
            userId: true,
            leagueId: true,
            teamId: true,
            name: true,
            number: true,
            countryCode: true,
            active: true,
          },
        })
      : Promise.resolve(null),
  ]);

  if (driverId && !existingDriver) throw new Error("DRIVER_NOT_FOUND");
  if (!season || !season.active || season.archivedAt) {
    throw new Error("SEASON_INACTIVE");
  }
  if (
    !league ||
    !league.active ||
    !["F1", "F2", "F3", "F4", "F5", "F6"].includes(league.code) ||
    season.participatingLeagues.length === 0
  ) {
    throw new Error("ASSIGNMENT_INCONSISTENT");
  }
  if (input.organizationId && !organization) {
    throw new Error("ASSIGNMENT_INCONSISTENT");
  }
  if (organization && (!organization.active || organization.archivedAt)) {
    throw new Error("TEAM_ARCHIVED");
  }

  const [numberConflict, selectedUser] = await Promise.all([
    transaction.driver.findFirst({
      where: {
        leagueId: league.id,
        number: input.number,
        id: driverId ? { not: driverId } : undefined,
      },
      select: { id: true },
    }),
    input.userId
      ? transaction.user.findUnique({
          where: { id: input.userId },
          select: {
            active: true,
            driver: { select: { id: true } },
          },
        })
      : Promise.resolve(null),
  ]);
  if (numberConflict) {
    throw new Error(`DRIVER_NUMBER_CONFLICT:${league.code}`);
  }
  if (input.userId && (!selectedUser || !selectedUser.active)) {
    throw new Error("USER_UNAVAILABLE");
  }
  if (
    selectedUser?.driver &&
    selectedUser.driver.id !== driverId
  ) {
    throw new Error("USER_ALREADY_LINKED");
  }

  if (
    input.active &&
    input.lineupStatus === DriverLineupStatus.Primary &&
    organization
  ) {
    const primaryCount = await transaction.driverSeasonAssignment.count({
      where: {
        seasonId: season.id,
        leagueId: league.id,
        organizationId: organization.id,
        lineupStatus: DriverLineupStatus.Primary,
        active: true,
        driverId: driverId ? { not: driverId } : undefined,
      },
    });
    if (primaryCount >= 2) {
      throw new Error(`PRIMARY_SLOT_FULL:${organization.name}:${league.code}`);
    }
  }

  let internalTeamSlot: { id: number } | null = null;
  if (organization) {
    try {
      internalTeamSlot = await ensureInternalTeamSlot(transaction, {
        organizationId: organization.id,
        seasonId: season.id,
        leagueId: league.id,
      });
    } catch (error: unknown) {
      if (
        error instanceof Error &&
        error.message === "TEAM_ORGANIZATION_UNAVAILABLE"
      ) {
        throw new Error("TEAM_ARCHIVED");
      }
      throw new Error("TECHNICAL_TEAM_SLOT_FAILED");
    }
  }

  const driver = existingDriver
    ? await transaction.driver.update({
        where: { id: existingDriver.id },
        data: {
          userId: input.userId,
          teamId: internalTeamSlot?.id ?? null,
          leagueId: league.id,
          name: input.name,
          number: input.number,
          flag: input.countryCode,
          countryCode: input.countryCode,
          active: input.active,
        },
        select: { id: true },
      })
    : await transaction.driver.create({
        data: {
          userId: input.userId,
          teamId: internalTeamSlot?.id ?? null,
          leagueId: league.id,
          name: input.name,
          number: input.number,
          flag: input.countryCode,
          countryCode: input.countryCode,
          active: input.active,
        },
        select: { id: true },
      });

  await transaction.driverSeasonAssignment.updateMany({
    where: {
      driverId: driver.id,
      seasonId: { not: season.id },
      active: true,
      ...(input.active
        ? { season: { active: true, archivedAt: null } }
        : {}),
    },
    data: { active: false },
  });
  await transaction.driverSeasonAssignment.upsert({
    where: {
      driverId_seasonId: { driverId: driver.id, seasonId: season.id },
    },
    create: {
      driverId: driver.id,
      seasonId: season.id,
      leagueId: league.id,
      organizationId: organization?.id ?? null,
      lineupStatus: input.lineupStatus,
      active: input.active,
    },
    update: {
      leagueId: league.id,
      organizationId: organization?.id ?? null,
      lineupStatus: input.lineupStatus,
      active: input.active,
    },
  });
  await writeSystemAudit(transaction, {
    actorId,
    action: existingDriver ? "DRIVER_UPDATED" : "DRIVER_CREATED",
    entityType: "Driver",
    entityId: driver.id,
    metadata: {
      previous: existingDriver
        ? {
            leagueId: existingDriver.leagueId,
            teamId: existingDriver.teamId,
            number: existingDriver.number,
            countryCode: existingDriver.countryCode,
            active: existingDriver.active,
          }
        : null,
      next: {
        seasonId: season.id,
        leagueId: league.id,
        organizationId: organization?.id ?? null,
        lineupStatus: input.lineupStatus,
        internalTeamSlotId: internalTeamSlot?.id ?? null,
        number: input.number,
        countryCode: input.countryCode,
        active: input.active,
      },
    },
  });
}

export async function createDriverAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const actor = await authorize();
  const parsed = driverSchema.safeParse(driverPayload(formData));

  if (!parsed.success) return validationState(parsed);
  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(
      (transaction) =>
        saveDriverAssignment(transaction, parsed.data, actor.id, null),
      { isolationLevel: "Serializable" },
    );
  } catch (error: unknown) {
    return driverAssignmentError(error, parsed.data);
  }

  await revalidateMasterData();
  return successState("Fahrer wurde erstellt.");
}

export async function updateDriverAction(
  driverIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const actor = await authorize();
  const driverId = entityIdSchema.safeParse(driverIdInput);
  const parsed = driverSchema.safeParse(driverPayload(formData));

  if (!driverId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültiger Fahrer.")
      : validationState(parsed);
  }

  const prisma = getPrismaClient();

  try {
    await prisma.$transaction(
      (transaction) =>
        saveDriverAssignment(
          transaction,
          parsed.data,
          actor.id,
          driverId.data,
        ),
      { isolationLevel: "Serializable" },
    );
  } catch (error: unknown) {
    return driverAssignmentError(error, parsed.data);
  }

  await revalidateMasterData();
  return successState("Fahrer wurde aktualisiert.");
}

function teamPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    color: formData.get("color"),
    leagueId: formData.get("leagueId"),
    seasonId: formData.get("seasonId"),
    organizationId: formData.get("organizationId"),
    principalUserId: formData.get("principalUserId"),
    driverIds: formData.getAll("driverIds"),
  };
}

async function activeTeamIdentityExists(
  transaction: Prisma.TransactionClient,
  input: {
    teamId?: number;
    leagueId: number;
    seasonId: number;
    name: string;
    shortName: string;
  },
): Promise<boolean> {
  return Boolean(
    await transaction.team.findFirst({
      where: {
        id: input.teamId ? { not: input.teamId } : undefined,
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        archivedAt: null,
        OR: [
          { name: { equals: input.name, mode: "insensitive" } },
          { shortName: { equals: input.shortName, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
  );
}

async function teamSeasonIsValid(
  leagueId: number,
  seasonId: number,
): Promise<boolean> {
  const prisma = getPrismaClient();
  return Boolean(
    await prisma.season.findFirst({
      where: {
        id: seasonId,
        participatingLeagues: { some: { id: leagueId } },
      },
      select: { id: true },
    }),
  );
}

async function teamLineupIsValid(
  leagueId: number,
  driverIds: number[],
  currentTeamId?: number,
): Promise<boolean> {
  if (driverIds.length === 0) return true;

  const prisma = getPrismaClient();
  const validDriverCount = await prisma.driver.count({
    where: {
      id: { in: driverIds },
      OR: [
        { leagueId },
        ...(currentTeamId ? [{ teamId: currentTeamId }] : []),
      ],
    },
  });

  return validDriverCount === new Set(driverIds).size;
}

function manualTeamCrudDisabled(): boolean {
  return true;
}

export async function createTeamAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  if (manualTeamCrudDisabled()) {
    return errorState(
      "Technische Saison-/Liga-Slots werden ausschließlich automatisch verwaltet.",
    );
  }
  const parsed = teamSchema.safeParse(teamPayload(formData));

  if (!parsed.success) return validationState(parsed);
  if (
    !(await teamSeasonIsValid(
      parsed.data.leagueId,
      parsed.data.seasonId,
    ))
  ) {
    return errorState("Die Saison gehört nicht zur gewählten Liga.");
  }
  if (
    !(await teamLineupIsValid(
      parsed.data.leagueId,
      parsed.data.driverIds,
    ))
  ) {
    return errorState(
      "Alle Fahrer im Line-up müssen zur gewählten Liga gehören.",
    );
  }

  const prisma = getPrismaClient();
  const { driverIds, ...teamData } = parsed.data;

  try {
    await prisma.$transaction(async (transaction) => {
      if (await activeTeamIdentityExists(transaction, teamData)) {
        throw new Error("TEAM_IDENTITY_CONFLICT");
      }
      const team = await transaction.team.create({
        data: { ...teamData, active: true, archivedAt: null },
      });

      if (driverIds.length > 0) {
        await transaction.driver.updateMany({
          where: { id: { in: driverIds } },
          data: { teamId: team.id },
        });
      }
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TEAM_IDENTITY_CONFLICT") {
      return errorState("Ein aktives Team mit diesem Namen oder Kürzel existiert bereits in Liga und Saison.");
    }
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Team wurde erstellt.");
}

export async function updateTeamAction(
  teamIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  await authorize();
  if (manualTeamCrudDisabled()) {
    return errorState(
      "Technische Saison-/Liga-Slots können nicht direkt bearbeitet werden.",
    );
  }
  const teamId = entityIdSchema.safeParse(teamIdInput);
  const parsed = teamSchema.safeParse(teamPayload(formData));

  if (!teamId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültiges Team.")
      : validationState(parsed);
  }

  if (
    !(await teamSeasonIsValid(
      parsed.data.leagueId,
      parsed.data.seasonId,
    ))
  ) {
    return errorState("Die Saison gehört nicht zur gewählten Liga.");
  }
  if (
    !(await teamLineupIsValid(
      parsed.data.leagueId,
      parsed.data.driverIds,
      teamId.data,
    ))
  ) {
    return errorState(
      "Alle neuen Fahrer im Line-up müssen zur gewählten Liga gehören.",
    );
  }

  const prisma = getPrismaClient();
  const { driverIds, ...teamData } = parsed.data;

  try {
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.team.findUnique({
        where: { id: teamId.data },
        select: { seasonId: true, archivedAt: true },
      });
      if (!existing) throw new Error("NOT_FOUND");
      if (existing.archivedAt) throw new Error("TEAM_ARCHIVED");
      if (await activeTeamIdentityExists(transaction, {
        teamId: teamId.data,
        leagueId: teamData.leagueId,
        seasonId: teamData.seasonId,
        name: teamData.name,
        shortName: teamData.shortName,
      })) {
        throw new Error("TEAM_IDENTITY_CONFLICT");
      }
      await transaction.team.update({
        where: { id: teamId.data },
        data: teamData,
      });
      await transaction.driver.updateMany({
        where: {
          teamId: teamId.data,
          id: { notIn: driverIds },
        },
        data: { teamId: null },
      });
      if (driverIds.length > 0) {
        await transaction.driver.updateMany({
          where: { id: { in: driverIds } },
          data: {
            leagueId: parsed.data.leagueId,
            teamId: teamId.data,
          },
        });
      }
      const seasonIds = [
        ...new Set([existing.seasonId, parsed.data.seasonId]),
      ];
      const races = await transaction.race.findMany({
        where: { seasonId: { in: seasonIds } },
        select: { id: true },
      });
      for (const race of races) {
        await synchronizeGlobalTeamPrincipalChampionship(
          transaction,
          race.id,
        );
      }
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TEAM_ARCHIVED") {
      return errorState("Archivierte Teams müssen vor einer Bearbeitung wiederhergestellt werden.");
    }
    if (error instanceof Error && error.message === "TEAM_IDENTITY_CONFLICT") {
      return errorState("Ein aktives Team mit diesem Namen oder Kürzel existiert bereits in Liga und Saison.");
    }
    return databaseError();
  }

  await revalidateMasterData();
  return successState("Team wurde aktualisiert.");
}

export async function archiveTeamAction(
  teamIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const actor = await authorize();
  const teamId = entityIdSchema.safeParse(teamIdInput);
  const parsed = teamArchiveSchema.safeParse({
    confirmed: formData.get("confirmed"),
    detachActiveDrivers: formData.get("detachActiveDrivers"),
  });
  if (!teamId.success || !parsed.success) {
    return errorState("Bitte bestätige die Archivierung.");
  }

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      const snapshot = await getTeamDependencySnapshot(transaction, teamId.data);
      if (!snapshot) throw new Error("TEAM_NOT_FOUND");
      if (snapshot.organization.archivedAt) throw new Error("TEAM_ALREADY_ARCHIVED");
      if (snapshot.activeDrivers.length > 0 && !parsed.data.detachActiveDrivers) {
        throw new Error("TEAM_HAS_ACTIVE_DRIVERS");
      }

      if (parsed.data.detachActiveDrivers) {
        await transaction.driver.updateMany({
          where: { teamId: { in: snapshot.slotIds }, active: true },
          data: { teamId: null },
        });
        await transaction.driverSeasonAssignment.updateMany({
          where: {
            organizationId: snapshot.organization.id,
            active: true,
          },
          data: { active: false },
        });
      }

      const archivedAt = new Date();
      await transaction.teamOrganization.update({
        where: { id: snapshot.organization.id },
        data: { active: false, archivedAt },
      });
      await transaction.team.updateMany({
        where: { organizationId: snapshot.organization.id },
        data: { active: false, archivedAt, principalUserId: null },
      });
      await writeSystemAudit(transaction, {
        actorId: actor.id,
        action: "TEAM_ARCHIVED",
        entityType: "TeamOrganization",
        entityId: snapshot.organization.id,
        metadata: {
          name: snapshot.organization.name,
          archivedAt: archivedAt.toISOString(),
          detachedDriverIds: parsed.data.detachActiveDrivers
            ? snapshot.activeDrivers.map((driver) => driver.id)
            : [],
          internalSlotIds: snapshot.slotIds,
          logoRetained: Boolean(snapshot.organization.logoUrl),
        },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TEAM_HAS_ACTIVE_DRIVERS") {
      return errorState("Dieses Team besitzt noch aktive Fahrerzuordnungen. Weise die Fahrer einem anderen Team zu oder bestätige ausdrücklich ‚Ohne Team‘.");
    }
    if (error instanceof Error && error.message === "TEAM_ALREADY_ARCHIVED") {
      return errorState("Dieses Team ist bereits archiviert.");
    }
    return errorState("Das Team konnte nicht archiviert werden.");
  }

  await revalidateMasterData();
  redirect("/admin/teams?view=archived&notice=archived");
}

export async function restoreTeamAction(
  teamIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const actor = await authorize();
  const teamId = entityIdSchema.safeParse(teamIdInput);
  const parsed = teamRestoreSchema.safeParse({ confirmed: formData.get("confirmed") });
  if (!teamId.success || !parsed.success) {
    return errorState("Bitte bestätige die Wiederherstellung.");
  }

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      const snapshot = await getTeamDependencySnapshot(transaction, teamId.data);
      if (!snapshot) throw new Error("TEAM_NOT_FOUND");
      if (!snapshot.organization.archivedAt) throw new Error("TEAM_NOT_ARCHIVED");
      if (await activeOrganizationIdentityExists(transaction, {
        organizationId: snapshot.organization.id,
        name: snapshot.organization.name,
        shortName: snapshot.organization.shortName,
      })) {
        throw new Error("TEAM_IDENTITY_CONFLICT");
      }

      await transaction.teamOrganization.update({
        where: { id: snapshot.organization.id },
        data: { active: true, archivedAt: null },
      });
      await transaction.team.updateMany({
        where: { organizationId: snapshot.organization.id },
        data: { active: true, archivedAt: null, systemManaged: true },
      });
      await writeSystemAudit(transaction, {
        actorId: actor.id,
        action: "TEAM_RESTORED",
        entityType: "TeamOrganization",
        entityId: snapshot.organization.id,
        metadata: { name: snapshot.organization.name, internalSlotIds: snapshot.slotIds },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TEAM_IDENTITY_CONFLICT") {
      return errorState("Ein anderes aktives Team verwendet bereits denselben Namen oder dasselbe Kürzel.");
    }
    if (error instanceof Error && error.message === "TEAM_NOT_ARCHIVED") {
      return errorState("Dieses Team ist nicht archiviert.");
    }
    return errorState("Das Team konnte nicht wiederhergestellt werden.");
  }

  await revalidateMasterData();
  redirect("/admin/teams?view=active&notice=restored");
}

export async function permanentlyDeleteTeamAction(
  teamIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const actor = await authorize();
  const teamId = entityIdSchema.safeParse(teamIdInput);
  const parsed = teamDeleteSchema.safeParse({
    confirmationName: formData.get("confirmationName"),
  });
  if (!teamId.success || !parsed.success) {
    return errorState("Gib den Teamnamen zur Bestätigung ein.");
  }

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      const snapshot = await getTeamDependencySnapshot(transaction, teamId.data);
      if (!snapshot) throw new Error("TEAM_NOT_FOUND");
      if (!teamDeleteConfirmationMatches(snapshot.organization.name, parsed.data.confirmationName)) {
        throw new Error("TEAM_NAME_MISMATCH");
      }
      if (!canPermanentlyDeleteTeam(snapshot.dependencies)) {
        throw new Error(`TEAM_HAS_DEPENDENCIES:${teamDependencyMessages(snapshot.dependencies).join("|")}`);
      }

      await writeSystemAudit(transaction, {
        actorId: actor.id,
        action: "TEAM_PERMANENTLY_DELETED",
        entityType: "TeamOrganization",
        entityId: snapshot.organization.id,
        metadata: {
          name: snapshot.organization.name,
          shortName: snapshot.organization.shortName,
          removedInternalSlotCount: snapshot.slotIds.length,
          logoDisposition: "no-owned-storage-asset",
        },
      });
      await transaction.team.deleteMany({
        where: { organizationId: snapshot.organization.id },
      });
      await transaction.teamOrganization.delete({
        where: { id: snapshot.organization.id },
      });
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TEAM_NAME_MISMATCH") {
      return errorState("Der eingegebene Teamname stimmt nicht mit der erforderlichen Bestätigung überein.");
    }
    if (error instanceof Error && error.message.startsWith("TEAM_HAS_DEPENDENCIES:")) {
      const dependencies = error.message.slice("TEAM_HAS_DEPENDENCIES:".length).split("|").filter(Boolean);
      return errorState(`Das Team kann nicht endgültig gelöscht werden: ${dependencies.join(", ")}. Archiviere das Team stattdessen.`);
    }
    return errorState("Das Team konnte nicht endgültig gelöscht werden.");
  }

  await revalidateMasterData();
  redirect("/admin/teams?view=all&notice=deleted");
}

function teamOrganizationPayload(formData: FormData) {
  return {
    name: formData.get("name"),
    shortName: formData.get("shortName"),
    color: formData.get("color"),
    secondaryColor: formData.get("secondaryColor"),
    contrastColor: formData.get("contrastColor"),
    logoUrl: formData.get("logoUrl"),
    active: formData.get("active"),
    principalUserId: formData.get("principalUserId"),
  };
}

function hasForbiddenManualTeamDimensions(formData: FormData): boolean {
  return ["leagueId", "seasonId", "organizationId", "driverIds"].some(
    (field) => formData.has(field),
  );
}

async function currentTeamSeason(
  transaction: Prisma.TransactionClient,
): Promise<{ id: number; name: string } | null> {
  return transaction.season.findFirst({
    where: { active: true, archivedAt: null },
    orderBy: { startsOn: "desc" },
    select: { id: true, name: true },
  });
}

async function activeOrganizationIdentityExists(
  transaction: Prisma.TransactionClient,
  input: { organizationId?: number; name: string; shortName: string },
): Promise<boolean> {
  return Boolean(
    await transaction.teamOrganization.findFirst({
      where: {
        id: input.organizationId ? { not: input.organizationId } : undefined,
        archivedAt: null,
        OR: [
          { name: { equals: input.name, mode: "insensitive" } },
          { shortName: { equals: input.shortName, mode: "insensitive" } },
        ],
      },
      select: { id: true },
    }),
  );
}

export async function createTeamOrganizationAction(
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const actor = await authorize();
  if (hasForbiddenManualTeamDimensions(formData)) {
    return errorState(
      "Teams werden global erstellt. Liga, Saison und Fahrer werden ausschließlich in der Benutzerverwaltung zugeordnet.",
    );
  }
  const parsed = teamOrganizationSchema.safeParse(
    teamOrganizationPayload(formData),
  );
  if (!parsed.success) return validationState(parsed);
  const { principalUserId, ...organizationData } = parsed.data;
  try {
    await getPrismaClient().$transaction(async (transaction) => {
      if (await activeOrganizationIdentityExists(transaction, organizationData)) {
        throw new Error("TEAM_IDENTITY_CONFLICT");
      }
      const season = await currentTeamSeason(transaction);
      if (principalUserId && !season) throw new Error("NO_ACTIVE_SEASON");
      const organization = await transaction.teamOrganization.create({
        data: {
          ...organizationData,
          archivedAt: organizationData.active ? null : new Date(),
          seasons: season
            ? { create: { seasonId: season.id, principalUserId } }
            : undefined,
        },
      });
      await writeSystemAudit(transaction, {
        actorId: actor.id,
        action: "TEAM_CREATED",
        entityType: "TeamOrganization",
        entityId: organization.id,
        metadata: { name: organization.name, shortName: organization.shortName },
      });
      if (principalUserId) {
        await writeSystemAudit(transaction, {
          actorId: actor.id,
          action: "TEAM_PRINCIPAL_CHANGED",
          entityType: "TeamOrganization",
          entityId: organization.id,
          metadata: { seasonId: season?.id, previous: null, next: principalUserId },
        });
        await writeSystemAudit(transaction, {
          actorId: actor.id,
          action: "TEAM_PRINCIPAL_CHANGED",
          entityType: "User",
          entityId: principalUserId,
          metadata: { organizationId: organization.id, seasonId: season?.id, previous: null, next: principalUserId },
        });
      }
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TEAM_IDENTITY_CONFLICT") {
      return errorState("Ein aktives Team mit diesem Namen oder Kürzel existiert bereits.");
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_SEASON") {
      return errorState("Für die Teamchef-Zuordnung muss zuerst eine aktive Saison bestehen.");
    }
    return databaseError();
  }
  await revalidateMasterData();
  return successState("Team wurde erstellt.");
}

export async function updateTeamOrganizationAction(
  organizationIdInput: number,
  _previousState: MasterDataActionState,
  formData: FormData,
): Promise<MasterDataActionState> {
  const actor = await authorize();
  if (hasForbiddenManualTeamDimensions(formData)) {
    return errorState(
      "Technische Saison-/Liga-Slots können nicht direkt bearbeitet werden.",
    );
  }
  const organizationId = entityIdSchema.safeParse(organizationIdInput);
  const parsed = teamOrganizationSchema.safeParse(
    teamOrganizationPayload(formData),
  );
  if (!organizationId.success || !parsed.success) {
    return parsed.success
      ? errorState("Ungültiges Team.")
      : validationState(parsed);
  }
  const { principalUserId, ...organizationData } = parsed.data;
  try {
    const prisma = getPrismaClient();
    await prisma.$transaction(async (transaction) => {
      const existing = await transaction.teamOrganization.findUnique({
        where: { id: organizationId.data },
        select: { active: true, archivedAt: true },
      });
      if (!existing) throw new Error("TEAM_NOT_FOUND");
      if (existing.archivedAt) throw new Error("TEAM_ARCHIVED");
      if (organizationData.active !== existing.active) {
        throw new Error("TEAM_LIFECYCLE_REQUIRED");
      }
      if (await activeOrganizationIdentityExists(transaction, {
        organizationId: organizationId.data,
        name: organizationData.name,
        shortName: organizationData.shortName,
      })) {
        throw new Error("TEAM_IDENTITY_CONFLICT");
      }
      const season = await currentTeamSeason(transaction);
      if (principalUserId && !season) throw new Error("NO_ACTIVE_SEASON");
      const previous = season
        ? await transaction.teamOrganizationSeason.findUnique({
            where: {
              organizationId_seasonId: {
                organizationId: organizationId.data,
                seasonId: season.id,
              },
            },
            select: { principalUserId: true },
          })
        : null;
      await transaction.teamOrganization.update({
        where: { id: organizationId.data },
        data: {
          ...organizationData,
          seasons: season
            ? {
                upsert: {
                  where: {
                    organizationId_seasonId: {
                      organizationId: organizationId.data,
                      seasonId: season.id,
                    },
                  },
                  update: { principalUserId },
                  create: { seasonId: season.id, principalUserId },
                },
              }
            : undefined,
        },
      });
      await transaction.team.updateMany({
        where: { organizationId: organizationId.data },
        data: {
          name: organizationData.name,
          shortName: organizationData.shortName,
          color: organizationData.color,
          secondaryColor: organizationData.secondaryColor,
          contrastColor: organizationData.contrastColor,
          logoUrl: organizationData.logoUrl,
          principalUserId: null,
          systemManaged: true,
        },
      });
      if (season && previous?.principalUserId !== principalUserId) {
        await writeSystemAudit(transaction, {
          actorId: actor.id,
          action: "TEAM_PRINCIPAL_CHANGED",
          entityType: "TeamOrganization",
          entityId: organizationId.data,
          metadata: {
            seasonId: season.id,
            previous: previous?.principalUserId ?? null,
            next: principalUserId,
          },
        });
        const affectedUsers = new Set([
          previous?.principalUserId ?? null,
          principalUserId ?? null,
        ]);
        for (const affectedUserId of affectedUsers) {
          if (!affectedUserId) continue;
          await writeSystemAudit(transaction, {
            actorId: actor.id,
            action: "TEAM_PRINCIPAL_CHANGED",
            entityType: "User",
            entityId: affectedUserId,
            metadata: {
              organizationId: organizationId.data,
              seasonId: season.id,
              previous: previous?.principalUserId ?? null,
              next: principalUserId,
            },
          });
        }
      }
    }, { isolationLevel: "Serializable" });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === "TEAM_IDENTITY_CONFLICT") {
      return errorState("Ein aktives Team mit diesem Namen oder Kürzel existiert bereits.");
    }
    if (error instanceof Error && error.message === "TEAM_ARCHIVED") {
      return errorState("Archivierte Teams müssen vor der Bearbeitung wiederhergestellt werden.");
    }
    if (error instanceof Error && error.message === "TEAM_LIFECYCLE_REQUIRED") {
      return errorState("Nutze zum Archivieren oder Wiederherstellen die sichere Teamaktion.");
    }
    if (error instanceof Error && error.message === "NO_ACTIVE_SEASON") {
      return errorState("Für die Teamchef-Zuordnung muss zuerst eine aktive Saison bestehen.");
    }
    return databaseError();
  }
  await revalidateMasterData();
  return successState("Team wurde aktualisiert.");
}
