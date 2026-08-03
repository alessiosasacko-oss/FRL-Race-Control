import { z } from "zod";
import { entityIdSchema } from "./common";
import {
  resultGapModeSchema,
  qualifyingFormatSchema,
  resultPublicationStatusSchema,
  resultSessionSchema,
  resultStatusSchema,
} from "./enums";

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
    baseStatus: resultStatusSchema,
    status: resultStatusSchema,
    gapToWinnerMs: optionalMillisecondsSchema,
    gapToPreviousMs: optionalMillisecondsSchema,
    lapsBehind: z.number().int().nonnegative(),
    totalTimeMs: optionalMillisecondsSchema,
    fastestLapMs: optionalMillisecondsSchema,
    qualifyingTimeMs: optionalMillisecondsSchema,
    qualifyingLaps: z.number().int().nonnegative().nullable(),
    q1TimeMs: optionalMillisecondsSchema,
    q1Laps: z.number().int().nonnegative().nullable(),
    q2TimeMs: optionalMillisecondsSchema,
    q2Laps: z.number().int().nonnegative().nullable(),
    q3TimeMs: optionalMillisecondsSchema,
    q3Laps: z.number().int().nonnegative().nullable(),
    tireCompound: z.string().max(32).nullable(),
    fastestLap: z.boolean(),
    polePosition: z.boolean(),
    lapsCompleted: z.number().int().nonnegative(),
    classifiedPercentage: z.number().min(0).max(100).nullable(),
    penaltySeconds: z.number().nonnegative(),
    effectivePenaltyMs: z.number().int().nonnegative(),
    adjustedTimeMs: optionalMillisecondsSchema,
    finalPosition: z.number().int().positive().nullable(),
    notes: z.string().max(5000).nullable(),
    substitute: z.boolean(),
    racePoints: z.number(),
    bonusPoints: z.number(),
    teamPoints: z.number(),
  })
  .strict();

export type RaceResult = z.infer<typeof raceResultSchema>;

export const raceResultSessionSchema = z
  .object({
    id: entityIdSchema,
    raceId: entityIdSchema,
    leagueId: entityIdSchema,
    session: resultSessionSchema,
    gapMode: resultGapModeSchema,
    publicationStatus: resultPublicationStatusSchema,
    qualifyingFormat: qualifyingFormatSchema.nullable(),
    revision: z.number().int().positive(),
  })
  .strict();
