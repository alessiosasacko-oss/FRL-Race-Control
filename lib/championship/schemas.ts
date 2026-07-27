import { z } from "zod";
import {
  AttendanceStatus,
  ChampionshipAdjustmentTarget,
  ResultGapMode,
  ResultSession,
  attendanceStatusSchema,
  resultGapModeSchema,
  resultSessionSchema,
  resultStatusSchema,
} from "@/domain";
import {
  parseFastestLapInput,
  parseGapInput,
} from "./result-engine";

const entityId = z.coerce.number().int().positive();
const optionalEntityId = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? null
      : value,
  z.coerce.number().int().positive().nullable(),
);
const optionalNumber = z.preprocess(
  (value) =>
    value === "" || value === null || value === undefined
      ? null
      : value,
  z.coerce.number().nonnegative().nullable(),
);
const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);
const firstValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

export const sportsListQuerySchema = z.object({
  q: z
    .preprocess(firstValue, z.string().trim().max(100).optional())
    .catch("")
    .transform((value) => value ?? ""),
  leagueId: z
    .preprocess(firstValue, optionalEntityId)
    .catch(null)
    .transform((value) => value ?? undefined),
  seasonId: z
    .preprocess(firstValue, optionalEntityId)
    .catch(null)
    .transform((value) => value ?? undefined),
  raceId: z
    .preprocess(firstValue, optionalEntityId)
    .catch(null)
    .transform((value) => value ?? undefined),
  teamId: z
    .preprocess(firstValue, optionalEntityId)
    .catch(null)
    .transform((value) => value ?? undefined),
  attendanceStatus: z
    .preprocess(firstValue, attendanceStatusSchema.optional())
    .catch(undefined),
  table: z
    .preprocess(firstValue, z.enum(["drivers", "teams"]))
    .catch("drivers"),
});

export const attendanceUpdateSchema = z.object({
  raceId: entityId,
  driverId: entityId,
  status: z.enum([
    AttendanceStatus.Registered,
    AttendanceStatus.Declined,
  ]),
  substituteDriverId: optionalEntityId,
  representedTeamId: optionalEntityId,
  changeMode: z.enum(["SELF", "MANAGEMENT"]).default("SELF"),
  reason: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined
        ? null
        : value,
    z.string().trim().max(1000).nullable(),
  ),
});

const resultRowSchema = z.object({
  driverId: entityId,
  representedTeamId: entityId,
  expectedDriverId: optionalEntityId,
  position: entityId,
  startingPosition: optionalEntityId,
  status: resultStatusSchema,
  gapInput: z.string().trim().max(40),
  fastestLapInput: z.string().trim().max(40),
  legacyFastestLap: z.boolean(),
  gapToWinnerSeconds: optionalNumber.default(null),
  gapToPreviousSeconds: optionalNumber.default(null),
  totalTimeSeconds: optionalNumber.default(null),
  fastestLap: z.boolean().default(false),
  polePosition: z.boolean(),
  lapsCompleted: z.coerce.number().int().nonnegative(),
  manualOverride: z.boolean(),
  manualPenaltySeconds: z.coerce.number().nonnegative(),
  penaltySeconds: z.coerce.number().nonnegative().default(0),
  manualDisqualified: z.boolean(),
  manualOverrideReason: z
    .preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.string().trim().max(1000).nullable(),
    ),
  notes: z
    .preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.string().trim().max(5000).nullable(),
    ),
  substitute: z.boolean(),
});

const draftResultRowSchema = z.object({
  driverId: z.union([entityId, z.null()]),
  representedTeamId: z.union([entityId, z.null()]),
  expectedDriverId: optionalEntityId,
  position: entityId,
  startingPosition: optionalEntityId,
  status: resultStatusSchema,
  gapInput: z.string().max(40),
  fastestLapInput: z.string().max(40),
  legacyFastestLap: z.boolean(),
  polePosition: z.boolean(),
  lapsCompleted: z.coerce.number().int().nonnegative(),
  manualOverride: z.boolean(),
  manualPenaltySeconds: z.coerce.number().nonnegative(),
  manualDisqualified: z.boolean(),
  manualOverrideReason: z
    .preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.string().max(1000).nullable(),
    ),
  notes: z
    .preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.string().max(5000).nullable(),
    ),
  substitute: z.boolean(),
});

export const resultDraftSubmissionSchema = z.object({
  leagueId: entityId,
  raceId: entityId,
  session: resultSessionSchema,
  gapMode: resultGapModeSchema,
  intent: z.literal("DRAFT"),
  syncFiaPenalties: z.boolean(),
  allowArchived: z.boolean(),
  confirmLockedEdit: z.boolean(),
  lockAfterSave: z.boolean().default(false),
  results: z.array(draftResultRowSchema).max(100),
});

