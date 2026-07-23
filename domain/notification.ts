import { z } from "zod";
import {
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";
import { notificationTypeSchema } from "./enums";

export const notificationSchema = z
  .object({
    id: entityIdSchema,
    userId: entityIdSchema,
    type: notificationTypeSchema,
    title: titleSchema,
    message: z.string().trim().min(1).max(1000),
    href: z
      .string()
      .regex(/^\/(?!\/)/, "Notification links must be internal paths.")
      .nullable(),
    readAt: isoDateTimeSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type Notification = z.infer<typeof notificationSchema>;
