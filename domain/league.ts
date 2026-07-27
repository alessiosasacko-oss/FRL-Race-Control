import { z } from "zod";
import {
  descriptionSchema,
  entityIdSchema,
  titleSchema,
} from "./common";

export const leagueSchema = z
  .object({
    id: entityIdSchema,
    name: titleSchema,
    code: z.string().trim().min(2).max(12),
    description: descriptionSchema.nullable(),
    currentSeasonId: entityIdSchema.nullable(),
    active: z.boolean(),
    raceWeekday: z.number().int().min(1).max(7),
    raceStartMinute: z.number().int().min(0).max(1439),
    raceTimezone: z.string().trim().min(1).max(64),
    defaultAttendanceDeadlineMinutes: z
      .number()
      .int()
      .nonnegative()
      .nullable(),
    displayOrder: z.number().int().nonnegative(),
  })
  .strict();

export type League = z.infer<typeof leagueSchema>;
