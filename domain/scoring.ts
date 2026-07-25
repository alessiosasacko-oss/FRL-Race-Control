import { z } from "zod";
import { entityIdSchema } from "./common";
import {
  championshipAdjustmentTargetSchema,
  resultSessionSchema,
} from "./enums";

export const scoringPositionSchema = z
  .object({
    session: resultSessionSchema,
    position: z.number().int().positive(),
    points: z.number().nonnegative(),
  })
  .strict();

export const scoringConfigurationSchema = z
  .object({
    id: entityIdSchema,
    seasonId: entityIdSchema,
    fastestLapPoint: z.number().nonnegative(),
    fastestLapRequiresTopPosition: z
      .number()
      .int()
      .positive()
      .nullable(),
    polePositionPoint: z.number().nonnegative(),
    dnfScoresPoints: z.boolean(),
    retiredScoresPoints: z.boolean(),
    minimumClassifiedPercentage: z.number().min(0).max(100).nullable(),
    teamPointsEnabled: z.boolean(),
    substituteDriverPointsEnabled: z.boolean(),
    deductPenaltyPoints: z.boolean(),
    positions: z.array(scoringPositionSchema),
  })
  .strict();

export const championshipAdjustmentSchema = z
  .object({
    id: entityIdSchema,
    seasonId: entityIdSchema,
    target: championshipAdjustmentTargetSchema,
    driverId: entityIdSchema.nullable(),
    teamId: entityIdSchema.nullable(),
    points: z.number(),
    reason: z.string().trim().min(3).max(1000),
    actorId: entityIdSchema,
    raceId: entityIdSchema.nullable(),
    fiaTicketId: entityIdSchema.nullable(),
  })
  .strict();

export type ScoringPosition = z.infer<typeof scoringPositionSchema>;
export type ScoringConfiguration = z.infer<
  typeof scoringConfigurationSchema
>;
export type ChampionshipAdjustment = z.infer<
  typeof championshipAdjustmentSchema
>;
