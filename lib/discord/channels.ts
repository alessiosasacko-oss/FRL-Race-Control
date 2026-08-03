import "server-only";

import {
  ChannelType,
  PermissionFlagsBits,
  type Guild,
  type GuildBasedChannel,
} from "discord.js";
import { logger } from "@/lib/observability/logger";
import type {
  DiscordChannelCatalog,
  DiscordChannelCatalogState,
  DiscordChannelOption,
} from "./channel-matrix";
import { getConnectedDiscordClient } from "./client";

const CHANNEL_CACHE_MS = 45_000;
const channelCatalogCache = new Map<
  string,
  { expiresAt: number; catalog: DiscordChannelCatalog }
>();

export type DiscordChannelErrorCode =
  | "BOT_TOKEN_MISSING"
  | "GUILD_ID_MISSING"
  | "GUILD_ID_MISMATCH"
  | "GUILD_NOT_FOUND"
  | "CHANNELS_UNAVAILABLE";

export class DiscordChannelCatalogError extends Error {
  constructor(public readonly code: DiscordChannelErrorCode) {
    super(code);
    this.name = "DiscordChannelCatalogError";
  }
}

export function discordChannelErrorMessage(code: DiscordChannelErrorCode): string {
  switch (code) {
    case "BOT_TOKEN_MISSING":
      return "Discord-Bot-Token fehlt.";
    case "GUILD_ID_MISSING":
      return "Discord-Server-ID fehlt.";
    case "GUILD_ID_MISMATCH":
      return "Der konfigurierte Discord-Server stimmt nicht mit DISCORD_GUILD_ID überein.";
    case "GUILD_NOT_FOUND":
      return "Der Bot ist nicht Mitglied dieses Servers.";
    case "CHANNELS_UNAVAILABLE":
      return "Die Discord-Kanäle konnten nicht geladen werden.";
  }
}

function resolveGuildId(storedGuildId?: string | null): string {
  const environmentGuildId = process.env.DISCORD_GUILD_ID?.trim();
  const databaseGuildId = storedGuildId?.trim();
  if (!environmentGuildId && !databaseGuildId) {
    throw new DiscordChannelCatalogError("GUILD_ID_MISSING");
  }
  if (environmentGuildId && databaseGuildId && environmentGuildId !== databaseGuildId) {
    throw new DiscordChannelCatalogError("GUILD_ID_MISMATCH");
  }
  return environmentGuildId ?? databaseGuildId!;
}

function categoryName(channel: GuildBasedChannel, guild: Guild): string {
  if (!("parentId" in channel) || !channel.parentId) return "SONSTIGES";
  return guild.channels.cache.get(channel.parentId)?.name.toLocaleUpperCase("de-DE") ?? "SONSTIGES";
}

function channelOption(channel: GuildBasedChannel, guild: Guild): DiscordChannelOption {
  const member = guild.members.me;
  const permissions = member && "permissionsFor" in channel
    ? channel.permissionsFor(member)
    : null;
  const visible = Boolean(permissions?.has(PermissionFlagsBits.ViewChannel));
  const canSend = Boolean(permissions?.has(PermissionFlagsBits.SendMessages));
  const canAttach = Boolean(permissions?.has(PermissionFlagsBits.AttachFiles));
  const kind = channel.type === ChannelType.GuildText
    ? "TEXT"
    : channel.type === ChannelType.GuildAnnouncement
      ? "ANNOUNCEMENT"
      : "UNSUPPORTED";
  const supported = kind !== "UNSUPPORTED";
  const unavailableReason = !supported
    ? "Dieser Channeltyp wird nicht unterstützt."
    : !visible
      ? "Der Bot kann diesen Kanal nicht sehen."
      : !canSend
        ? "Der Bot darf in diesem Kanal keine Nachrichten senden."
        : !canAttach
          ? "Der Bot darf in diesem Kanal keine Dateien anhängen."
          : null;
  return {
    id: channel.id,
    name: channel.name,
    categoryId: "parentId" in channel ? channel.parentId : null,
    categoryName: categoryName(channel, guild),
    kind,
    visible,
    canSend,
    canAttach,
    selectable: supported && visible && canSend && canAttach,
    unavailableReason,
  };
}

export function invalidateDiscordChannelCatalog(guildId?: string): void {
  if (guildId) channelCatalogCache.delete(guildId);
  else channelCatalogCache.clear();
}

export async function getDiscordChannelCatalog(
  storedGuildId?: string | null,
  options: { force?: boolean } = {},
): Promise<DiscordChannelCatalog> {
  if (!process.env.DISCORD_BOT_TOKEN?.trim()) {
    throw new DiscordChannelCatalogError("BOT_TOKEN_MISSING");
  }
  const guildId = resolveGuildId(storedGuildId);
  if (!options.force) {
    const cached = channelCatalogCache.get(guildId);
    if (cached && cached.expiresAt > Date.now()) return cached.catalog;
  }

  try {
    const client = await getConnectedDiscordClient();
    const guild = await client.guilds.fetch(guildId).catch(() => null);
    if (!guild) throw new DiscordChannelCatalogError("GUILD_NOT_FOUND");
    await guild.members.fetchMe();
    const fetched = await guild.channels.fetch();
    const channels = [...fetched.values()]
      .filter((channel) => channel !== null)
      .map((channel) => channelOption(channel, guild));
    const catalog: DiscordChannelCatalog = {
      guildId: guild.id,
      guildName: guild.name,
      channels,
      loadedAt: new Date().toISOString(),
    };
    channelCatalogCache.set(guildId, {
      expiresAt: Date.now() + CHANNEL_CACHE_MS,
      catalog,
    });
    return catalog;
  } catch (error: unknown) {
    if (error instanceof DiscordChannelCatalogError) throw error;
    logger.error("Discord channel catalog loading failed", error, { phase: "channel-catalog" });
    throw new DiscordChannelCatalogError("CHANNELS_UNAVAILABLE");
  }
}

export async function getDiscordChannelCatalogState(
  storedGuildId?: string | null,
  options: { force?: boolean } = {},
): Promise<DiscordChannelCatalogState> {
  try {
    return {
      status: "success",
      message: "Discord-Kanäle wurden geladen.",
      catalog: await getDiscordChannelCatalog(storedGuildId, options),
    };
  } catch (error: unknown) {
    const code = error instanceof DiscordChannelCatalogError
      ? error.code
      : "CHANNELS_UNAVAILABLE";
    return { status: "error", message: discordChannelErrorMessage(code), catalog: null };
  }
}

export async function requireSelectableDiscordChannel(
  storedGuildId: string,
  channelId: string,
  options: { force?: boolean } = { force: true },
): Promise<{ catalog: DiscordChannelCatalog; channel: DiscordChannelOption }> {
  const catalog = await getDiscordChannelCatalog(storedGuildId, options);
  const channel = catalog.channels.find((candidate) => candidate.id === channelId);
  if (!channel) throw new Error("Der gewählte Kanal existiert nicht mehr.");
  if (!channel.visible) throw new Error("Der Bot kann diesen Kanal nicht sehen.");
  if (!channel.canSend) throw new Error("Der Bot darf in diesem Kanal keine Nachrichten senden.");
  if (!channel.canAttach) throw new Error("Der Bot darf in diesem Kanal keine Dateien anhängen.");
  if (!channel.selectable) throw new Error(channel.unavailableReason ?? "Dieser Channeltyp wird nicht unterstützt.");
  return { catalog, channel };
}
