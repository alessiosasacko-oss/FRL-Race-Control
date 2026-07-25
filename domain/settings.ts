import { z } from "zod";
import {
  entityIdSchema,
  isoDateTimeSchema,
} from "./common";
import { notificationTypeSchema } from "./enums";

export const userSettingsSchema = z
  .object({
    id: entityIdSchema,
    userId: entityIdSchema,
    inAppEnabled: z.boolean(),
    inAppCategories: z.array(notificationTypeSchema),
    emailEnabled: z.boolean(),
    emailCategories: z.array(notificationTypeSchema),
    quietHoursEnabled: z.boolean(),
    quietHoursStartMinute: z.number().int().min(0).max(1439).nullable(),
    quietHoursEndMinute: z.number().int().min(0).max(1439).nullable(),
    timezone: z.string().trim().min(1).max(80),
    theme: z.string().trim().min(1).max(32),
    language: z.string().trim().min(1).max(16),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .refine(
    (settings) =>
      !settings.quietHoursEnabled ||
      (settings.quietHoursStartMinute !== null &&
        settings.quietHoursEndMinute !== null),
    {
      message: "Quiet hours require a start and end time.",
      path: ["quietHoursStartMinute"],
    },
  );

export type UserSettings = z.infer<typeof userSettingsSchema>;
