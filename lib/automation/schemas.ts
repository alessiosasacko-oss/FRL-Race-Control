import { z } from "zod";
import {
  AnnouncementTarget,
  DiscordChannelPurpose,
  NotificationPriority,
  Role,
} from "@/domain";

const snowflakeSchema = z
  .string()
  .trim()
  .regex(/^\d{17,20}$/, "Eine Discord-ID muss 17 bis 20 Ziffern enthalten.");

export const announcementInputSchema = z.object({
  title: z.string().trim().min(3).max(160),
  content: z.string().trim().min(3).max(10_000),
  href: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().regex(/^\/(?!\/)/, "Nur interne Links sind erlaubt.").max(500).nullable(),
  ),
  priority: z.enum(NotificationPriority),
  target: z.enum(AnnouncementTarget),
  pinned: z.boolean(),
  scheduledFor: z.string().trim().min(1),
  timezone: z.string().trim().min(1).max(80),
});

export const discordGuildSettingsInputSchema = z.object({
  guildId: snowflakeSchema,
  guildName: z.string().trim().min(2).max(160),
  enabled: z.boolean(),
});

export const discordChannelMappingInputSchema = z.object({
  guildSettingsId: z.coerce.number().int().positive(),
  leagueId: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.coerce.number().int().positive().nullable(),
  ),
  purpose: z.enum(DiscordChannelPurpose),
  channelId: snowflakeSchema,
  channelName: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().trim().max(160).nullable(),
  ),
  enabled: z.boolean(),
});

export const discordRoleMappingInputSchema = z.object({
  guildSettingsId: z.coerce.number().int().positive(),
  role: z.enum(Role),
  discordRoleId: snowflakeSchema,
  discordRoleName: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z.string().trim().max(160).nullable(),
  ),
  enabled: z.boolean(),
});

export const automationJobIdSchema = z.coerce.number().int().positive();
