import "server-only";

import { revalidatePath } from "next/cache";
import {
  AttendanceStatus as PrismaAttendanceStatus,
  ChampionshipAuditAction as PrismaAuditAction,
  Prisma,
  type PrismaClient,
} from "@/generated/prisma/client";
import {
  AttendanceChangeSource,
  AttendanceStatus,
  NotificationType,
  RaceStatus,
  WebhookEventType,
  type Role as DomainRole,
} from "@/domain";
import { writeSystemAudit } from "@/lib/audit/system";
import {
  attendanceChangeIsAllowed,
  attendanceNotificationRecipients,
  authorizeAttendanceChange,
  shouldPersistAttendanceChange,
} from "@/lib/championship/attendance-policy";
import { getPrismaClient } from "@/lib/db/prisma";
import { recordWebhookEvent } from "@/lib/integrations/events";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { createNotifications } from "@/lib/notifications/service";
import { logger } from "@/lib/observability/logger";
import { publicRaceTrack } from "@/lib/races/visibility";
import {
  getAttendanceWindowState,
  isDriverAttendanceStatus,
} from "./policy";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

export type AttendanceServiceErrorCode =
  | "DRIVER_PROFILE_REQUIRED"
  | "DRIVER_NOT_ASSIGNED"
  | "RACE_NOT_FOUND"
  | "RACE_CANCELLED"
  | "LEAGUE_MISMATCH"
  | "ATTENDANCE_NOT_OPEN"
  | "ATTENDANCE_CLOSED"
  | "RACE_ALREADY_STARTED"
  | "INVALID_ATTENDANCE_STATUS"
  | "ATTENDANCE_FORBIDDEN"
  | "ATTENDANCE_REASON_REQUIRED"
  | "SUBSTITUTE_ASSIGNMENT_INVALID"
  | "ATTENDANCE_UPDATE_FAILED";

export class AttendanceServiceError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: AttendanceServiceErrorCode,
    message: string,
    public readonly field?: "reason",
  ) {
    super(message);
    this.name = "AttendanceServiceError";
  }
}

export type ChangeDriverAttendanceInput = {
  actor: { userId: number; roles: readonly DomainRole[] };
  raceId: number;
  driverId: number;
  status: AttendanceStatus.Registered | AttendanceStatus.Declined;
  mode?: "SELF" | "MANAGEMENT";
  reason?: string | null;
  substituteDriverId?: number | null;
  representedTeamId?: number | null;
  origin: "WEB" | "MOBILE";
  now?: Date;
};

export type ChangeDriverAttendanceResult = {
  changed: boolean;
  raceId: number;
  seasonId: number;
  leagueId: number;
  driverId: number;
  attendance: {
    id: number;
    status: AttendanceStatus;
    changedAt: Date;
    changeSource: AttendanceChangeSource;
    substituteDriverId: number | null;
    representedTeamId: number | null;
  };
};

function serviceError(
  status: number,
  code: AttendanceServiceErrorCode,
  message: string,
  field?: "reason",
): never {
  throw new AttendanceServiceError(status, code, message, field);
}

