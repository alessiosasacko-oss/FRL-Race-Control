"use server";

import { revalidatePath } from "next/cache";
import {
  AttendanceStatus as PrismaAttendanceStatus,
  ChampionshipAdjustmentTarget as PrismaAdjustmentTarget,
  ChampionshipAuditAction as PrismaAuditAction,
  type Prisma,
  ResultSession as PrismaResultSession,
  ResultStatus as PrismaResultStatus,
} from "@/generated/prisma/client";
import {
  AttendanceChangeSource,
  AttendanceStatus,
  ChampionshipAdjustmentTarget,
  DiscordChannelPurpose,
  NotificationPriority,
  NotificationType,
  ResultSession,
  WebhookEventType,
} from "@/domain";
import {
  Permission,
} from "@/lib/auth/permissions";
import {
  requireAuthenticatedUser,
  requirePermission,
} from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { recordWebhookEvent } from "@/lib/integrations/events";
import { publicRaceTrack } from "@/lib/races/visibility";
import {
  attendanceUpdateSchema,
  championshipAdjustmentInputSchema,
  deleteResultSubmissionSchema,
  recalculationInputSchema,
  resultSubmissionSchema,
  scoringConfigurationInputSchema,
} from "./schemas";
import { recalculateChampionship } from "./recalculation";
import { parsePointsList } from "./scoring";
import type { SportsActionState } from "./types";
import {
  createNotifications,
  leagueUserIds,
} from "@/lib/notifications/service";
import {
  attendanceChangeIsAllowed,
  attendanceNotificationRecipients,
  authorizeAttendanceChange,
  shouldPersistAttendanceChange,
} from "./attendance-policy";

function errorState(
  message: string,
  fieldErrors?: Record<string, string[]>,
): SportsActionState {
  return { status: "error", message, fieldErrors };
}

function successState(message: string): SportsActionState {
  return { status: "success", message };
}

function validationState(result: {
  error: { flatten: () => { fieldErrors: unknown } };
}): SportsActionState {
  return errorState(
    "Bitte prüfe die markierten Angaben.",
    result.error.flatten().fieldErrors as Record<string, string[]>,
  );
}

function databaseError(): SportsActionState {
  return errorState(
    "Die Änderung konnte nicht gespeichert werden. Bitte prüfe die Daten und versuche es erneut.",
  );
}

function revalidateSports(raceId?: number): void {
  revalidatePath("/attendance");
  revalidatePath("/championship");
  revalidatePath("/calendar");
  revalidatePath("/admin/attendance");
  revalidatePath("/admin/results");
  revalidatePath("/admin/scoring");
  revalidatePath("/admin/adjustments");
  revalidatePath("/admin/championship");
  revalidatePath("/dashboard");
  revalidatePath("/notifications");
  if (raceId) revalidatePath(`/results/${raceId}`);
}

