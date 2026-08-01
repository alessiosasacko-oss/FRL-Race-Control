import { z } from "zod";
import {
  entityIdSchema,
  hexColorSchema,
  titleSchema,
} from "./common";

export const teamSchema = z
  .object({
    id: entityIdSchema,
    leagueId: entityIdSchema,
    seasonId: entityIdSchema,
    organizationId: entityIdSchema.nullable().default(null),
    principalUserId: entityIdSchema.nullable(),
    name: titleSchema,
    shortName: z.string().trim().min(2).max(12),
    color: hexColorSchema,
    secondaryColor: hexColorSchema.nullable().default(null),
    contrastColor: hexColorSchema.nullable().default(null),
    logoUrl: z.string().url().nullable().default(null),
    active: z.boolean(),
    archivedAt: z.coerce.date().nullable().default(null),
  })
  .strict();

export type Team = z.infer<typeof teamSchema>;

export const teamOrganizationSchema = z
  .object({
    id: entityIdSchema,
    name: titleSchema,
    shortName: z.string().trim().min(2).max(12),
    color: hexColorSchema,
    secondaryColor: hexColorSchema.nullable().default(null),
    contrastColor: hexColorSchema.nullable().default(null),
    logoUrl: z.string().url().nullable().default(null),
    active: z.boolean(),
    archivedAt: z.coerce.date().nullable().default(null),
  })
  .strict();

export type TeamOrganization = z.infer<
  typeof teamOrganizationSchema
>;
