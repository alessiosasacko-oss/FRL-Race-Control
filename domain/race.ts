import { z } from "zod";
import {
  countryCodeSchema,
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";
import { raceSessionSchema, raceStatusSchema } from "./enums";

export const raceSchema = z
  .object({
    id: entityIdSchema,
    seasonId: entityIdSchema,
    name: titleSchema,
    circuit: titleSchema,
    countryCode: countryCodeSchema,
    round: z.number().int().positive(),
    scheduledAt: isoDateTimeSchema,
    timezone: z.string().trim().min(1).max(64),
    status: raceStatusSchema,
    sessions: z.array(raceSessionSchema).min(1),
    sprint: z.boolean(),
    doublePoints: z.boolean(),
    mystery: z.boolean(),
  })
  .strict()
  .refine(
    (race) => new Set(race.sessions).size === race.sessions.length,
    {
      message: "Race sessions must be unique.",
      path: ["sessions"],
    },
  );

export type Race = z.infer<typeof raceSchema>;