function serializable(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

export async function updateAttendanceAction(
  _previousState: SportsActionState,
  formData: FormData,
): Promise<SportsActionState> {
  const user = await requireAuthenticatedUser();
  const parsed = attendanceUpdateSchema.safeParse({
    raceId: formData.get("raceId"),
    driverId: formData.get("driverId"),
    status: formData.get("status"),
    substituteDriverId: formData.get("substituteDriverId"),
    representedTeamId: formData.get("representedTeamId"),
    changeMode: formData.get("changeMode") ?? undefined,
    reason: formData.get("reason"),
  });

  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();
  const race = await prisma.race.findUnique({
    where: { id: parsed.data.raceId },
    include: {
      season: {
        select: {
          id: true,
          participatingLeagues: { select: { id: true } },
        },
      },
    },
  });
  const driver = await prisma.driver.findUnique({
    where: { id: parsed.data.driverId },
    include: {
      team: {
        select: {
          id: true,
          seasonId: true,
          principalUserId: true,
        },
      },
    },
  });

  if (
    !race ||
    !driver ||
    !race.season.participatingLeagues.some(
      (league) => league.id === driver.leagueId,
    ) ||
    (driver.team !== null && driver.team.seasonId !== race.seasonId)
  ) {
    return errorState("Rennen oder Fahrer wurde nicht gefunden.");
  }

  const authorization = authorizeAttendanceChange(
    { userId: user.id, roles: user.roles },
    {
      driverUserId: driver.userId,
      driverLeagueId: driver.leagueId,
      teamId: driver.team?.id ?? null,
      teamPrincipalUserId: driver.team?.principalUserId ?? null,
    },
    parsed.data.changeMode,
  );
  const leagueSchedule = await prisma.raceLeagueSchedule.findUnique({
    where: {
      raceId_leagueId: {
        raceId: race.id,
        leagueId: driver.leagueId,
      },
    },
    include: {
      league: { select: { code: true, name: true } },
    },
  });

  if (!authorization.allowed || !leagueSchedule) {
    return errorState(
      "Du darfst die Rennanmeldung dieses Fahrers nicht ändern.",
    );
  }

  if (
    !attendanceChangeIsAllowed(
      authorization,
      leagueSchedule.attendanceDeadline,
      parsed.data.reason,
    )
  ) {
    if (authorization.reasonRequired && !parsed.data.reason) {
      return errorState("Bitte gib einen Grund für die Änderung an.", {
        reason: ["Ein Grund ist für Teamchef- und Adminänderungen Pflicht."],
      });
    }
    return errorState("Der Anmeldeschluss ist bereits abgelaufen.");
  }

  if (
    authorization.source !== AttendanceChangeSource.Admin &&
    (parsed.data.substituteDriverId ||
      parsed.data.representedTeamId !== null)
  ) {
    return errorState(
      "Ersatzfahrer dürfen nur Administratoren zuweisen.",
    );
  }

  if (parsed.data.status === "REGISTERED") {
    const usedAsSubstitute = await prisma.raceAttendance.findFirst({
      where: {
        raceId: race.id,
        substituteDriverId: driver.id,
        driverId: { not: driver.id },
      },
      select: { id: true },
    });
    if (usedAsSubstitute) {
      return errorState(
        "Der Fahrer ist für dieses Rennen bereits als Ersatzfahrer eingetragen.",
      );
    }
  }

  let representedTeamId =
    parsed.data.representedTeamId ?? driver.team?.id ?? null;

  if (parsed.data.substituteDriverId) {
    if (parsed.data.substituteDriverId === driver.id) {
      return errorState(
        "Fahrer und Ersatzfahrer müssen unterschiedlich sein.",
      );
    }
    const [substitute, representedTeam, duplicate] =
      await prisma.$transaction([
        prisma.driver.findFirst({
          where: {
            id: parsed.data.substituteDriverId,
            leagueId: driver.leagueId,
            active: true,
            team: {
              seasonId: race.seasonId,
            },
          },
          select: { id: true },
        }),
        parsed.data.representedTeamId
          ? prisma.team.findFirst({
              where: {
                id: parsed.data.representedTeamId,
                seasonId: race.seasonId,
                leagueId: driver.leagueId,
              },
              select: { id: true },
            })
          : prisma.team.findFirst({
              where: {
                id: driver.team?.id ?? 0,
                seasonId: race.seasonId,
              },
              select: { id: true },
            }),
        prisma.raceAttendance.findFirst({
          where: {
            raceId: race.id,
            driverId: { not: driver.id },
            OR: [
              { driverId: parsed.data.substituteDriverId },
              { substituteDriverId: parsed.data.substituteDriverId },
            ],
          },
          select: { id: true },
        }),
      ]);

    if (!substitute || !representedTeam) {
      return errorState(
        "Ersatzfahrer und vertretenes Team müssen zur Liga und Saison gehören.",
      );
    }
    if (duplicate) {
      return errorState(
        "Dieser Ersatzfahrer ist für das Rennen bereits eingetragen.",
      );
    }
    representedTeamId = representedTeam.id;
  }

  const existing = await prisma.raceAttendance.findUnique({
    where: {
      raceId_driverId: {
        raceId: race.id,
        driverId: driver.id,
      },
    },
  });
  if (
    existing &&
    !shouldPersistAttendanceChange(
      existing.status as AttendanceStatus,
      parsed.data.status,
    ) &&
    existing.substituteDriverId === parsed.data.substituteDriverId &&
    existing.representedTeamId === representedTeamId
  ) {
    return successState("Der Anmeldestatus ist bereits aktuell.");
  }
  const source = authorization.source;
  const actorRole = authorization.actorRole;
  if (!source || !actorRole) {
    return errorState("Die Änderung konnte nicht autorisiert werden.");
  }
  const track = publicRaceTrack(race);

  try {
    await prisma.$transaction(async (transaction) => {
      const attendance = await transaction.raceAttendance.upsert({
        where: {
          raceId_driverId: {
            raceId: race.id,
            driverId: driver.id,
          },
        },
        update: {
          status: parsed.data.status as PrismaAttendanceStatus,
          leagueScheduleId: leagueSchedule.id,
          substituteDriverId: parsed.data.substituteDriverId,
          representedTeamId,
          submittedByUserId: user.id,
          changeSource: source,
          changeReason: parsed.data.reason,
          changedAt: new Date(),
        },
        create: {
          raceId: race.id,
          leagueScheduleId: leagueSchedule.id,
          driverId: driver.id,
          status: parsed.data.status as PrismaAttendanceStatus,
          substituteDriverId: parsed.data.substituteDriverId,
          representedTeamId,
          submittedByUserId: user.id,
          changeSource: source,
          changeReason: parsed.data.reason,
        },
      });
      const audit = await transaction.attendanceAudit.create({
        data: {
          attendanceId: attendance.id,
          leagueScheduleId: leagueSchedule.id,
          raceId: race.id,
          leagueId: driver.leagueId,
          driverId: driver.id,
          changedByUserId: user.id,
          actorRole,
          source,
          previousStatus:
            (existing?.status as AttendanceStatus | undefined) ??
            AttendanceStatus.NoResponse,
          newStatus: parsed.data.status,
          reason: parsed.data.reason,
        },
      });
      await transaction.championshipAudit.create({
        data: {
          leagueId: driver.leagueId,
          seasonId: race.seasonId,
          raceId: race.id,
          actorId: user.id,
          action: PrismaAuditAction.ATTENDANCE_CHANGED,
          entityType: "RaceAttendance",
          entityId: attendance.id,
          previousState: existing ? serializable(existing) : undefined,
          newState: serializable(attendance),
        },
      });
      await recordWebhookEvent(transaction, {
        type: WebhookEventType.AttendanceChanged,
        source: "attendance-action",
        dedupeKey: `attendance-changed:${attendance.id}:${attendance.updatedAt.getTime()}`,
        payload: {
          attendanceId: attendance.id,
          raceId: race.id,
          driverId: driver.id,
          status: parsed.data.status,
          actorId: user.id,
          source,
          reason: parsed.data.reason,
        },
      });
      const notificationRecipients = attendanceNotificationRecipients({
        source,
        actorUserId: user.id,
        driverUserId: driver.userId,
        teamPrincipalUserId: driver.team?.principalUserId ?? null,
      });
      if (notificationRecipients.driver.length > 0) {
        await createNotifications(transaction, notificationRecipients.driver, {
          type: NotificationType.Attendance,
          title: "Rennanmeldung geändert",
          message: `${source === AttendanceChangeSource.TeamPrincipal ? "Dein Teamchef" : "Die Administration"} hat dich für den ${track.name} in ${leagueSchedule.league.code} ${parsed.data.status === AttendanceStatus.Registered ? "angemeldet" : "abgemeldet"}.`,
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
            message: `${driver.name} ist für den ${track.name} jetzt ${parsed.data.status === AttendanceStatus.Registered ? "angemeldet" : "abgemeldet"}.`,
            href: `/attendance?raceId=${race.id}&leagueId=${driver.leagueId}`,
            relatedEntity: {
              type: "RaceAttendance",
              id: attendance.id,
            },
            dedupeKey: `attendance-driver-change:${audit.id}`,
          },
        );
      }
    });
  } catch {
    return databaseError();
  }

  revalidateSports(race.id);
  return successState("Rennanmeldung wurde gespeichert.");
}

function milliseconds(seconds: number | null): number | null {
  return seconds === null ? null : Math.round(seconds * 1000);
}

export async function saveLegacyResultsAction(
  _previousState: SportsActionState,
  formData: FormData,
): Promise<SportsActionState> {
  const user = await requirePermission(Permission.ManageResults);
  const rawSubmission = formData.get("submission");

  if (typeof rawSubmission !== "string") {
    return errorState("Ergebnisdaten fehlen.");
  }

  let input: unknown;
  try {
    input = JSON.parse(rawSubmission);
  } catch {
    return errorState("Ergebnisdaten sind ungültig.");
  }
  const parsed = resultSubmissionSchema.safeParse(input);
  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();
  const race = await prisma.race.findUnique({
    where: { id: parsed.data.raceId },
    include: {
      season: {
        include: {
          participatingLeagues: {
            where: { id: parsed.data.leagueId, active: true },
          },
        },
      },
      resultSessions: {
        where: {
          leagueId: parsed.data.leagueId,
          session: parsed.data.session as PrismaResultSession,
        },
        include: { results: true },
      },
    },
  });

  if (
    !race ||
    race.season.participatingLeagues.length === 0
  ) {
    return errorState("Rennen wurde für diese Liga nicht gefunden.");
  }
  const league = race.season.participatingLeagues[0];
  if (
    parsed.data.session === ResultSession.Sprint &&
    !race.sprint
  ) {
    return errorState(
      "Sprint-Ergebnisse sind nur für Sprint-Rennen erlaubt.",
    );
  }
  if (race.season.archivedAt && !parsed.data.allowArchived) {
    return errorState(
      "Für eine archivierte Saison muss die Bearbeitung ausdrücklich bestätigt werden.",
    );
  }

  const existingSession = race.resultSessions[0];
  if (
    existingSession &&
    (existingSession.lockedAt ||
      race.status === "COMPLETED") &&
    !parsed.data.confirmLockedEdit
  ) {
    return errorState(
      "Das Ergebnis ist gesperrt. Bestätige die bewusste Bearbeitung.",
    );
  }

  const driverIds = new Set<number>();
  const teamIds = new Set<number>();
  for (const result of parsed.data.results) {
    driverIds.add(result.driverId);
    teamIds.add(result.representedTeamId);
    if (result.expectedDriverId) driverIds.add(result.expectedDriverId);
  }
  const [drivers, teams] = await prisma.$transaction([
    prisma.driver.findMany({
      where: { id: { in: [...driverIds] } },
      select: { id: true, leagueId: true },
    }),
    prisma.team.findMany({
      where: { id: { in: [...teamIds] } },
      select: { id: true, leagueId: true, seasonId: true },
    }),
  ]);

  if (
    drivers.length !== driverIds.size ||
    drivers.some((driver) => driver.leagueId !== parsed.data.leagueId)
  ) {
    return errorState("Alle Fahrer müssen zur Liga des Rennens gehören.");
  }
  if (
    teams.length !== teamIds.size ||
    teams.some(
      (team) =>
        team.leagueId !== parsed.data.leagueId ||
        team.seasonId !== race.seasonId,
    )
  ) {
    return errorState(
      "Alle vertretenen Teams müssen zur Liga und Saison gehören.",
    );
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const session = await transaction.raceResultSession.upsert({
        where: {
          raceId_leagueId_session: {
            raceId: race.id,
            leagueId: parsed.data.leagueId,
            session: parsed.data.session as PrismaResultSession,
          },
        },
        update: {
          lockedAt: parsed.data.lockAfterSave
            ? new Date()
            : existingSession?.lockedAt,
        },
        create: {
          raceId: race.id,
          leagueId: parsed.data.leagueId,
          session: parsed.data.session as PrismaResultSession,
          lockedAt: parsed.data.lockAfterSave ? new Date() : null,
        },
      });

      await transaction.raceResult.deleteMany({
        where: { resultSessionId: session.id },
      });
      await transaction.raceResult.createMany({
        data: parsed.data.results.map((result) => ({
          resultSessionId: session.id,
          driverId: result.driverId,
          representedTeamId: result.representedTeamId,
          expectedDriverId: result.substitute
            ? result.expectedDriverId
            : null,
          position: result.position,
          startingPosition: result.startingPosition,
          baseStatus: result.status as PrismaResultStatus,
          status: result.status as PrismaResultStatus,
          gapToWinnerMs: milliseconds(result.gapToWinnerSeconds),
          gapToPreviousMs: milliseconds(
            result.gapToPreviousSeconds,
          ),
          totalTimeMs: milliseconds(result.totalTimeSeconds),
          fastestLap: result.fastestLap,
          polePosition: result.polePosition,
          lapsCompleted: result.lapsCompleted,
          classifiedPercentage: null,
          penaltySeconds: result.penaltySeconds,
          notes: result.notes,
          substitute: result.substitute,
        })),
      });
      await transaction.championshipAudit.create({
        data: {
          leagueId: parsed.data.leagueId,
          seasonId: race.seasonId,
          raceId: race.id,
          actorId: user.id,
          action: existingSession
            ? PrismaAuditAction.RESULT_UPDATED
            : PrismaAuditAction.RESULT_CREATED,
          entityType: "RaceResultSession",
          entityId: session.id,
          previousState: existingSession
            ? serializable(existingSession)
            : undefined,
          newState: serializable(parsed.data),
        },
      });
      if (parsed.data.session === ResultSession.Race) {
        await recordWebhookEvent(transaction, {
          type: WebhookEventType.RaceFinished,
          source: "results-action",
          dedupeKey: `race-finished:${race.id}:${parsed.data.leagueId}:${session.updatedAt.getTime()}`,
          payload: {
            raceId: race.id,
            leagueId: parsed.data.leagueId,
            seasonId: race.seasonId,
            resultSessionId: session.id,
            resultCount: parsed.data.results.length,
          },
        });
      }
      await recalculateChampionship(
        transaction,
        parsed.data.leagueId,
        race.seasonId,
        user.id,
      );
      const recipients = await leagueUserIds(
        transaction,
        parsed.data.leagueId,
      );
      const track = publicRaceTrack(race);
      await createNotifications(
        transaction,
        recipients,
        {
          type: NotificationType.RaceResult,
          priority: NotificationPriority.High,
          title: `${track.name}: Neues ${parsed.data.session === ResultSession.Sprint ? "Sprint-" : "Renn"}ergebnis`,
          message:
            "Das vollständige Ergebnis wurde veröffentlicht und die Meisterschaft aktualisiert.",
          href: `/results/${race.id}`,
          relatedEntity: { type: "Race", id: race.id },
          dedupeKey: `race-result:${race.id}:${parsed.data.leagueId}:${parsed.data.session}:${session.updatedAt.getTime()}`,
        },
        {
          discordPurpose:
            parsed.data.session === ResultSession.Sprint
              ? DiscordChannelPurpose.SprintResults
              : DiscordChannelPurpose.RaceResults,
          leagueId: parsed.data.leagueId,
          discordContext: {
            league: league.name,
            season: race.season.name,
            race: track.name,
            track: track.circuit ?? "Mystery Track",
          },
        },
      );
    });
  } catch {
    return databaseError();
  }

  revalidateSports(race.id);
  return successState("Ergebnis wurde vollständig gespeichert.");
}

