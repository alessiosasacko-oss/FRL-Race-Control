import { z } from "zod";
import {
  AttendanceStatus,
  ChampionshipAdjustmentTarget,
  ResultSession,
  attendanceStatusSchema,
  resultSessionSchema,
  resultStatusSchema,
} from "@/domain";

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
});

const resultRowSchema = z.object({
  driverId: entityId,
  representedTeamId: entityId,
  expectedDriverId: optionalEntityId,
  position: optionalEntityId,
  startingPosition: optionalEntityId,
  status: resultStatusSchema,
  gapToWinnerSeconds: optionalNumber,
  gapToPreviousSeconds: optionalNumber,
  totalTimeSeconds: optionalNumber,
  fastestLap: z.boolean(),
  polePosition: z.boolean(),
  lapsCompleted: z.coerce.number().int().nonnegative(),
  penaltySeconds: z.coerce.number().nonnegative(),
  notes: z
    .preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.string().trim().max(5000).nullable(),
    ),
  substitute: z.boolean(),
});

export const resultSubmissionSchema = z
  .object({
    leagueId: entityId,
    raceId: entityId,
    session: resultSessionSchema,
    allowArchived: z.boolean(),
    confirmLockedEdit: z.boolean(),
    lockAfterSave: z.boolean(),
    results: z.array(resultRowSchema).min(1).max(100),
  })
  .superRefine((submission, context) => {
    const drivers = new Set<number>();
    const positions = new Set<number>();
    let fastestLapCount = 0;
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

      if (result.position !== null) {
        if (positions.has(result.position)) {
          context.addIssue({
            code: "custom",
            path: ["results", index, "position"],
            message: "Zielpositionen müssen eindeutig sein.",
          });
        }
        positions.add(result.position);
      }

      if (result.fastestLap) fastestLapCount += 1;
      if (result.polePosition) poleCount += 1;
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

    if (fastestLapCount > 1) {
      context.addIssue({
        code: "custom",
        path: ["results"],
        message: "Es darf nur eine schnellste Runde geben.",
      });
    }
    if (poleCount > 1) {
      context.addIssue({
        code: "custom",
        path: ["results"],
        message: "Es darf nur eine Pole-Position geben.",
      });
    }
  });

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
