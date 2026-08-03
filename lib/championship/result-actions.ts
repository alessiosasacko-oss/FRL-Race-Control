"use server";

import { createHash } from "node:crypto";
import { revalidatePath } from "next/cache";
import { after } from "next/server";
import {
  ChampionshipAuditAction,
  PenaltyType as PrismaPenaltyType,
  Prisma,
  ResultPenaltySource,
  ResultPublicationStatus,
  ResultSession as PrismaResultSession,
  ResultStatus as PrismaResultStatus,
} from "@/generated/prisma/client";
import {
  DiscordChannelPurpose,
  NotificationPriority,
  NotificationType,
  PenaltyType,
  RaceSession,
  ResultGapMode,
  ResultSession,
  ResultStatus,
  WebhookEventType,
} from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { recordWebhookEvent } from "@/lib/integrations/events";
import {
  createNotifications,
  leagueUserIds,
} from "@/lib/notifications/service";
import { publicRaceTrack } from "@/lib/races/visibility";
import {
  aggregateFiaPenalties,
  calculateFinalClassification,
  driverBelongsToResultContext,
  fastestLapKeys,
  normalizeGaps,
  parseFastestLapInput,
  parseGapInput,
} from "./result-engine";
import { resultRowsForIntent } from "./result-editor";
import { recalculateChampionship } from "./recalculation";
import { synchronizeGlobalTeamPrincipalChampionship } from "./team-principal-championship";
import {
  resultDraftSubmissionSchema,
  resultSubmissionSchema,
} from "./schemas";
import type { SportsActionState } from "./types";
import { characterView, suitView } from "@/lib/characters/resolve";
import { enqueuePublishedResultGraphics, processResultGraphics } from "@/lib/graphics/result-graphic-service";

type ApplicableDecision = {
  id: number;
  penaltyType: PrismaPenaltyType;
  penaltyValue: number | null;
  reason: string;
  updatedAt: Date;
  penalties: Array<{
    penaltyType: PrismaPenaltyType;
    penaltyValue: number | null;
  }>;
  ticket: {
    id: number;
    drivers: Array<{ driverId: number }>;
  };
};

function errorState(
  message: string,
  fieldErrors?: Record<string, string[]>,
): SportsActionState {
  return { status: "error", message, fieldErrors };
}

function successState(
  message: string,
  persisted = false,
): SportsActionState {
  return {
    status: "success",
    message,
    completedAt: new Date().toISOString(),
    persisted,
  };
}

function resultRaceSession(session: ResultSession): RaceSession {
  if (session === ResultSession.Qualifying) return RaceSession.Qualifying;
  if (session === ResultSession.Sprint) return RaceSession.Sprint;
  return RaceSession.Race;
}

function decisionVersion(decisions: readonly ApplicableDecision[]): string {
  const value = decisions
    .map((decision) => ({
      id: decision.id,
      penaltyType: decision.penaltyType,
      penaltyValue: decision.penaltyValue,
      penalties: decision.penalties,
      updatedAt: decision.updatedAt.toISOString(),
      drivers: decision.ticket.drivers
        .map(({ driverId }) => driverId)
        .sort((left, right) => left - right),
    }))
    .sort((left, right) => left.id - right.id);
  return createHash("sha256")
    .update(JSON.stringify(value))
    .digest("hex");
}

