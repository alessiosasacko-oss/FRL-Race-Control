import { z } from "zod";
import {
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";

export const driverStandingSchema = z
  .object({
    position: z.number().int().positive(),
    driverId: entityIdSchema,
    points: z.number().nonnegative(),
    wins: z.number().int().nonnegative(),
    podiums: z.number().int().nonnegative(),
    penaltyPoints: z.number().nonnegative(),
  })
  .strict();

export const teamStandingSchema = z
  .object({
    position: z.number().int().positive(),
    teamId: entityIdSchema,
    points: z.number().nonnegative(),
    wins: z.number().int().nonnegative(),
  })
  .strict();

export const championshipSchema = z
  .object({
    id: entityIdSchema,
    seasonId: entityIdSchema,
    name: titleSchema,
    driverStandings: z.array(driverStandingSchema),
    teamStandings: z.array(teamStandingSchema),
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type DriverStanding = z.infer<typeof driverStandingSchema>;
export type TeamStanding = z.infer<typeof teamStandingSchema>;
export type Championship = z.infer<typeof championshipSchema>;