function serializable(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function prismaErrorCode(error: unknown): string | undefined {
  return typeof error === "object" && error !== null && "code" in error
    ? String(error.code)
    : undefined;
}

async function revalidateAttendanceSurfaces(
  database: PrismaClient,
  raceId: number,
): Promise<void> {
  revalidatePath("/attendance");
  revalidatePath("/championship");
  revalidatePath("/calendar");
  revalidatePath("/admin/attendance");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  revalidatePath(`/results/${raceId}`);
  await touchAppDataRevisionSafely(database, [
    "attendance",
    "championship",
    "calendar",
    "notifications",
  ]);
}

async function findRepresentedTeam(
  database: DatabaseClient,
  input: {
    currentTeam: {
      id: number;
      seasonId: number;
      principalUserId: number | null;
      organizationId: number | null;
    } | null;
    assignmentOrganizationId: number | null;
    seasonId: number;
    leagueId: number;
  },
) {
  if (input.currentTeam?.seasonId === input.seasonId) {
    return database.team.findUnique({
      where: { id: input.currentTeam.id },
      select: {
        id: true,
        principalUserId: true,
        organization: {
          select: {
            seasons: {
              where: { seasonId: input.seasonId },
              take: 1,
              select: { principalUserId: true },
            },
          },
        },
      },
    });
  }
  if (input.assignmentOrganizationId === null) return null;
  return database.team.findFirst({
    where: {
      organizationId: input.assignmentOrganizationId,
      seasonId: input.seasonId,
      leagueId: input.leagueId,
      active: true,
      archivedAt: null,
    },
    select: {
      id: true,
      principalUserId: true,
      organization: {
        select: {
          seasons: {
            where: { seasonId: input.seasonId },
            take: 1,
            select: { principalUserId: true },
          },
        },
      },
    },
  });
}

async function persistAttendanceChange(
  transaction: Prisma.TransactionClient,
  input: ChangeDriverAttendanceInput,
): Promise<ChangeDriverAttendanceResult> {
  if (!isDriverAttendanceStatus(input.status)) {
    serviceError(
      400,
      "INVALID_ATTENDANCE_STATUS",
      "Nur REGISTERED oder DECLINED sind als Fahrerantwort erlaubt.",
    );
  }

  const now = input.now ?? new Date();
  const [race, driver] = await Promise.all([
    transaction.race.findUnique({
      where: { id: input.raceId },
      select: {
        id: true,
        seasonId: true,
        name: true,
        circuit: true,
        countryCode: true,
        mystery: true,
        scheduledAt: true,
        status: true,
        season: {
          select: {
            leagueId: true,
            participatingLeagues: { select: { id: true } },
          },
        },
        leagueSchedules: {
          select: {
            id: true,
            leagueId: true,
            scheduledAt: true,
            attendanceDeadline: true,
            createdAt: true,
            league: { select: { code: true } },
          },
        },
      },
    }),
    transaction.driver.findUnique({
      where: { id: input.driverId },
      select: {
        id: true,
        userId: true,
        name: true,
        active: true,
        leagueId: true,
        team: {
          select: {
            id: true,
            seasonId: true,
            principalUserId: true,
            organizationId: true,
          },
        },
        seasonAssignments: {
          where: { active: true },
          select: {
            seasonId: true,
            leagueId: true,
            organizationId: true,
          },
        },
      },
    }),
  ]);

  if (!race) {
    serviceError(404, "RACE_NOT_FOUND", "Das Rennen wurde nicht gefunden.");
  }
  if (!driver || !driver.active) {
    serviceError(
      403,
      "DRIVER_PROFILE_REQUIRED",
      "Ein aktives Fahrerprofil ist erforderlich.",
    );
  }

  const leagueSchedule = race.leagueSchedules.find(
    (schedule) => schedule.leagueId === driver.leagueId,
  );
  const leagueBelongsToSeason =
    race.season.leagueId === driver.leagueId ||
    race.season.participatingLeagues.some(
      (league) => league.id === driver.leagueId,
    );
  if (!leagueSchedule || !leagueBelongsToSeason) {
    serviceError(
      403,
      "LEAGUE_MISMATCH",
      "Das Rennen gehört nicht zur Liga deines Fahrerprofils.",
    );
  }

  const assignment = driver.seasonAssignments.find(
    (item) =>
      item.seasonId === race.seasonId &&
      item.leagueId === driver.leagueId,
  );
  if (!assignment) {
    serviceError(
      403,
      "DRIVER_NOT_ASSIGNED",
      "Dein Fahrerprofil ist dieser Saison und Liga nicht aktiv zugeordnet.",
    );
  }

  const representedTeam = await findRepresentedTeam(transaction, {
    currentTeam: driver.team,
    assignmentOrganizationId: assignment.organizationId,
    seasonId: race.seasonId,
    leagueId: driver.leagueId,
  });
  const teamPrincipalUserId =
    representedTeam?.organization?.seasons[0]?.principalUserId ??
    representedTeam?.principalUserId ??
    null;
  const authorization = authorizeAttendanceChange(
    input.actor,
    {
      driverUserId: driver.userId,
      driverLeagueId: driver.leagueId,
      teamId: representedTeam?.id ?? null,
      teamPrincipalUserId,
    },
    input.mode ?? "SELF",
  );
  if (!authorization.allowed) {
    serviceError(
      403,
      "ATTENDANCE_FORBIDDEN",
      "Du darfst die Rennanmeldung dieses Fahrers nicht ändern.",
    );
  }

  const window = getAttendanceWindowState(
    {
      raceStatus: race.status as RaceStatus,
      scheduledAt: leagueSchedule.scheduledAt,
      opensAt: leagueSchedule.createdAt,
      closesAt: leagueSchedule.attendanceDeadline,
    },
    now,
  );
  if (!authorization.deadlineOverride && window.status !== "OPEN") {
    if (window.status === "RACE_CANCELLED") {
      serviceError(409, "RACE_CANCELLED", window.message);
    }
    if (window.status === "RACE_STARTED") {
      serviceError(409, "RACE_ALREADY_STARTED", window.message);
    }
    if (window.status === "NOT_OPEN") {
      serviceError(409, "ATTENDANCE_NOT_OPEN", window.message);
    }
    serviceError(
      409,
      "ATTENDANCE_CLOSED",
      "Die Rennanmeldung ist bereits geschlossen.",
    );
  }
  if (
    !attendanceChangeIsAllowed(
      authorization,
      leagueSchedule.attendanceDeadline,
      input.reason ?? null,
      now,
    )
  ) {
    if (authorization.reasonRequired && !input.reason?.trim()) {
      serviceError(
        400,
        "ATTENDANCE_REASON_REQUIRED",
        "Bitte gib einen Grund für die Änderung an.",
        "reason",
      );
    }
    serviceError(
      409,
      "ATTENDANCE_CLOSED",
      "Der Anmeldeschluss ist bereits abgelaufen.",
    );
  }

  if (
    authorization.source !== AttendanceChangeSource.Admin &&
    (input.substituteDriverId ||
      (input.representedTeamId !== undefined &&
        input.representedTeamId !== null))
  ) {
    serviceError(
      403,
      "SUBSTITUTE_ASSIGNMENT_INVALID",
      "Ersatzfahrer dürfen nur Administratoren zuweisen.",
    );
  }

  const [existing, usedAsSubstitute] = await Promise.all([
    transaction.raceAttendance.findUnique({
      where: {
        raceId_driverId: { raceId: race.id, driverId: driver.id },
      },
    }),
    input.status === AttendanceStatus.Registered
      ? transaction.raceAttendance.findFirst({
          where: {
            raceId: race.id,
            substituteDriverId: driver.id,
            driverId: { not: driver.id },
          },
          select: { id: true },
        })
      : Promise.resolve(null),
  ]);
  if (usedAsSubstitute) {
    serviceError(
      409,
      "SUBSTITUTE_ASSIGNMENT_INVALID",
      "Du bist für dieses Rennen bereits als Ersatzfahrer eingetragen.",
    );
  }

  const preserveReplacement = input.origin === "MOBILE";
  const nextSubstituteDriverId = preserveReplacement
    ? existing?.substituteDriverId ?? null
    : input.substituteDriverId ?? null;
  let nextRepresentedTeamId = preserveReplacement
    ? existing?.representedTeamId ?? representedTeam?.id ?? null
    : input.representedTeamId ?? representedTeam?.id ?? null;

  if (nextSubstituteDriverId !== null) {
    if (nextSubstituteDriverId === driver.id) {
      serviceError(
        400,
        "SUBSTITUTE_ASSIGNMENT_INVALID",
        "Fahrer und Ersatzfahrer müssen unterschiedlich sein.",
      );
    }
    const [substitute, selectedTeam, duplicate] = await Promise.all([
      transaction.driver.findFirst({
        where: {
          id: nextSubstituteDriverId,
          leagueId: driver.leagueId,
          active: true,
          seasonAssignments: {
            some: {
              seasonId: race.seasonId,
              leagueId: driver.leagueId,
              active: true,
            },
          },
        },
        select: { id: true },
      }),
      nextRepresentedTeamId
        ? transaction.team.findFirst({
            where: {
              id: nextRepresentedTeamId,
              seasonId: race.seasonId,
              leagueId: driver.leagueId,
            },
            select: { id: true },
          })
        : Promise.resolve(null),
      transaction.raceAttendance.findFirst({
        where: {
          raceId: race.id,
          driverId: { not: driver.id },
          OR: [
            { driverId: nextSubstituteDriverId },
            { substituteDriverId: nextSubstituteDriverId },
          ],
        },
        select: { id: true },
      }),
    ]);
    if (!substitute || !selectedTeam) {
      serviceError(
        400,
        "SUBSTITUTE_ASSIGNMENT_INVALID",
        "Ersatzfahrer und vertretenes Team müssen zur Liga und Saison gehören.",
      );
    }
    if (duplicate) {
      serviceError(
        409,
        "SUBSTITUTE_ASSIGNMENT_INVALID",
        "Dieser Ersatzfahrer ist für das Rennen bereits eingetragen.",
      );
    }
    nextRepresentedTeamId = selectedTeam.id;
  }

  const source = authorization.source;
  const actorRole = authorization.actorRole;
  if (!source || !actorRole) {
    serviceError(
      403,
      "ATTENDANCE_FORBIDDEN",
      "Die Änderung konnte nicht autorisiert werden.",
    );
  }

  if (
    existing &&
    !shouldPersistAttendanceChange(
      existing.status as AttendanceStatus,
      input.status,
    ) &&
    existing.substituteDriverId === nextSubstituteDriverId &&
    existing.representedTeamId === nextRepresentedTeamId
  ) {
    return {
      changed: false,
      raceId: race.id,
      seasonId: race.seasonId,
      leagueId: driver.leagueId,
      driverId: driver.id,
      attendance: {
        id: existing.id,
        status: existing.status as AttendanceStatus,
        changedAt: existing.changedAt,
        changeSource: existing.changeSource as AttendanceChangeSource,
        substituteDriverId: existing.substituteDriverId,
        representedTeamId: existing.representedTeamId,
      },
    };
  }

  const attendance = await transaction.raceAttendance.upsert({
    where: {
      raceId_driverId: { raceId: race.id, driverId: driver.id },
    },
    update: {
      status: input.status as PrismaAttendanceStatus,
      leagueScheduleId: leagueSchedule.id,
      substituteDriverId: nextSubstituteDriverId,
      representedTeamId: nextRepresentedTeamId,
      submittedByUserId: input.actor.userId,
      changeSource: source,
      changeReason: input.reason ?? null,
      changedAt: now,
    },
    create: {
      raceId: race.id,
      leagueScheduleId: leagueSchedule.id,
      driverId: driver.id,
      status: input.status as PrismaAttendanceStatus,
      substituteDriverId: nextSubstituteDriverId,
      representedTeamId: nextRepresentedTeamId,
      submittedByUserId: input.actor.userId,
      changeSource: source,
      changeReason: input.reason ?? null,
      changedAt: now,
    },
  });
  const audit = await transaction.attendanceAudit.create({
    data: {
      attendanceId: attendance.id,
      leagueScheduleId: leagueSchedule.id,
      raceId: race.id,
      leagueId: driver.leagueId,
      driverId: driver.id,
      changedByUserId: input.actor.userId,
      actorRole,
      source,
      previousStatus:
        (existing?.status as AttendanceStatus | undefined) ??
        AttendanceStatus.NoResponse,
      newStatus: input.status,
      reason: input.reason ?? null,
    },
  });
  await transaction.championshipAudit.create({
    data: {
      leagueId: driver.leagueId,
      seasonId: race.seasonId,
      raceId: race.id,
      actorId: input.actor.userId,
      action: PrismaAuditAction.ATTENDANCE_CHANGED,
      entityType: "RaceAttendance",
      entityId: attendance.id,
      previousState: existing ? serializable(existing) : undefined,
      newState: serializable(attendance),
    },
  });
  await recordWebhookEvent(transaction, {
    type: WebhookEventType.AttendanceChanged,
    source:
      input.origin === "MOBILE"
        ? "mobile-attendance-api"
        : "attendance-action",
    dedupeKey: `attendance-changed:${attendance.id}:audit:${audit.id}`,
    payload: {
      attendanceId: attendance.id,
      raceId: race.id,
      driverId: driver.id,
      previousStatus: existing?.status ?? AttendanceStatus.NoResponse,
      status: input.status,
      actorId: input.actor.userId,
      source,
      reason: input.reason ?? null,
    },
  });

  if (input.origin === "MOBILE") {
    await writeSystemAudit(transaction, {
      actorId: input.actor.userId,
      action: "ATTENDANCE_CHANGED",
      entityType: "RaceAttendance",
      entityId: attendance.id,
      metadata: {
        raceId: race.id,
        driverId: driver.id,
        previousStatus: existing?.status ?? AttendanceStatus.NoResponse,
        newStatus: input.status,
        source,
        changedAt: now.toISOString(),
      },
    });
  }

  const track = publicRaceTrack(race, now);
  const notificationRecipients = attendanceNotificationRecipients({
    source,
    actorUserId: input.actor.userId,
    driverUserId: driver.userId,
    teamPrincipalUserId,
  });
  if (notificationRecipients.driver.length > 0) {
    await createNotifications(transaction, notificationRecipients.driver, {
      type: NotificationType.Attendance,
      title: "Rennanmeldung geändert",
      message: `${source === AttendanceChangeSource.TeamPrincipal ? "Dein Teamchef" : "Die Administration"} hat dich für ${track.name} in ${leagueSchedule.league.code} ${input.status === AttendanceStatus.Registered ? "angemeldet" : "abgemeldet"}.`,
      href: `/attendance?raceId=${race.id}&leagueId=${driver.leagueId}`,
      relatedEntity: { type: "RaceAttendance", id: attendance.id },
      dedupeKey: `attendance-actor-change:${audit.id}`,
    });
  }
  if (notificationRecipients.teamPrincipal.length > 0) {
    await createNotifications(
      transaction,
      notificationRecipients.teamPrincipal,
      {
        type: NotificationType.Attendance,
        title: `${driver.name} hat die Rennanmeldung geändert`,
        message: `${driver.name} ist für ${track.name} jetzt ${input.status === AttendanceStatus.Registered ? "angemeldet" : "abgemeldet"}.`,
        href: `/attendance?raceId=${race.id}&leagueId=${driver.leagueId}`,
        relatedEntity: { type: "RaceAttendance", id: attendance.id },
        dedupeKey: `attendance-driver-change:${audit.id}`,
      },
    );
  }
  if (input.origin === "MOBILE" && driver.userId !== null) {
    await createNotifications(
      transaction,
      [driver.userId],
      {
        type: NotificationType.Attendance,
        title: "Rennanmeldung bestätigt",
        message:
          input.status === AttendanceStatus.Registered
            ? `Du bist für ${track.name} angemeldet.`
            : `Du bist für ${track.name} abgemeldet.`,
        href: `/attendance?raceId=${race.id}&leagueId=${driver.leagueId}`,
        relatedEntity: { type: "RaceAttendance", id: attendance.id },
        dedupeKey: `attendance-mobile-confirmation:${audit.id}`,
      },
      { allowDiscord: false, allowEmail: false },
    );
  }

  return {
    changed: true,
    raceId: race.id,
    seasonId: race.seasonId,
    leagueId: driver.leagueId,
    driverId: driver.id,
    attendance: {
      id: attendance.id,
      status: attendance.status as AttendanceStatus,
      changedAt: attendance.changedAt,
      changeSource: attendance.changeSource as AttendanceChangeSource,
      substituteDriverId: attendance.substituteDriverId,
      representedTeamId: attendance.representedTeamId,
    },
  };
}

export async function changeDriverAttendance(
  input: ChangeDriverAttendanceInput,
  options: {
    database?: PrismaClient;
    revalidate?: boolean;
  } = {},
): Promise<ChangeDriverAttendanceResult> {
  const prisma = options.database ?? getPrismaClient();
  let result: ChangeDriverAttendanceResult | undefined;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      result = await prisma.$transaction(
        (transaction) => persistAttendanceChange(transaction, input),
        { isolationLevel: Prisma.TransactionIsolationLevel.Serializable },
      );
      break;
    } catch (error) {
      if (error instanceof AttendanceServiceError) throw error;
      const code = prismaErrorCode(error);
      if (attempt < 3 && (code === "P2034" || code === "P2002")) {
        continue;
      }
      logger.error("Attendance update failed", undefined, {
        origin: input.origin,
        raceId: input.raceId,
        driverId: input.driverId,
        errorClass: error instanceof Error ? error.name : "UnknownError",
        prismaCode: code,
      });
      serviceError(
        500,
        "ATTENDANCE_UPDATE_FAILED",
        "Die Rennanmeldung konnte nicht gespeichert werden.",
      );
    }
  }

  if (!result) {
    serviceError(
      500,
      "ATTENDANCE_UPDATE_FAILED",
      "Die Rennanmeldung konnte nicht gespeichert werden.",
    );
  }
  if (result.changed && options.revalidate !== false) {
    await revalidateAttendanceSurfaces(prisma, result.raceId);
  }
  return result;
}