export async function deleteResultsAction(
  raceIdInput: number,
  leagueIdInput: number,
  sessionInput: ResultSession,
  previousState: SportsActionState,
  formData: FormData,
): Promise<SportsActionState> {
  void previousState;
  const user = await requirePermission(Permission.ManageResults);
  const parsed = deleteResultSubmissionSchema.safeParse({
    raceId: raceIdInput,
    leagueId: leagueIdInput,
    session: sessionInput,
    confirmLockedEdit: formData.get("confirmLockedEdit") === "on",
  });
  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();
  const session = await prisma.raceResultSession.findUnique({
    where: {
      raceId_leagueId_session: {
        raceId: parsed.data.raceId,
        leagueId: parsed.data.leagueId,
        session: parsed.data.session as PrismaResultSession,
      },
    },
    include: { race: true, results: true },
  });
  if (!session) return errorState("Ergebnis wurde nicht gefunden.");
  if (
    (session.lockedAt || session.race.status === "COMPLETED") &&
    !parsed.data.confirmLockedEdit
  ) {
    return errorState(
      "Gesperrte Ergebnisse müssen ausdrücklich bestätigt werden.",
    );
  }

  try {
    await prisma.$transaction(async (transaction) => {
      await transaction.raceResult.deleteMany({
        where: { resultSessionId: session.id },
      });
      await transaction.raceResultSession.delete({
        where: { id: session.id },
      });
      await transaction.championshipAudit.create({
        data: {
          leagueId: parsed.data.leagueId,
          seasonId: session.race.seasonId,
          raceId: session.raceId,
          actorId: user.id,
          action: PrismaAuditAction.RESULT_DELETED,
          entityType: "RaceResultSession",
          entityId: session.id,
          previousState: serializable(session),
        },
      });
      await recalculateChampionship(
        transaction,
        parsed.data.leagueId,
        session.race.seasonId,
        user.id,
      );
    });
  } catch {
    return databaseError();
  }

  revalidateSports(session.raceId);
  return successState("Ergebnis wurde gelöscht.");
}

