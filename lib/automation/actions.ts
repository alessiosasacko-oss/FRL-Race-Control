"use server";

import { revalidatePath } from "next/cache";
import type { DiscordChannelPurpose } from "@/domain";
import {
  AnnouncementStatus,
  AutomationJobStatus,
  DiscordDeliveryStatus,
  GraphicRenderStatus,
} from "@/generated/prisma/client";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { writeSystemAudit } from "@/lib/audit/system";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import { zonedLocalToUtc } from "@/lib/master-data/timezone";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  announcementInputSchema,
  automationJobIdSchema,
  discordChannelMappingInputSchema,
  discordGuildSettingsInputSchema,
  discordRoleMappingInputSchema,
  discordChannelTestSchema,
  leagueDiscordChannelMatrixSchema,
} from "./schemas";
import type { AutomationActionState, DiscordChannelReloadState } from "./types";
import { resultChannelPurposes, standingsChannelPurposes } from "@/lib/discord/channel-matrix";
import { DiscordChannelCatalogError, discordChannelErrorMessage, getDiscordChannelCatalogState } from "@/lib/discord/channels";
import { sendDiscordChannelTest } from "@/lib/discord/channel-test";

function errorState(
  message: string,
  fieldErrors?: Record<string, string[]>,
): AutomationActionState {
  return { status: "error", message, fieldErrors };
}

function successState(message: string): AutomationActionState {
  return { status: "success", message };
}

function safeDiscordError(error: unknown, fallback: string): string {
  if (error instanceof DiscordChannelCatalogError) return discordChannelErrorMessage(error.code);
  if (error instanceof Error && /^(Der Bot|Der gewählte Kanal|Dieser Channeltyp|Die Discord-Testnachricht)/.test(error.message)) return error.message;
  return fallback;
}

function validationErrors(error: {
  flatten(): { fieldErrors: unknown };
}): Record<string, string[]> {
  return error.flatten().fieldErrors as Record<string, string[]>;
}

async function revalidateAutomation(): Promise<void> {
  revalidatePath("/admin/automation");
  revalidatePath("/admin/announcements");
  revalidatePath("/notifications");
  revalidatePath("/dashboard");
  await touchAppDataRevisionSafely(getPrismaClient(), ["automation", "notifications"]);
}

export async function createAnnouncementAction(
  _previousState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const rateLimit = consumeRateLimit(`announcement:${actor.id}`, {
    limit: 10,
    windowMs: 15 * 60 * 1000,
  });
  if (!rateLimit.allowed) {
    return errorState(
      `Zu viele Veröffentlichungen. Bitte in ${rateLimit.retryAfterSeconds} Sekunden erneut versuchen.`,
    );
  }

  const parsed = announcementInputSchema.safeParse({
    title: formData.get("title"),
    content: formData.get("content"),
    href: formData.get("href"),
    priority: formData.get("priority"),
    target: formData.get("target"),
    pinned: formData.get("pinned") === "on",
    scheduledFor: formData.get("scheduledFor"),
    timezone: formData.get("timezone") ?? "Europe/Berlin",
  });
  if (!parsed.success) {
    return errorState(
      "Bitte prüfe die Mitteilung.",
      validationErrors(parsed.error),
    );
  }

  let scheduledFor: Date;
  try {
    scheduledFor = zonedLocalToUtc(
      parsed.data.scheduledFor,
      parsed.data.timezone,
    );
  } catch {
    return errorState("Der Veröffentlichungszeitpunkt ist ungültig.");
  }

  try {
    await getPrismaClient().$transaction(async (transaction) => {
      const announcement = await transaction.announcement.create({
        data: {
          createdByUserId: actor.id,
          title: parsed.data.title,
          content: parsed.data.content,
          href: parsed.data.href,
          priority: parsed.data.priority,
          target: parsed.data.target,
          pinned: parsed.data.pinned,
          scheduledFor,
        },
      });
      await writeSystemAudit(transaction, {
        actorId: actor.id,
        action: "ANNOUNCEMENT_CREATED",
        entityType: "Announcement",
        entityId: announcement.id,
        metadata: {
          target: announcement.target,
          scheduledFor: announcement.scheduledFor.toISOString(),
          pinned: announcement.pinned,
        },
      });
    });
  } catch {
    return errorState("Die Mitteilung konnte nicht geplant werden.");
  }

  await revalidateAutomation();
  return successState(
    scheduledFor <= new Date()
      ? "Die Mitteilung ist zur sofortigen Veröffentlichung eingeplant."
      : "Die Mitteilung wurde geplant.",
  );
}

