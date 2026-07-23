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
  })
  .strict();

export type League = z.infer<typeof leagueSchema>;