export async function saveScoringConfigurationAction(
  _previousState: SportsActionState,
  formData: FormData,
): Promise<SportsActionState> {
  const user = await requirePermission(Permission.ManageScoring);
  const parsed = scoringConfigurationInputSchema.safeParse({
    leagueId: formData.get("leagueId"),
    seasonId: formData.get("seasonId"),
    racePoints: formData.get("racePoints"),
    sprintPoints: formData.get("sprintPoints"),
    fastestLapPoint: formData.get("fastestLapPoint"),
    fastestLapRequiresTopPosition: formData.get(
      "fastestLapRequiresTopPosition",
    ),
    polePositionPoint: formData.get("polePositionPoint"),
    dnfScoresPoints: formData.get("dnfScoresPoints"),
    retiredScoresPoints: formData.get("retiredScoresPoints"),
    minimumClassifiedPercentage: formData.get(
      "minimumClassifiedPercentage",
    ),
    teamPointsEnabled: formData.get("teamPointsEnabled"),
    substituteDriverPointsEnabled: formData.get(
      "substituteDriverPointsEnabled",
    ),
    deductPenaltyPoints: formData.get("deductPenaltyPoints"),
  });
  if (!parsed.success) return validationState(parsed);

  let racePoints: number[];
  let sprintPoints: number[];
  try {
    racePoints = parsePointsList(parsed.data.racePoints);
    sprintPoints = parsePointsList(parsed.data.sprintPoints);
  } catch {
    return errorState(
      "Punktelisten müssen kommagetrennte, nicht negative Zahlen enthalten.",
    );
  }
  if (racePoints.length === 0) {
    return errorState(
      "Mindestens eine Rennposition muss Punkte erhalten.",
    );
  }

  const prisma = getPrismaClient();
  const existing = await prisma.scoringConfiguration.findUnique({
    where: {
      leagueId_seasonId: {
        leagueId: parsed.data.leagueId,
        seasonId: parsed.data.seasonId,
      },
    },
    include: { positions: true },
  });

  try {
    await prisma.$transaction(async (transaction) => {
      const configuration =
        await transaction.scoringConfiguration.upsert({
          where: {
            leagueId_seasonId: {
              leagueId: parsed.data.leagueId,
              seasonId: parsed.data.seasonId,
            },
          },
          update: {
            fastestLapPoint: parsed.data.fastestLapPoint,
            fastestLapRequiresTopPosition:
              parsed.data.fastestLapRequiresTopPosition,
            polePositionPoint: parsed.data.polePositionPoint,
            dnfScoresPoints: parsed.data.dnfScoresPoints,
            retiredScoresPoints: parsed.data.retiredScoresPoints,
            minimumClassifiedPercentage:
              parsed.data.minimumClassifiedPercentage,
            teamPointsEnabled: parsed.data.teamPointsEnabled,
            substituteDriverPointsEnabled:
              parsed.data.substituteDriverPointsEnabled,
            deductPenaltyPoints: parsed.data.deductPenaltyPoints,
          },
          create: {
            leagueId: parsed.data.leagueId,
            seasonId: parsed.data.seasonId,
            fastestLapPoint: parsed.data.fastestLapPoint,
            fastestLapRequiresTopPosition:
              parsed.data.fastestLapRequiresTopPosition,
            polePositionPoint: parsed.data.polePositionPoint,
            dnfScoresPoints: parsed.data.dnfScoresPoints,
            retiredScoresPoints: parsed.data.retiredScoresPoints,
            minimumClassifiedPercentage:
              parsed.data.minimumClassifiedPercentage,
            teamPointsEnabled: parsed.data.teamPointsEnabled,
            substituteDriverPointsEnabled:
              parsed.data.substituteDriverPointsEnabled,
            deductPenaltyPoints: parsed.data.deductPenaltyPoints,
          },
        });
      await transaction.scoringPosition.deleteMany({
        where: { scoringConfigurationId: configuration.id },
      });
      await transaction.scoringPosition.createMany({
        data: [
          ...racePoints.map((points, index) => ({
            scoringConfigurationId: configuration.id,
            session: PrismaResultSession.RACE,
            position: index + 1,
            points,
          })),
          ...sprintPoints.map((points, index) => ({
            scoringConfigurationId: configuration.id,
            session: PrismaResultSession.SPRINT,
            position: index + 1,
            points,
          })),
        ],
      });
      await transaction.championshipAudit.create({
        data: {
          leagueId: parsed.data.leagueId,
          seasonId: parsed.data.seasonId,
          actorId: user.id,
          action: PrismaAuditAction.SCORING_CHANGED,
          entityType: "ScoringConfiguration",
          entityId: configuration.id,
          previousState: existing
            ? serializable(existing)
            : undefined,
          newState: serializable({
            ...parsed.data,
            racePoints,
            sprintPoints,
          }),
        },
      });
      await recalculateChampionship(
        transaction,
        parsed.data.leagueId,
        parsed.data.seasonId,
        user.id,
      );
    });
  } catch {
    return databaseError();
  }

  revalidateSports();
  return successState(
    "Punktesystem gespeichert und Meisterschaft neu berechnet.",
  );
}