export async function saveDiscordGuildAction(
  _previousState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const parsed = discordGuildSettingsInputSchema.safeParse({
    guildId: formData.get("guildId"),
    guildName: formData.get("guildName"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) {
    return errorState(
      "Bitte prüfe die Server-Konfiguration.",
      validationErrors(parsed.error),
    );
  }

  await getPrismaClient().$transaction(async (transaction) => {
    const guild = await transaction.discordGuildSettings.upsert({
      where: { guildId: parsed.data.guildId },
      update: {
        guildName: parsed.data.guildName,
        enabled: parsed.data.enabled,
      },
      create: parsed.data,
    });
    await writeSystemAudit(transaction, {
      actorId: actor.id,
      action: "DISCORD_GUILD_CONFIGURED",
      entityType: "DiscordGuildSettings",
      entityId: guild.id,
      metadata: { enabled: guild.enabled, guildId: guild.guildId },
    });
  });
  await revalidateAutomation();
  return successState("Discord-Server wurde gespeichert.");
}

export async function saveDiscordChannelAction(
  _previousState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const parsed = discordChannelMappingInputSchema.safeParse({
    guildSettingsId: formData.get("guildSettingsId"),
    leagueId: formData.get("leagueId"),
    purpose: formData.get("purpose"),
    channelId: formData.get("channelId"),
    channelName: formData.get("channelName"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) {
    return errorState(
      "Bitte prüfe die Kanalzuordnung.",
      validationErrors(parsed.error),
    );
  }
  const scopeKey = parsed.data.leagueId
    ? `LEAGUE:${parsed.data.leagueId}`
    : "GLOBAL";
  await getPrismaClient().$transaction(async (transaction) => {
    const channel = await transaction.discordChannelMapping.upsert({
      where: {
        guildSettingsId_scopeKey_purpose: {
          guildSettingsId: parsed.data.guildSettingsId,
          scopeKey,
          purpose: parsed.data.purpose,
        },
      },
      update: {
        leagueId: parsed.data.leagueId,
        channelId: parsed.data.channelId,
        channelName: parsed.data.channelName,
        enabled: parsed.data.enabled,
      },
      create: { ...parsed.data, scopeKey },
    });
    await writeSystemAudit(transaction, {
      actorId: actor.id,
      action: "DISCORD_CHANNEL_CONFIGURED",
      entityType: "DiscordChannelMapping",
      entityId: channel.id,
      metadata: {
        guildSettingsId: channel.guildSettingsId,
        purpose: channel.purpose,
        scopeKey: channel.scopeKey,
      },
    });
  });
  await revalidateAutomation();
  return successState("Discord-Kanal wurde zugeordnet.");
}

export async function saveDiscordRoleAction(
  _previousState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const parsed = discordRoleMappingInputSchema.safeParse({
    guildSettingsId: formData.get("guildSettingsId"),
    role: formData.get("role"),
    discordRoleId: formData.get("discordRoleId"),
    discordRoleName: formData.get("discordRoleName"),
    enabled: formData.get("enabled") === "on",
  });
  if (!parsed.success) {
    return errorState(
      "Bitte prüfe die Rollenzuordnung.",
      validationErrors(parsed.error),
    );
  }
  await getPrismaClient().$transaction(async (transaction) => {
    const role = await transaction.discordRoleMapping.upsert({
      where: {
        guildSettingsId_role: {
          guildSettingsId: parsed.data.guildSettingsId,
          role: parsed.data.role,
        },
      },
      update: {
        discordRoleId: parsed.data.discordRoleId,
        discordRoleName: parsed.data.discordRoleName,
        enabled: parsed.data.enabled,
      },
      create: parsed.data,
    });
    await writeSystemAudit(transaction, {
      actorId: actor.id,
      action: "DISCORD_ROLE_CONFIGURED",
      entityType: "DiscordRoleMapping",
      entityId: role.id,
      metadata: {
        guildSettingsId: role.guildSettingsId,
        role: role.role,
      },
    });
  });
  await revalidateAutomation();
  return successState("Discord-Rolle wurde zugeordnet.");
}

export async function retryAutomationJobAction(
  jobIdInput: number,
): Promise<void> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const jobId = automationJobIdSchema.parse(jobIdInput);
  const prisma = getPrismaClient();
  const job = await prisma.automationJob.findUnique({
    where: { id: jobId },
    select: { id: true, status: true },
  });
  if (!job || job.status === AutomationJobStatus.RUNNING) return;

  await prisma.$transaction([
    prisma.automationJob.update({
      where: { id: jobId },
      data: {
        enabled: true,
        status: AutomationJobStatus.SCHEDULED,
        nextRunAt: new Date(),
        lockedAt: null,
        lastError: null,
      },
    }),
    prisma.automationJobRun.create({
      data: {
        jobId,
        retryActorId: actor.id,
        status: AutomationJobStatus.SCHEDULED,
        finishedAt: new Date(),
        result: { manuallyQueued: true },
      },
    }),
    prisma.systemAuditLog.create({
      data: {
        actorId: actor.id,
        action: "AUTOMATION_JOB_RETRIED",
        entityType: "AutomationJob",
        entityId: jobId,
      },
    }),
  ]);
  await revalidateAutomation();
}

export async function retryAnnouncementAction(
  announcementId: number,
): Promise<void> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const id = automationJobIdSchema.parse(announcementId);
  const prisma = getPrismaClient();
  await prisma.$transaction([
    prisma.announcement.updateMany({
      where: { id, status: AnnouncementStatus.FAILED },
      data: {
        status: AnnouncementStatus.SCHEDULED,
        scheduledFor: new Date(),
        lastError: null,
      },
    }),
    prisma.systemAuditLog.create({
      data: {
        actorId: actor.id,
        action: "ANNOUNCEMENT_RETRIED",
        entityType: "Announcement",
        entityId: id,
      },
    }),
  ]);
  await revalidateAutomation();
}

export async function retryDiscordDeliveryAction(deliveryIdInput: number): Promise<void> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const deliveryId = automationJobIdSchema.parse(deliveryIdInput);
  const prisma = getPrismaClient();
  const delivery = await prisma.discordDelivery.findUnique({
    where: { id: deliveryId },
    select: { id: true, resultGraphicId: true },
  });
  if (!delivery?.resultGraphicId) return;
  await prisma.$transaction([
    prisma.discordDelivery.update({
      where: { id: delivery.id },
      data: { status: DiscordDeliveryStatus.PENDING, attempts: 0, scheduledFor: new Date(), lastError: null },
    }),
    prisma.systemAuditLog.create({
      data: { actorId: actor.id, action: "RESULT_GRAPHIC_DISCORD_RETRIED", entityType: "DiscordDelivery", entityId: delivery.id, metadata: { resultGraphicId: delivery.resultGraphicId } },
    }),
  ]);
  await revalidateAutomation();
}

export async function rerenderResultGraphicAction(graphicIdInput: number): Promise<void> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const graphicId = automationJobIdSchema.parse(graphicIdInput);
  const prisma = getPrismaClient();
  const changed = await prisma.resultGraphic.updateMany({
    where: { id: graphicId },
    data: { renderStatus: GraphicRenderStatus.PENDING, renderingVersion: { increment: 1 }, errorMessage: null },
  });
  if (changed.count === 0) return;
  await prisma.systemAuditLog.create({
    data: { actorId: actor.id, action: "RESULT_GRAPHIC_RERENDER_QUEUED", entityType: "ResultGraphic", entityId: graphicId },
  });
  await revalidateAutomation();
}

