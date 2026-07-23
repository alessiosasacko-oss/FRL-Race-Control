import { z } from "zod";
import {
  countryCodeSchema,
  entityIdSchema,
  titleSchema,
} from "./common";

export const driverSchema = z
  .object({
    id: entityIdSchema,
    userId: entityIdSchema.nullable(),
    name: titleSchema,
    number: z.number().int().min(1).max(999),
    flag: z.string().trim().min(1).max(16),
    countryCode: countryCodeSchema,
    teamId: entityIdSchema.nullable(),
    leagueId: entityIdSchema,
    active: z.boolean(),
  })
  .strict();

export type Driver = z.infer<typeof driverSchema>;
