import "server-only";
import {
  Client,
  Events,
  GatewayIntentBits,
  type ClientOptions,
} from "discord.js";
import { getPrismaClient } from "@/lib/db/prisma";
import { logger } from "@/lib/observability/logger";

declare global {
  var frlDiscordClient: Client | undefined;
  var frlDiscordLogin: Promise<Client> | undefined;
}

function clientOptions(): ClientOptions {
  return {
    intents: [
      GatewayIntentBits.Guilds,
      GatewayIntentBits.GuildMembers,
    ],
  };
}

async function updateConnection(
  client: Client,
  error?: unknown,
): Promise<void> {
  const guildIds = [...client.guilds.cache.keys()];
  if (guildIds.length === 0) return;

  await getPrismaClient().discordGuildSettings.updateMany({
    where: { guildId: { in: guildIds } },
    data: error
      ? {
          lastError:
            error instanceof Error ? error.message.slice(0, 2000) : String(error),
        }
      : {
          botUserId: client.user?.id,
          botUsername: client.user?.username,
          lastConnectedAt: new Date(),
          lastHeartbeatAt: new Date(),
          lastError: null,
        },
  });
}

function createClient(): Client {
  const client = new Client(clientOptions());

  client.once(Events.ClientReady, (readyClient) => {
    logger.info("Discord bot connected", {
      botUserId: readyClient.user.id,
      guildCount: readyClient.guilds.cache.size,
    });
    void updateConnection(readyClient).catch((error: unknown) =>
      logger.error("Discord connection state could not be persisted", error),
    );
  });
  client.on(Events.Warn, (message) =>
    logger.warn("Discord client warning", { message }),
  );
  client.on(Events.Error, (error) => {
    logger.error("Discord client error", error);
    void updateConnection(client, error).catch(() => undefined);
  });
  client.on(Events.ShardReconnecting, (shardId) =>
    logger.warn("Discord shard reconnecting", { shardId }),
  );
  client.on(Events.ShardResume, (shardId, replayedEvents) =>
    logger.info("Discord shard resumed", { shardId, replayedEvents }),
  );

  return client;
}

export async function getConnectedDiscordClient(): Promise<Client> {
  const token = process.env.DISCORD_BOT_TOKEN;
  if (!token) throw new Error("DISCORD_BOT_TOKEN is not configured.");

  globalThis.frlDiscordClient ??= createClient();
  const client = globalThis.frlDiscordClient;
  if (client.isReady()) return client;

  globalThis.frlDiscordLogin ??= client
    .login(token)
    .then(() => client)
    .catch((error: unknown) => {
      globalThis.frlDiscordLogin = undefined;
      throw error;
    });
  return globalThis.frlDiscordLogin;
}

export async function stopDiscordClient(): Promise<void> {
  const client = globalThis.frlDiscordClient;
  if (!client) return;
  client.destroy();
  globalThis.frlDiscordClient = undefined;
  globalThis.frlDiscordLogin = undefined;
  logger.info("Discord bot stopped");
}
