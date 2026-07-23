import { z } from "zod";
import {
  entityIdSchema,
  isoDateSchema,
  titleSchema,
} from "./common";

export const seasonSchema = z
  .object({
    id: entityIdSchema,
    leagueId: entityIdSchema,
    name: titleSchema,
    startsOn: isoDateSchema,
    endsOn: isoDateSchema,
    active: z.boolean(),
    archivedAt: z.iso.datetime().nullable(),
  })
  .strict()
  .refine((season) => season.endsOn >= season.startsOn, {
    message: "Season end date must not be before its start date.",
    path: ["endsOn"],
  });

export type Season = z.infer<typeof seasonSchema>;