export async function reloadDiscordChannelsAction(
  guildSettingsIdInput: number,
): Promise<DiscordChannelReloadState> {
  await requirePermission(Permission.ManageAutomation);
  const guildSettingsId = automationJobIdSchema.parse(guildSettingsIdInput);
  const guild = await getPrismaClient().discordGuildSettings.findUnique({
    where: { id: guildSettingsId },
    select: { guildId: true },
  });
  if (!guild) return { status: "error", message: "Discord-Server wurde nicht gefunden.", catalog: null };
  return getDiscordChannelCatalogState(guild.guildId, { force: true });
}

export async function saveLeagueDiscordChannelMatrixAction(
  _previousState: AutomationActionState,
  formData: FormData,
): Promise<AutomationActionState> {
  const actor = await requirePermission(Permission.ManageAutomation);
  let rows: unknown;
  try {
    rows = JSON.parse(String(formData.get("rows") ?? "[]"));
  } catch {
    return errorState("Die Channel-Zuordnungen sind ungültig.");
  }
  const parsed = leagueDiscordChannelMatrixSchema.safeParse({
    guildSettingsId: formData.get("guildSettingsId"),
    rows,
  });
  if (!parsed.success) return errorState("Bitte prüfe die Channel-Zuordnungen.", validationErrors(parsed.error));

  const prisma = getPrismaClient();
  const [guild, leagues, existingMappings] = await prisma.$transaction([
    prisma.discordGuildSettings.findUnique({
      where: { id: parsed.data.guildSettingsId },
      select: { id: true, guildId: true, enabled: true },
    }),
    prisma.league.findMany({ where: { code: { in: ["F1", "F2", "F3", "F4", "F5", "F6"] } }, select: { id: true, code: true } }),
    prisma.discordChannelMapping.findMany({
      where: {
        guildSettingsId: parsed.data.guildSettingsId,
        purpose: { in: [...resultChannelPurposes, ...standingsChannelPurposes] },
      },
      select: { leagueId: true, purpose: true, channelId: true, enabled: true },
    }),
  ]);
  if (!guild?.enabled) return errorState("Der Discord-Server ist nicht aktiv verbunden.");
  const activeLeagueIds = new Set(leagues.map(({ id }) => id));
  const submittedLeagueIds = new Set(parsed.data.rows.map(({ leagueId }) => leagueId));
  if (
    submittedLeagueIds.size !== parsed.data.rows.length ||
    submittedLeagueIds.size !== activeLeagueIds.size ||
    [...submittedLeagueIds].some((id) => !activeLeagueIds.has(id))
  ) {
    return errorState("Die Matrix muss jede aktive Liga genau einmal enthalten.");
  }

  const channelState = await getDiscordChannelCatalogState(guild.guildId, { force: true });
  if (!channelState.catalog) return errorState(channelState.message);
  const catalog = channelState.catalog;
  const selectableChannels = new Map(
    catalog.channels.filter((channel) => channel.selectable).map((channel) => [channel.id, channel]),
  );
  const resultPurposeSet = new Set<DiscordChannelPurpose>(resultChannelPurposes);
  const standingsPurposeSet = new Set<DiscordChannelPurpose>(standingsChannelPurposes);
  for (const row of parsed.data.rows) {
    for (const channelId of [row.resultChannelId, row.standingsChannelId]) {
      if (channelId && !selectableChannels.has(channelId)) {
        const channel = catalog.channels.find((candidate) => candidate.id === channelId);
        return errorState(channel?.unavailableReason ?? "Der gewählte Kanal existiert nicht mehr.");
      }
    }
    const leagueMappings = existingMappings.filter((mapping) => mapping.leagueId === row.leagueId && mapping.enabled);
    const resultIds = new Set(leagueMappings.filter((mapping) => resultPurposeSet.has(mapping.purpose as DiscordChannelPurpose)).map((mapping) => mapping.channelId));
    const standingsIds = new Set(leagueMappings.filter((mapping) => standingsPurposeSet.has(mapping.purpose as DiscordChannelPurpose)).map((mapping) => mapping.channelId));
    if (!row.resultChannelId && resultIds.size > 1) return errorState("Eine uneinheitliche Ergebnis-Zuordnung muss bewusst vereinheitlicht werden.");
    if (!row.standingsChannelId && standingsIds.size > 1) return errorState("Eine uneinheitliche Tabellen-Zuordnung muss bewusst vereinheitlicht werden.");
  }

  await prisma.$transaction(async (transaction) => {
    for (const row of parsed.data.rows) {
      const groups = [
        { channelId: row.resultChannelId, purposes: resultChannelPurposes },
        { channelId: row.standingsChannelId, purposes: standingsChannelPurposes },
      ] as const;
      for (const group of groups) {
        if (!group.channelId) {
          await transaction.discordChannelMapping.updateMany({
            where: {
              guildSettingsId: guild.id,
              leagueId: row.leagueId,
              purpose: { in: [...group.purposes] },
            },
            data: { enabled: false },
          });
          continue;
        }
        const channel = selectableChannels.get(group.channelId)!;
        for (const purpose of group.purposes) {
          await transaction.discordChannelMapping.upsert({
            where: {
              guildSettingsId_scopeKey_purpose: {
                guildSettingsId: guild.id,
                scopeKey: `LEAGUE:${row.leagueId}`,
                purpose,
              },
            },
            update: { leagueId: row.leagueId, channelId: channel.id, channelName: channel.name, enabled: true },
            create: {
              guildSettingsId: guild.id,
              leagueId: row.leagueId,
              scopeKey: `LEAGUE:${row.leagueId}`,
              purpose,
              channelId: channel.id,
              channelName: channel.name,
              enabled: true,
            },
          });
        }
      }
    }
    await writeSystemAudit(transaction, {
      actorId: actor.id,
      action: "DISCORD_CHANNEL_MATRIX_SAVED",
      entityType: "DiscordGuildSettings",
      entityId: guild.id,
      metadata: { leagueIds: parsed.data.rows.map(({ leagueId }) => leagueId) },
    });
  });
  await revalidateAutomation();
  return successState("Die Zuordnungen wurden gespeichert.");
}

