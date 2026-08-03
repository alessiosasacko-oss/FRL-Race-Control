import { z } from "zod";

export const discordMessagePayloadSchema = z.object({
  title: z.string().trim().min(1).max(256),
  description: z.string().trim().min(1).max(4096),
  href: z.string().max(500).nullable().optional(),
  color: z.string().regex(/^#[0-9A-F]{6}$/i).optional(),
  iconUrl: z.url().nullable().optional(),
  attachmentUrl: z.url().max(1000).nullable().optional(),
  attachmentName: z.string().trim().regex(/^[a-z0-9][a-z0-9._-]{0,99}$/i).optional(),
  league: z.string().max(160).nullable().optional(),
  season: z.string().max(160).nullable().optional(),
  race: z.string().max(160).nullable().optional(),
  track: z.string().max(160).nullable().optional(),
  fields: z
    .array(
      z.object({
        name: z.string().max(256),
        value: z.string().max(1024),
        inline: z.boolean().optional(),
      }),
    )
    .max(10)
    .optional(),
});

export type DiscordMessagePayload = z.infer<
  typeof discordMessagePayloadSchema
>;