export async function createChampionshipAdjustmentAction(
  _previousState: SportsActionState,
  formData: FormData,
): Promise<SportsActionState> {
  const user = await requirePermission(
    Permission.ManageChampionshipAdjustments,
  );
  const parsed = championshipAdjustmentInputSchema.safeParse({
    leagueId: formData.get("leagueId"),
    seasonId: formData.get("seasonId"),
    target: formData.get("target"),
    driverId: formData.get("driverId"),
    teamId: formData.get("teamId"),
    points: formData.get("points"),
    reason: formData.get("reason"),
    raceId: formData.get("raceId"),
    fiaTicketId: formData.get("fiaTicketId"),
  });
  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();
  const [season, driver, team, race, ticket] =
    await prisma.$transaction([
      prisma.season.findUnique({
        where: { id: parsed.data.seasonId },
        select: {
          id: true,
          participatingLeagues: {
            where: { id: parsed.data.leagueId },
            select: { id: true },
          },
        },
      }),
      parsed.data.driverId
        ? prisma.driver.findUnique({
            where: { id: parsed.data.driverId },
            select: { id: true, leagueId: true },
          })
        : prisma.driver.findFirst({
            where: { id: 0 },
            select: { id: true, leagueId: true },
          }),
      parsed.data.teamId
        ? prisma.team.findUnique({
            where: { id: parsed.data.teamId },
            select: { id: true, seasonId: true, leagueId: true },
          })
        : prisma.team.findFirst({
            where: { id: 0 },
            select: { id: true, seasonId: true, leagueId: true },
          }),
      parsed.data.raceId
        ? prisma.race.findUnique({
            where: { id: parsed.data.raceId },
            select: { seasonId: true },
          })
        : prisma.race.findFirst({
            where: { id: 0 },
            select: { seasonId: true },
          }),
      parsed.data.fiaTicketId
        ? prisma.fiaTicket.findUnique({
            where: { id: parsed.data.fiaTicketId },
            select: { seasonId: true, leagueId: true },
          })
        : prisma.fiaTicket.findFirst({
            where: { id: 0 },
            select: { seasonId: true, leagueId: true },
          }),
    ]);

  if (
    !season ||
    season.participatingLeagues.length === 0
  ) {
    return errorState("Saison wurde für diese Liga nicht gefunden.");
  }
  if (
    parsed.data.target === ChampionshipAdjustmentTarget.Driver &&
    (!driver || driver.leagueId !== parsed.data.leagueId)
  ) {
    return errorState("Der Fahrer gehört nicht zur Saisonliga.");
  }
  if (
    parsed.data.target === ChampionshipAdjustmentTarget.Team &&
    (!team ||
      team.seasonId !== season.id ||
      team.leagueId !== parsed.data.leagueId)
  ) {
    return errorState("Das Team gehört nicht zur Saison.");
  }
  if (race && race.seasonId !== season.id) {
    return errorState("Das Rennen gehört nicht zur Saison.");
  }
  if (
    ticket &&
    (ticket.seasonId !== season.id ||
      ticket.leagueId !== parsed.data.leagueId)
  ) {
    return errorState("Das FIA-Ticket gehört nicht zur Saison.");
  }

  try {
    await prisma.$transaction(async (transaction) => {
      const adjustment =
        await transaction.championshipAdjustment.create({
          data: {
            leagueId: parsed.data.leagueId,
            seasonId: season.id,
            target: parsed.data.target as PrismaAdjustmentTarget,
            driverId:
              parsed.data.target === ChampionshipAdjustmentTarget.Driver
                ? parsed.data.driverId
                : null,
            teamId:
              parsed.data.target === ChampionshipAdjustmentTarget.Team
                ? parsed.data.teamId
                : null,
            points: parsed.data.points,
            reason: parsed.data.reason,
            actorId: user.id,
            raceId: parsed.data.raceId,
            fiaTicketId: parsed.data.fiaTicketId,
          },
        });
      await transaction.championshipAudit.create({
        data: {
          leagueId: parsed.data.leagueId,
          seasonId: season.id,
          actorId: user.id,
          action: PrismaAuditAction.ADJUSTMENT_CREATED,
          entityType: "ChampionshipAdjustment",
          entityId: adjustment.id,
          newState: serializable(adjustment),
        },
      });
      await recalculateChampionship(
        transaction,
        parsed.data.leagueId,
        season.id,
        user.id,
      );
    });
  } catch {
    return databaseError();
  }

  revalidateSports(parsed.data.raceId ?? undefined);
  return successState(
    "Punkteanpassung erstellt und Meisterschaft neu berechnet.",
  );
}

export async function recalculateChampionshipAction(
  _previousState: SportsActionState,
  formData: FormData,
): Promise<SportsActionState> {
  const user = await requirePermission(Permission.ManageScoring);
  const parsed = recalculationInputSchema.safeParse({
    leagueId: formData.get("leagueId"),
    seasonId: formData.get("seasonId"),
  });
  if (!parsed.success) return validationState(parsed);

  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      await recalculateChampionship(
        transaction,
        parsed.data.leagueId,
        parsed.data.seasonId,
        user.id,
      );
    });
  } catch {
    return databaseError();
  }

  revalidateSports();
  return successState("Meisterschaft wurde neu berechnet.");
}
