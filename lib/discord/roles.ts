import "server-only";
import { WebhookEventType } from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { recordWebhookEvent } from "@/lib/integrations/events";
import { logger } from "@/lib/observability/logger";
import { getConnectedDiscordClient } from "./client";

export async function synchronizeDiscordRoles(): Promise<{
  synchronized: number;
  failed: number;
}> {
  const prisma = getPrismaClient();
  const client = await getConnectedDiscordClient();
  const settings = await prisma.discordGuildSettings.findMany({
    where: { enabled: true },
    include: {
      roleMappings: { where: { enabled: true } },
    },
  });
  const users = await prisma.user.findMany({
    where: {
      active: true,
      discordId: { not: null },
      discordVerifiedAt: { not: null },
    },
    select: {
      id: true,
      discordId: true,
      roles: true,
    },
  });
  let synchronized = 0;
  let failed = 0;

  for (const guildSettings of settings) {
    const guild = await client.guilds.fetch(guildSettings.guildId);
    const managedRoleIds = new Set(
      guildSettings.roleMappings.map((mapping) => mapping.discordRoleId),
    );

    for (const user of users) {
      try {
        const member = await guild.members.fetch(user.discordId as string);
        const desiredRoleIds = new Set(
          guildSettings.roleMappings
            .filter((mapping) => user.roles.includes(mapping.role))
            .map((mapping) => mapping.discordRoleId),
        );
        const add = [...desiredRoleIds].filter(
          (roleId) => !member.roles.cache.has(roleId),
        );
        const remove = [...managedRoleIds].filter(
          (roleId) =>
            member.roles.cache.has(roleId) && !desiredRoleIds.has(roleId),
        );
        if (add.length > 0) await member.roles.add(add, "FRL role sync");
        if (remove.length > 0) {
          await member.roles.remove(remove, "FRL role sync");
        }

        await prisma.user.update({
          where: { id: user.id },
          data: {
            discordUsername: member.user.username,
            discordGlobalName: member.user.globalName,
            discordGuildNickname: member.nickname,
            discordAvatarUrl: member.displayAvatarURL(),
            discordSyncedAt: new Date(),
          },
        });
        synchronized += 1;
      } catch (error: unknown) {
        failed += 1;
        logger.error("Discord role synchronization failed", error, {
          guildId: guildSettings.guildId,
          userId: user.id,
        });
      }
    }

    await prisma.discordGuildSettings.update({
      where: { id: guildSettings.id },
      data: {
        guildName: guild.name,
        lastHeartbeatAt: new Date(),
        lastError: failed > 0 ? `${failed} member sync(s) failed.` : null,
      },
    });
  }

  await recordWebhookEvent(prisma, {
    type: WebhookEventType.DiscordSynchronized,
    source: "discord-role-sync",
    dedupeKey: `discord-sync:${new Date().toISOString().slice(0, 16)}`,
    payload: { synchronized, failed },
  });
  return { synchronized, failed };
}
