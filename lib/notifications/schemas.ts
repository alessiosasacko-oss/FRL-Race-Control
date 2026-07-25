import { z } from "zod";
import {
  NotificationPriority,
  NotificationType,
  notificationPrioritySchema,
  notificationTypeSchema,
} from "@/domain";

const firstValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

export const notificationListQuerySchema = z.object({
  q: z
    .preprocess(firstValue, z.string().trim().max(100).optional())
    .catch("")
    .transform((value) => value ?? ""),
  state: z
    .preprocess(
      firstValue,
      z.enum(["all", "unread", "read", "archived"]),
    )
    .catch("all"),
  type: z
    .preprocess(firstValue, notificationTypeSchema.optional())
    .catch(undefined),
  priority: z
    .preprocess(firstValue, notificationPrioritySchema.optional())
    .catch(undefined),
  page: z
    .preprocess(firstValue, z.coerce.number().int().positive())
    .catch(1),
});

const categoryArray = z
  .array(notificationTypeSchema)
  .transform((items) => [...new Set(items)]);

const optionalTime = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z
    .string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/)
    .nullable(),
);

export const notificationSettingsSchema = z
  .object({
    inAppEnabled: z.boolean(),
    inAppCategories: categoryArray,
    emailEnabled: z.boolean(),
    emailCategories: categoryArray,
    quietHoursEnabled: z.boolean(),
    quietHoursStart: optionalTime,
    quietHoursEnd: optionalTime,
    timezone: z.string().trim().min(1).max(80),
    theme: z.enum(["dark"]),
    language: z.enum(["de"]),
  })
  .superRefine((settings, context) => {
    if (
      settings.quietHoursEnabled &&
      (!settings.quietHoursStart || !settings.quietHoursEnd)
    ) {
      context.addIssue({
        code: "custom",
        path: ["quietHoursStart"],
        message: "Für Ruhezeiten werden Start und Ende benötigt.",
      });
    }
  });

export const profileSettingsSchema = z.object({
  displayName: z.string().trim().min(2).max(160),
  flag: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().trim().min(1).max(16).nullable(),
  ),
  driverNumber: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.coerce.number().int().min(1).max(999).nullable(),
  ),
});

export const announcementSchema = z.object({
  title: z.string().trim().min(3).max(160),
  message: z.string().trim().min(3).max(1000),
  href: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z
      .string()
      .regex(/^\/(?!\/)/, "Nur interne Links sind erlaubt.")
      .max(500)
      .nullable(),
  ),
  priority: z.enum(NotificationPriority),
  type: z
    .enum([
      NotificationType.AdminAnnouncement,
      NotificationType.System,
      NotificationType.QualifyingBan,
      NotificationType.RaceBan,
    ])
    .default(NotificationType.AdminAnnouncement),
  email: z.boolean(),
});