function serializable(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

async function revalidateResults(raceId: number): Promise<void> {
  for (const path of [
    "/admin/results",
    "/championship",
    "/calendar",
    "/dashboard",
    "/notifications",
    `/results/${raceId}`,
  ]) {
    revalidatePath(path);
  }
  await touchAppDataRevisionSafely(getPrismaClient(), ["results", "championship", "calendar", "notifications"]);
}

export async function saveResultsAction(
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
    if (
      typeof input === "object" &&
      input !== null &&
      typeof formData.get("intent") === "string"
    ) {
      input = { ...input, intent: formData.get("intent") };
    }
    if (
      typeof input === "object" &&
      input !== null &&
      "results" in input &&
      Array.isArray(input.results) &&
      "intent" in input
    ) {
      input = {
        ...input,
        results: resultRowsForIntent(input.results, input.intent),
      };
    }
  } catch {
    return errorState("Ergebnisdaten sind ungültig.");
  }

  if (
    typeof input === "object" &&
    input !== null &&
    "intent" in input &&
    input.intent === "DRAFT"
  ) {
    const draftParsed = resultDraftSubmissionSchema.safeParse(input);
    if (!draftParsed.success) {
      return errorState(
        "Der Ergebnisentwurf enthält ungültige Daten.",
        draftParsed.error.flatten().fieldErrors as Record<
          string,
          string[]
        >,
      );
    }

    const prisma = getPrismaClient();
    const race = await prisma.race.findUnique({
      where: { id: draftParsed.data.raceId },
      include: {
        season: {
          include: {
            participatingLeagues: {
              where: {
                id: draftParsed.data.leagueId,
                active: true,
              },
            },
          },
        },
        resultSessions: {
          where: {
            leagueId: draftParsed.data.leagueId,
            session:
              draftParsed.data.session as PrismaResultSession,
          },
        },
      },
    });
    if (!race || race.season.participatingLeagues.length === 0) {
      return errorState(
        "Rennen wurde für diese Liga nicht gefunden.",
      );
    }
    if (
      draftParsed.data.session === ResultSession.Sprint &&
      !race.sprint
    ) {
      return errorState(
        "Sprint-Ergebnisse sind nur für Sprint-Rennen erlaubt.",
      );
    }
    if (race.season.archivedAt && !draftParsed.data.allowArchived) {
      return errorState(
        "Die Bearbeitung einer archivierten Saison muss bestätigt werden.",
      );
    }

    const existingSession = race.resultSessions[0];
    if (
      existingSession?.publicationStatus ===
      ResultPublicationStatus.PUBLISHED
    ) {
      return errorState(
        "Ein veröffentlichtes Ergebnis kann nicht wieder als Entwurf gespeichert werden.",
      );
    }
    if (
      (existingSession?.lockedAt ||
        race.status === "COMPLETED") &&
      !draftParsed.data.confirmLockedEdit
    ) {
      return errorState(
        "Das Ergebnis ist gesperrt. Bestätige die bewusste Bearbeitung.",
      );
    }

    try {
      await prisma.$transaction(async (transaction) => {
        const resultSession =
          await transaction.raceResultSession.upsert({
            where: {
              raceId_leagueId_session: {
                raceId: race.id,
                leagueId: draftParsed.data.leagueId,
                session:
                  draftParsed.data.session as PrismaResultSession,
              },
            },
            update: {
              gapMode: draftParsed.data.gapMode,
              qualifyingFormat: draftParsed.data.qualifyingFormat,
              publicationStatus: ResultPublicationStatus.DRAFT,
              draftPayload: serializable(draftParsed.data),
              revision: { increment: 1 },
              lockedAt: null,
            },
            create: {
              raceId: race.id,
              leagueId: draftParsed.data.leagueId,
              session:
                draftParsed.data.session as PrismaResultSession,
              gapMode: draftParsed.data.gapMode,
              qualifyingFormat: draftParsed.data.qualifyingFormat,
              publicationStatus: ResultPublicationStatus.DRAFT,
              draftPayload: serializable(draftParsed.data),
            },
          });

        await transaction.championshipAudit.create({
          data: {
            leagueId: draftParsed.data.leagueId,
            seasonId: race.seasonId,
            raceId: race.id,
            actorId: user.id,
            action: existingSession
              ? ChampionshipAuditAction.RESULT_UPDATED
              : ChampionshipAuditAction.RESULT_CREATED,
            entityType: "RaceResultSession",
            entityId: resultSession.id,
            previousState: existingSession
              ? serializable(existingSession)
              : undefined,
            newState: serializable({
              intent: "DRAFT",
              gapMode: draftParsed.data.gapMode,
              qualifyingFormat: draftParsed.data.qualifyingFormat,
              resultCount: draftParsed.data.results.length,
              revision: resultSession.revision,
            }),
          },
        });
      });
    } catch (error) {
      console.error("Result draft persistence failed", {
        error:
          error instanceof Error
            ? { name: error.name, message: error.message }
            : "Unknown error",
        raceId: race.id,
        leagueId: draftParsed.data.leagueId,
        session: draftParsed.data.session,
      });
      return errorState(
        "Der Ergebnisentwurf konnte nicht gespeichert werden.",
      );
    }

    await revalidateResults(race.id);
    return successState("Ergebnisentwurf wurde gespeichert.", true);
  }

  const parsed = resultSubmissionSchema.safeParse(input);
  if (!parsed.success) {
    return errorState(
      "Bitte prüfe die markierten Angaben.",
      parsed.error.flatten().fieldErrors as Record<string, string[]>,
    );
  }

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
        include: {
          results: {
            include: { penaltyApplications: true },
          },
        },
      },
    },
  });
  if (!race || race.season.participatingLeagues.length === 0) {
    return errorState("Rennen wurde für diese Liga nicht gefunden.");
  }
  if (parsed.data.session === ResultSession.Sprint && !race.sprint) {
    return errorState(
      "Sprint-Ergebnisse sind nur für Sprint-Rennen erlaubt.",
    );
  }
  if (race.season.archivedAt && !parsed.data.allowArchived) {
    return errorState(
      "Die Bearbeitung einer archivierten Saison muss bestätigt werden.",
    );
  }

  const existingSession = race.resultSessions[0];
  if (
    parsed.data.intent === "PUBLISH" &&
    existingSession?.lastPublicationKey === parsed.data.publicationKey
  ) {
    return successState("Dieses Ergebnis wurde bereits veröffentlicht.", true);
  }
  if (
    parsed.data.intent !== "VALIDATE" &&
    existingSession?.publicationStatus ===
      ResultPublicationStatus.PUBLISHED &&
    parsed.data.intent === "DRAFT"
  ) {
    return errorState(
      "Ein veröffentlichtes Ergebnis kann nicht wieder als Entwurf gespeichert werden.",
    );
  }
  if (
    parsed.data.intent !== "VALIDATE" &&
    existingSession &&
    (existingSession.lockedAt ||
      race.status === "COMPLETED" ||
      existingSession.publicationStatus ===
        ResultPublicationStatus.PUBLISHED) &&
    !parsed.data.confirmLockedEdit
  ) {
    return errorState(
      "Das veröffentlichte Ergebnis ist gesperrt. Bestätige die bewusste Bearbeitung.",
    );
  }

  const decisions = await prisma.decision.findMany({
    where: {
      ticket: {
        raceId: race.id,
        leagueId: parsed.data.leagueId,
        status: "RESOLVED",
        session: resultRaceSession(parsed.data.session),
      },
    },
    orderBy: { id: "asc" },
    select: {
      id: true,
      affectedDriverId: true,
      penaltyType: true,
      penaltyValue: true,
      reason: true,
      updatedAt: true,
      penalties: {
        orderBy: { id: "asc" },
        select: { penaltyType: true, penaltyValue: true },
      },
      ticket: {
        select: {
          id: true,
          drivers: { select: { driverId: true } },
        },
      },
    },
  });
  const currentPenaltyVersion = decisionVersion(decisions);

  const driverIds = new Set(
    parsed.data.results.flatMap((result) => [
      result.driverId,
      ...(result.expectedDriverId ? [result.expectedDriverId] : []),
    ]),
  );
  const teamIds = new Set(
    parsed.data.results.map((result) => result.representedTeamId),
  );
  const [drivers, teams] = await prisma.$transaction([
    prisma.driver.findMany({
      where: { id: { in: [...driverIds] } },
      select: { id: true, leagueId: true, active: true },
    }),
    prisma.team.findMany({
      where: { id: { in: [...teamIds] } },
      select: { id: true, leagueId: true, seasonId: true },
    }),
  ]);
  if (drivers.length !== driverIds.size) {
    return errorState("Mindestens ein Fahrer wurde nicht gefunden.");
  }
  const driverById = new Map(
    drivers.map((driver) => [driver.id, driver]),
  );
  for (const result of parsed.data.results) {
    const driver = driverById.get(result.driverId);
    const expectedDriver = result.expectedDriverId
      ? driverById.get(result.expectedDriverId)
      : null;
    if (
      !driver ||
      !driverBelongsToResultContext({
        driverLeagueId: driver.leagueId,
        selectedLeagueId: parsed.data.leagueId,
        substitute: result.substitute,
        expectedDriverLeagueId:
          expectedDriver?.leagueId ?? null,
      })
    ) {
      return errorState(
        "Stammfahrer müssen zur Liga gehören; Ersatzfahrer benötigen einen gültigen vertretenen Fahrer.",
      );
    }
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
      "Alle Teams müssen zur ausgewählten Liga und Saison gehören.",
    );
  }

  const parsedGaps = parsed.data.results.map((result) =>
    parseGapInput(result.gapInput),
  );
  if (parsedGaps.some((gap) => gap === null)) {
    return errorState("Mindestens ein Abstand ist ungültig.");
  }
  const normalizedGaps = normalizeGaps(
    parsedGaps as NonNullable<(typeof parsedGaps)[number]>[],
    parsed.data.gapMode as ResultGapMode,
  );
  if (normalizedGaps.error) {
    return errorState(normalizedGaps.error);
  }

  const existingResultByDriver = new Map(
    (existingSession?.results ?? []).map((result) => [
      result.driverId,
      result,
    ]),
  );
  const shouldSynchronize =
    !existingSession || parsed.data.syncFiaPenalties;
  const calculations = parsed.data.results.map((result, index) => {
    const currentFia = aggregateFiaPenalties(
      decisions
        .filter((decision) =>
          decision.ticket.drivers.some(
            ({ driverId }) => driverId === result.driverId,
          ),
        )
        .flatMap((decision) =>
          (decision.penalties.length > 0
            ? decision.penalties
            : [
                {
                  penaltyType: decision.penaltyType,
                  penaltyValue: decision.penaltyValue,
                },
              ]
          ).map((penalty) => ({
            decisionId: decision.id,
            penaltyType: penalty.penaltyType as PenaltyType,
            penaltyValue: penalty.penaltyValue,
          })),
        ),
    );
    const storedFiaApplications =
      existingResultByDriver
        .get(result.driverId)
        ?.penaltyApplications.filter(
          (application) =>
            application.source === ResultPenaltySource.FIA &&
            application.active,
        ) ?? [];
    const storedFia = {
      penaltyMilliseconds: storedFiaApplications.reduce(
        (sum, application) =>
          sum + application.penaltyMilliseconds,
        0,
      ),
      disqualified: storedFiaApplications.some(
        (application) => application.disqualified,
      ),
    };
    const imported =
      shouldSynchronize ||
      !existingResultByDriver.has(result.driverId)
        ? currentFia
        : storedFia;
    return {
      key: String(result.driverId),
      order: index,
      status: result.status as ResultStatus,
      gapToLeaderMs:
        normalizedGaps.rows[index]?.gapToLeaderMs ?? null,
      lapsBehind: normalizedGaps.rows[index]?.lapsBehind ?? 0,
      importedPenaltyMs: imported.penaltyMilliseconds,
      importedDisqualified: imported.disqualified,
      hasManualOverride: result.manualOverride,
      manualPenaltyMs: Math.round(
        result.manualPenaltySeconds * 1000,
      ),
      manualDisqualified: result.manualDisqualified,
    };
  });
  const finalClassification =
    calculateFinalClassification(calculations);
  const finalByDriver = new Map(
    finalClassification.map((result) => [
      Number(result.key),
      result,
    ]),
  );
  const fastestTimes = parsed.data.results.map((result) =>
    parseFastestLapInput(result.fastestLapInput),
  );
  const fastestDrivers = fastestLapKeys(
    parsed.data.results.map((result, index) => ({
      key: String(result.driverId),
      fastestLapMs: fastestTimes[index],
      status:
        finalByDriver.get(result.driverId)?.effectiveStatus ??
        (result.status as ResultStatus),
    })),
  );

  if (
    parsed.data.intent === "PUBLISH" &&
    !finalClassification.some(
      (result) =>
        result.effectiveStatus !== ResultStatus.Dns &&
        result.effectiveStatus !== ResultStatus.Dsq,
    )
  ) {
    return errorState(
      "Ein veröffentlichtes Ergebnis benötigt mindestens einen klassifizierten Fahrer.",
    );
  }
  if (parsed.data.intent === "VALIDATE") {
    return successState(
      existingSession?.fiaPenaltyVersion &&
        existingSession.fiaPenaltyVersion !== currentPenaltyVersion
        ? "Ergebnis ist formal gültig. Die FIA-Strafen haben sich geändert und sollten vor der Veröffentlichung synchronisiert werden."
        : "Ergebnis ist vollständig und kann veröffentlicht werden.",
    );
  }

  const publish = parsed.data.intent === "PUBLISH";
  const previousState = existingSession
    ? serializable(existingSession)
    : undefined;
  let renderJobIds: number[] = [];

  try {
    await prisma.$transaction(async (transaction) => {
      const resultSession = await transaction.raceResultSession.upsert({
        where: {
          raceId_leagueId_session: {
            raceId: race.id,
            leagueId: parsed.data.leagueId,
            session: parsed.data.session as PrismaResultSession,
          },
        },
        update: {
          gapMode: parsed.data.gapMode,
          qualifyingFormat: parsed.data.qualifyingFormat,
          lastPublicationKey: publish ? parsed.data.publicationKey : existingSession?.lastPublicationKey,
          publicationStatus: publish
            ? ResultPublicationStatus.PUBLISHED
            : ResultPublicationStatus.DRAFT,
          fiaPenaltyVersion: shouldSynchronize
            ? currentPenaltyVersion
            : existingSession?.fiaPenaltyVersion,
          draftPayload: Prisma.DbNull,
          revision: { increment: 1 },
          lockedAt: publish ? new Date() : null,
          publishedAt: publish ? new Date() : existingSession?.publishedAt,
          publishedByUserId: publish
            ? user.id
            : existingSession?.publishedByUserId,
        },
        create: {
          raceId: race.id,
          leagueId: parsed.data.leagueId,
          session: parsed.data.session as PrismaResultSession,
          gapMode: parsed.data.gapMode,
          qualifyingFormat: parsed.data.qualifyingFormat,
          lastPublicationKey: publish ? parsed.data.publicationKey : null,
          publicationStatus: publish
            ? ResultPublicationStatus.PUBLISHED
            : ResultPublicationStatus.DRAFT,
          fiaPenaltyVersion: currentPenaltyVersion,
          draftPayload: Prisma.DbNull,
          lockedAt: publish ? new Date() : null,
          publishedAt: publish ? new Date() : null,
          publishedByUserId: publish ? user.id : null,
        },
      });

      await transaction.raceResult.updateMany({
        where: { resultSessionId: resultSession.id },
        data: { position: null },
      });

      const characterSources = publish
        ? await transaction.driver.findMany({
            where: { id: { in: parsed.data.results.map((result) => result.driverId) } },
            select: {
              id: true,
              number: true,
              flag: true,
              user: { select: { driverCharacter: { select: { id: true, configuration: true, normalPose: true, winnerPose: true, version: true, suitVariantId: true } } } },
            },
          })
        : [];
      const suitSources = publish
        ? await transaction.team.findMany({
            where: { id: { in: parsed.data.results.map((result) => result.representedTeamId) } },
            select: {
              id: true,
              organization: {
                select: {
                  id: true, color: true, secondaryColor: true, contrastColor: true,
                  suitTemplates: { where: { active: true, archivedAt: null }, orderBy: [{ displayOrder: "asc" }, { name: "asc" }], select: { id: true, organizationId: true, name: true, configuration: true } },
                },
              },
            },
          })
        : [];
      const characterSourceByDriver = new Map(characterSources.map((source) => [source.id, source]));
      const suitSourceByTeam = new Map(suitSources.map((source) => [source.id, source]));

      const retainedResultIds: number[] = [];
      for (const [index, result] of parsed.data.results.entries()) {
        const calculated = finalByDriver.get(result.driverId);
        if (!calculated) throw new Error("CALCULATION_MISSING");
        const character = characterView(characterSourceByDriver.get(result.driverId)?.user?.driverCharacter);
        const organization = suitSourceByTeam.get(result.representedTeamId)?.organization ?? null;
        const suitTemplate = organization?.suitTemplates.find((template) => template.id === character.suitVariantId) ?? null;
        const suit = suitView(suitTemplate, organization);
        const characterSnapshot = publish
          ? ({ version: 1, characterVersion: character.version, configuration: character.configuration, normalPose: character.normalPose, winnerPose: character.winnerPose, driverNumber: characterSourceByDriver.get(result.driverId)?.number ?? 0, flag: characterSourceByDriver.get(result.driverId)?.flag ?? "🏁", teamSuit: suit.configuration, suitTemplateId: suit.id } as Prisma.InputJsonValue)
          : undefined;
        const row = await transaction.raceResult.upsert({
          where: {
            resultSessionId_driverId: {
              resultSessionId: resultSession.id,
              driverId: result.driverId,
            },
          },
          update: {
            representedTeamId: result.representedTeamId,
            expectedDriverId: result.substitute
              ? result.expectedDriverId
              : null,
            position: index + 1,
            startingPosition: result.startingPosition,
            baseStatus: result.status as PrismaResultStatus,
            status: calculated.effectiveStatus as PrismaResultStatus,
            gapToWinnerMs: calculated.gapToLeaderMs,
            gapToPreviousMs:
              normalizedGaps.rows[index]?.gapToPreviousMs ?? null,
            lapsBehind: calculated.lapsBehind,
            fastestLapMs: fastestTimes[index],
            qualifyingTimeMs: parseFastestLapInput(result.qualifyingTimeInput),
            qualifyingLaps: result.qualifyingLaps,
            q1TimeMs: parseFastestLapInput(result.q1TimeInput),
            q1Laps: result.q1Laps,
            q2TimeMs: parseFastestLapInput(result.q2TimeInput),
            q2Laps: result.q2Laps,
            q3TimeMs: parseFastestLapInput(result.q3TimeInput),
            q3Laps: result.q3Laps,
            tireCompound: result.tireCompound || null,
            fastestLap:
              fastestDrivers.has(String(result.driverId)) ||
              (!fastestTimes.some((value) => value !== null) &&
                result.legacyFastestLap),
            polePosition: result.polePosition,
            lapsCompleted: result.lapsCompleted,
            penaltySeconds: calculated.effectivePenaltyMs / 1000,
            effectivePenaltyMs: calculated.effectivePenaltyMs,
            adjustedTimeMs: calculated.adjustedTimeMs,
            finalPosition: calculated.finalPosition,
            notes: result.notes,
            substitute: result.substitute,
            characterSnapshot,
          },
          create: {
            resultSessionId: resultSession.id,
            driverId: result.driverId,
            representedTeamId: result.representedTeamId,
            expectedDriverId: result.substitute
              ? result.expectedDriverId
              : null,
            position: index + 1,
            startingPosition: result.startingPosition,
            baseStatus: result.status as PrismaResultStatus,
            status: calculated.effectiveStatus as PrismaResultStatus,
            gapToWinnerMs: calculated.gapToLeaderMs,
            gapToPreviousMs:
              normalizedGaps.rows[index]?.gapToPreviousMs ?? null,
            lapsBehind: calculated.lapsBehind,
            fastestLapMs: fastestTimes[index],
            qualifyingTimeMs: parseFastestLapInput(result.qualifyingTimeInput),
            qualifyingLaps: result.qualifyingLaps,
            q1TimeMs: parseFastestLapInput(result.q1TimeInput),
            q1Laps: result.q1Laps,
            q2TimeMs: parseFastestLapInput(result.q2TimeInput),
            q2Laps: result.q2Laps,
            q3TimeMs: parseFastestLapInput(result.q3TimeInput),
            q3Laps: result.q3Laps,
            tireCompound: result.tireCompound || null,
            fastestLap:
              fastestDrivers.has(String(result.driverId)) ||
              (!fastestTimes.some((value) => value !== null) &&
                result.legacyFastestLap),
            polePosition: result.polePosition,
            lapsCompleted: result.lapsCompleted,
            penaltySeconds: calculated.effectivePenaltyMs / 1000,
            effectivePenaltyMs: calculated.effectivePenaltyMs,
            adjustedTimeMs: calculated.adjustedTimeMs,
            finalPosition: calculated.finalPosition,
            notes: result.notes,
            substitute: result.substitute,
            characterSnapshot,
          },
        });
        retainedResultIds.push(row.id);

        if (
          shouldSynchronize ||
          !existingResultByDriver.has(result.driverId)
        ) {
          await transaction.resultPenaltyApplication.deleteMany({
            where: {
              resultId: row.id,
              source: ResultPenaltySource.FIA,
            },
          });
          const driverDecisions = decisions.filter((decision) =>
            decision.affectedDriverId
              ? decision.affectedDriverId === result.driverId
              : decision.ticket.drivers.some(
                  ({ driverId }) => driverId === result.driverId,
                ),
          );
          if (driverDecisions.length > 0) {
            await transaction.resultPenaltyApplication.createMany({
              data: driverDecisions.map((decision) => {
                const penalties =
                  decision.penalties.length > 0
                    ? decision.penalties
                    : [
                        {
                          penaltyType: decision.penaltyType,
                          penaltyValue: decision.penaltyValue,
                        },
                      ];
                return {
                  resultId: row.id,
                  decisionId: decision.id,
                  source: ResultPenaltySource.FIA,
                  penaltyType: penalties[0].penaltyType,
                  penaltyMilliseconds: penalties.reduce(
                    (total, penalty) =>
                      penalty.penaltyType ===
                      PrismaPenaltyType.TIME_PENALTY
                        ? total +
                          Math.max(
                            0,
                            Math.round(
                              (penalty.penaltyValue ?? 0) * 1000,
                            ),
                          )
                        : total,
                    0,
                  ),
                  disqualified: penalties.some(
                    ({ penaltyType }) =>
                      penaltyType ===
                      PrismaPenaltyType.DISQUALIFICATION,
                  ),
                  reason: decision.reason.slice(0, 1000),
                };
              }),
            });
          }
        }

        const previousManual =
          existingResultByDriver
            .get(result.driverId)
            ?.penaltyApplications.find(
              (application) =>
                application.source === ResultPenaltySource.MANUAL &&
                application.active,
            ) ?? null;
        await transaction.resultPenaltyApplication.deleteMany({
          where: {
            resultId: row.id,
            source: ResultPenaltySource.MANUAL,
          },
        });
        if (result.manualOverride) {
          await transaction.resultPenaltyApplication.create({
            data: {
              resultId: row.id,
              source: ResultPenaltySource.MANUAL,
              penaltyType: result.manualDisqualified
                ? PrismaPenaltyType.DISQUALIFICATION
                : PrismaPenaltyType.TIME_PENALTY,
              penaltyMilliseconds: Math.round(
                result.manualPenaltySeconds * 1000,
              ),
              disqualified: result.manualDisqualified,
              reason: result.manualOverrideReason,
              createdByUserId: user.id,
            },
          });
          await transaction.championshipAudit.create({
            data: {
              leagueId: parsed.data.leagueId,
              seasonId: race.seasonId,
              raceId: race.id,
              actorId: user.id,
              action: ChampionshipAuditAction.RESULT_UPDATED,
              entityType: "ResultPenaltyApplication",
              entityId: row.id,
              previousState: previousManual
                ? serializable(previousManual)
                : undefined,
              newState: serializable({
                penaltyMilliseconds: Math.round(
                  result.manualPenaltySeconds * 1000,
                ),
                disqualified: result.manualDisqualified,
                reason: result.manualOverrideReason,
              }),
            },
          });
        }
      }

      await transaction.raceResult.deleteMany({
        where: {
          resultSessionId: resultSession.id,
          id: { notIn: retainedResultIds },
        },
      });
      await transaction.championshipAudit.create({
        data: {
          leagueId: parsed.data.leagueId,
          seasonId: race.seasonId,
          raceId: race.id,
          actorId: user.id,
          action: existingSession
            ? ChampionshipAuditAction.RESULT_UPDATED
            : ChampionshipAuditAction.RESULT_CREATED,
          entityType: "RaceResultSession",
          entityId: resultSession.id,
          previousState,
          newState: serializable({
            intent: parsed.data.intent,
            gapMode: parsed.data.gapMode,
            qualifyingFormat: parsed.data.qualifyingFormat,
            resultCount: parsed.data.results.length,
            fiaPenaltyVersion:
              shouldSynchronize
                ? currentPenaltyVersion
                : existingSession?.fiaPenaltyVersion,
            revision: resultSession.revision,
          }),
        },
      });

      await synchronizeGlobalTeamPrincipalChampionship(
        transaction,
        race.id,
        user.id,
      );
      if (!publish) return;

      await recalculateChampionship(
        transaction,
        parsed.data.leagueId,
        race.seasonId,
        user.id,
        { discordDelivery: false },
      );
      renderJobIds = await enqueuePublishedResultGraphics(transaction, {
        raceId: race.id,
        leagueId: parsed.data.leagueId,
        resultSessionId: resultSession.id,
        session: parsed.data.session,
        version: resultSession.revision,
      });
      if (parsed.data.session === ResultSession.Race) {
        await recordWebhookEvent(transaction, {
          type: WebhookEventType.RaceFinished,
          source: "result-table",
          dedupeKey: `race-finished:${race.id}:${parsed.data.leagueId}:${resultSession.revision}`,
          payload: {
            raceId: race.id,
            leagueId: parsed.data.leagueId,
            seasonId: race.seasonId,
            resultSessionId: resultSession.id,
            revision: resultSession.revision,
          },
        });
      }
      const recipientIds = await leagueUserIds(
        transaction,
        parsed.data.leagueId,
      );
      const track = publicRaceTrack(race);
      await createNotifications(
        transaction,
        recipientIds,
        {
          type: NotificationType.RaceResult,
          priority: NotificationPriority.High,
          title: `${track.name}: Ergebnis veröffentlicht`,
          message:
            "Das Ergebnis wurde veröffentlicht und die Meisterschaft aktualisiert.",
          href: `/results/${race.id}`,
          relatedEntity: { type: "Race", id: race.id },
          dedupeKey: `race-result:${race.id}:${parsed.data.leagueId}:${parsed.data.session}:${resultSession.revision}`,
        },
        {
          allowDiscord: false,
          discordPurpose:
            parsed.data.session === ResultSession.Sprint
              ? DiscordChannelPurpose.SprintResults
              : DiscordChannelPurpose.RaceResults,
          leagueId: parsed.data.leagueId,
          discordContext: {
            league: race.season.participatingLeagues[0].name,
            season: race.season.name,
            race: track.name,
            track: track.circuit ?? "Mystery Track",
          },
        },
      );
    });
  } catch {
    return errorState(
      "Das Ergebnis konnte nicht gespeichert werden. Bitte prüfe die Eingaben und versuche es erneut.",
    );
  }

  if (publish && renderJobIds.length > 0) {
    after(async () => {
      const outcomes = await processResultGraphics(renderJobIds);
      const failed = outcomes.filter((outcome) => outcome.status === "rejected").length;
      if (failed > 0) console.error("[result-graphics] Rendering jobs failed.", { raceId: race.id, leagueId: parsed.data.leagueId, failed });
    });
  }

  await revalidateResults(race.id);
  return successState(
    publish
      ? "Ergebnis wurde veröffentlicht und die Meisterschaft neu berechnet."
      : "Ergebnis wurde als Entwurf gespeichert.",
    true,
  );
}
