import { z } from "zod";
import {
  announcementStatusSchema,
  announcementTargetSchema,
  automationJobStatusSchema,
  automationJobTypeSchema,
  discordChannelPurposeSchema,
  discordDeliveryStatusSchema,
  notificationPrioritySchema,
  roleSchema,
  webhookEventStatusSchema,
  webhookEventTypeSchema,
} from "./enums";
import {
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";

export const discordGuildSettingsSchema = z.object({
  id: entityIdSchema,
  guildId: z.string().regex(/^\d{17,20}$/),
  guildName: titleSchema,
  enabled: z.boolean(),
  lastConnectedAt: isoDateTimeSchema.nullable(),
  lastHeartbeatAt: isoDateTimeSchema.nullable(),
});

export const discordChannelMappingSchema = z.object({
  id: entityIdSchema,
  guildSettingsId: entityIdSchema,
  leagueId: entityIdSchema.nullable(),
  purpose: discordChannelPurposeSchema,
  channelId: z.string().regex(/^\d{17,20}$/),
  enabled: z.boolean(),
});

export const discordRoleMappingSchema = z.object({
  id: entityIdSchema,
  guildSettingsId: entityIdSchema,
  role: roleSchema,
  discordRoleId: z.string().regex(/^\d{17,20}$/),
  enabled: z.boolean(),
});

export const announcementSchema = z.object({
  id: entityIdSchema,
  createdByUserId: entityIdSchema,
  title: titleSchema,
  content: z.string().trim().min(1).max(10_000),
  href: z.string().regex(/^\/(?!\/)/).max(500).nullable(),
  priority: notificationPrioritySchema,
  target: announcementTargetSchema,
  status: announcementStatusSchema,
  pinned: z.boolean(),
  scheduledFor: isoDateTimeSchema,
  publishedAt: isoDateTimeSchema.nullable(),
});

export const automationJobSchema = z.object({
  id: entityIdSchema,
  type: automationJobTypeSchema,
  name: titleSchema,
  status: automationJobStatusSchema,
  enabled: z.boolean(),
  intervalMinutes: z.number().int().positive(),
  nextRunAt: isoDateTimeSchema,
  lastRunAt: isoDateTimeSchema.nullable(),
});

export const discordDeliverySchema = z.object({
  id: entityIdSchema,
  purpose: discordChannelPurposeSchema,
  status: discordDeliveryStatusSchema,
  scheduledFor: isoDateTimeSchema,
  sentAt: isoDateTimeSchema.nullable(),
  attempts: z.number().int().nonnegative(),
});

export const webhookEventSchema = z.object({
  id: entityIdSchema,
  type: webhookEventTypeSchema,
  source: z.string().trim().min(1).max(80),
  status: webhookEventStatusSchema,
  dedupeKey: z.string().trim().min(1).max(190),
  createdAt: isoDateTimeSchema,
});

export type DiscordGuildSettings = z.infer<
  typeof discordGuildSettingsSchema
>;
export type DiscordChannelMapping = z.infer<
  typeof discordChannelMappingSchema
>;
export type DiscordRoleMapping = z.infer<
  typeof discordRoleMappingSchema
>;
export type Announcement = z.infer<typeof announcementSchema>;
export type AutomationJob = z.infer<typeof automationJobSchema>;
export type DiscordDelivery = z.infer<typeof discordDeliverySchema>;
export type WebhookEvent = z.infer<typeof webhookEventSchema>;
