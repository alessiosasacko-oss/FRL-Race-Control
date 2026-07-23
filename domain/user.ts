import { z } from "zod";
import {
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";
import { roleSchema } from "./enums";

export const userSchema = z
  .object({
    id: entityIdSchema,
    discordId: z.string().regex(/^\d+$/).nullable(),
    displayName: titleSchema,
    avatarUrl: z.url().nullable(),
    roles: z.array(roleSchema).min(1),
    driverId: entityIdSchema.nullable(),
    active: z.boolean(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .refine((user) => new Set(user.roles).size === user.roles.length, {
    message: "User roles must be unique.",
    path: ["roles"],
  });

export type User = z.infer<typeof userSchema>;