export const resultSubmissionSchema = z
  .object({
    leagueId: entityId,
    raceId: entityId,
    session: resultSessionSchema,
    gapMode: resultGapModeSchema,
    intent: z.enum(["DRAFT", "VALIDATE", "PUBLISH"]),
    syncFiaPenalties: z.boolean(),
    allowArchived: z.boolean(),
    confirmLockedEdit: z.boolean(),
    lockAfterSave: z.boolean().default(false),
    results: z.array(resultRowSchema).min(1).max(100),
  })
  .superRefine((submission, context) => {
    const drivers = new Set<number>();
    const positions = new Set<number>();
    let poleCount = 0;

    submission.results.forEach((result, index) => {
      if (drivers.has(result.driverId)) {
        context.addIssue({
          code: "custom",
          path: ["results", index, "driverId"],
          message: "Ein Fahrer darf pro Sitzung nur einmal vorkommen.",
        });
      }
      drivers.add(result.driverId);

      if (positions.has(result.position)) {
        context.addIssue({
          code: "custom",
          path: ["results", index, "position"],
          message: "Zielpositionen müssen eindeutig sein.",
        });
      }
      positions.add(result.position);

      if (result.polePosition) poleCount += 1;
      if (parseGapInput(result.gapInput) === null) {
        context.addIssue({
          code: "custom",
          path: ["results", index, "gapInput"],
          message: "Bitte einen gültigen Abstand eingeben.",
        });
      }
      if (
        result.fastestLapInput &&
        parseFastestLapInput(result.fastestLapInput) === null
      ) {
        context.addIssue({
          code: "custom",
          path: ["results", index, "fastestLapInput"],
          message: "Bitte eine gültige Rundenzeit eingeben.",
        });
      }
      if (
        result.manualOverride &&
        (!result.manualOverrideReason ||
          result.manualOverrideReason.length < 3)
      ) {
        context.addIssue({
          code: "custom",
          path: ["results", index, "manualOverrideReason"],
          message:
            "Eine manuelle Anpassung benötigt eine kurze Begründung.",
        });
      }
      if (
        result.substitute &&
        (!result.expectedDriverId ||
          result.expectedDriverId === result.driverId)
      ) {
        context.addIssue({
          code: "custom",
          path: ["results", index, "expectedDriverId"],
          message:
            "Für einen Ersatzfahrer muss der ursprüngliche Fahrer angegeben werden.",
        });
      }
    });

    if (poleCount > 1) {
      context.addIssue({
        code: "custom",
        path: ["results"],
        message: "Es darf nur eine Pole-Position geben.",
      });
    }
  });

export const resultGapModeInputSchema = z
  .enum(ResultGapMode)
  .catch(ResultGapMode.ToLeader);

export const deleteResultSubmissionSchema = z.object({
  leagueId: entityId,
  raceId: entityId,
  session: resultSessionSchema,
  confirmLockedEdit: z.boolean(),
});

export const scoringConfigurationInputSchema = z.object({
  leagueId: entityId,
  seasonId: entityId,
  racePoints: z.string().trim().min(1).max(500),
  sprintPoints: z.string().trim().max(500),
  fastestLapPoint: z.coerce.number().nonnegative(),
  fastestLapRequiresTopPosition: optionalEntityId,
  polePositionPoint: z.coerce.number().nonnegative(),
  dnfScoresPoints: checkbox,
  retiredScoresPoints: checkbox,
  minimumClassifiedPercentage: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.coerce.number().min(0).max(100).nullable(),
  ),
  teamPointsEnabled: checkbox,
  substituteDriverPointsEnabled: checkbox,
  deductPenaltyPoints: checkbox,
});

export const championshipAdjustmentInputSchema = z
  .object({
    seasonId: entityId,
    leagueId: entityId,
    target: z.enum(ChampionshipAdjustmentTarget),
    driverId: optionalEntityId,
    teamId: optionalEntityId,
    points: z.coerce.number().min(-10000).max(10000),
    reason: z.string().trim().min(3).max(1000),
    raceId: optionalEntityId,
    fiaTicketId: optionalEntityId,
  })
  .superRefine((adjustment, context) => {
    if (
      adjustment.target === ChampionshipAdjustmentTarget.Driver &&
      !adjustment.driverId
    ) {
      context.addIssue({
        code: "custom",
        path: ["driverId"],
        message: "Bitte einen Fahrer auswählen.",
      });
    }
    if (
      adjustment.target === ChampionshipAdjustmentTarget.Team &&
      !adjustment.teamId
    ) {
      context.addIssue({
        code: "custom",
        path: ["teamId"],
        message: "Bitte ein Team auswählen.",
      });
    }
  });

export const recalculationInputSchema = z.object({
  leagueId: entityId,
  seasonId: entityId,
});

export const resultSessionInputSchema = z.enum(ResultSession);
