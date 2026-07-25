import { z } from "zod";
import {
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";
import {
  notificationPrioritySchema,
  notificationTypeSchema,
} from "./enums";

export const notificationSchema = z
  .object({
    id: entityIdSchema,
    userId: entityIdSchema,
    type: notificationTypeSchema,
    priority: notificationPrioritySchema,
    title: titleSchema,
    message: z.string().trim().min(1).max(1000),
    href: z
      .string()
      .regex(/^\/(?!\/)/, "Notification links must be internal paths.")
      .nullable(),
    readAt: isoDateTimeSchema.nullable(),
    archivedAt: isoDateTimeSchema.nullable(),
    relatedEntityType: z.string().trim().max(80).nullable(),
    relatedEntityId: entityIdSchema.nullable(),
    dedupeKey: z.string().trim().max(190).nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict()
  .refine(
    (notification) =>
      (notification.relatedEntityType === null) ===
      (notification.relatedEntityId === null),
    {
      message: "Related entity type and ID must be set together.",
      path: ["relatedEntityId"],
    },
  );

export type Notification = z.infer<typeof notificationSchema>;