export async function testLeagueDiscordChannelAction(input: unknown): Promise<AutomationActionState> {
  const actor = await requirePermission(Permission.ManageAutomation);
  const parsed = discordChannelTestSchema.safeParse(input);
  if (!parsed.success) return errorState("Der Discord-Test ist ungültig.");
  const rateLimit = consumeRateLimit(`discord-channel-test:${actor.id}`, { limit: 12, windowMs: 10 * 60 * 1000 });
  if (!rateLimit.allowed) return errorState(`Zu viele Tests. Bitte in ${rateLimit.retryAfterSeconds} Sekunden erneut versuchen.`);
  const prisma = getPrismaClient();
  const [guild, league] = await prisma.$transaction([
    prisma.discordGuildSettings.findUnique({ where: { id: parsed.data.guildSettingsId }, select: { id: true, guildId: true, enabled: true } }),
    prisma.league.findUnique({ where: { id: parsed.data.leagueId }, select: { id: true, code: true } }),
  ]);
  if (!guild?.enabled || !league) return errorState("Discord-Server oder Liga wurde nicht gefunden.");
  try {
    const result = await sendDiscordChannelTest({
      guildId: guild.guildId,
      channelId: parsed.data.channelId,
      leagueCode: league.code,
      kind: parsed.data.kind,
    });
    await writeSystemAudit(prisma, {
      actorId: actor.id,
      action: "DISCORD_CHANNEL_TEST_SENT",
      entityType: "DiscordGuildSettings",
      entityId: guild.id,
      metadata: { leagueId: league.id, kind: parsed.data.kind, channelId: parsed.data.channelId },
    });
    return successState(`Nachricht erfolgreich an #${result.channelName} gesendet.`);
  } catch (error: unknown) {
    return errorState(safeDiscordError(error, "Die Discord-Testnachricht konnte nicht gesendet werden."));
  }
}
