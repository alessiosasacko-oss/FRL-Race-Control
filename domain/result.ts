import { z } from "zod";
import { entityIdSchema } from "./common";
import { resultSessionSchema, resultStatusSchema } from "./enums";

const optionalMillisecondsSchema = z.number().int().nonnegative().nullable();

export const raceResultSchema = z
  .object({
    id: entityIdSchema,
    resultSessionId: entityIdSchema,
    session: resultSessionSchema,
    driverId: entityIdSchema,
    representedTeamId: entityIdSchema,
    expectedDriverId: entityIdSchema.nullable(),
    position: z.number().int().positive().nullable(),
    startingPosition: z.number().int().positive().nullable(),
    status: resultStatusSchema,
    gapToWinnerMs: optionalMillisecondsSchema,
    gapToPreviousMs: optionalMillisecondsSchema,
    totalTimeMs: optionalMillisecondsSchema,
    fastestLap: z.boolean(),
    polePosition: z.boolean(),
    lapsCompleted: z.number().int().nonnegative(),
    classifiedPercentage: z.number().min(0).max(100).nullable(),
    penaltySeconds: z.number().nonnegative(),
    notes: z.string().max(5000).nullable(),
    substitute: z.boolean(),
    racePoints: z.number(),
    bonusPoints: z.number(),
    teamPoints: z.number(),
  })
  .strict();

export type RaceResult = z.infer<typeof raceResultSchema>;
