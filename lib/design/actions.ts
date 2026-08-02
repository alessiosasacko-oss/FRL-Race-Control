"use server";

import { revalidatePath } from "next/cache";
import type { Prisma } from "@/generated/prisma/client";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { writeSystemAudit } from "@/lib/audit/system";
import { getPrismaClient } from "@/lib/db/prisma";
import { touchAppDataRevisionSafely } from "@/lib/live/revisions";
import {
  defaultDesignTheme,
  designThemeConfigSchema,
  hexColorSchema,
  readableTextColor,
  teamLogoReferenceSchema,
  themeContrastWarnings,
} from "@/lib/design/theme";
import type { DesignActionState } from "@/lib/design/types";

function errorState(
  message: string,
  fieldErrors?: Record<string, string[]>,
  warnings?: string[],
): DesignActionState {
  return { status: "error", message, fieldErrors, warnings };
}

function parsePayload(formData: FormData) {
  const raw = formData.get("themePayload");
  if (typeof raw !== "string" || raw.length > 100_000) return null;
  try {
    return designThemeConfigSchema.safeParse(JSON.parse(raw));
  } catch {
    return null;
  }
}

function configData(config: typeof defaultDesignTheme) {
  return {
    name: config.name,
    preset: config.preset,
    defaultMode: config.defaultMode,
    allowDarkMode: config.allowDarkMode,
    allowLightMode: config.allowLightMode,
    allowSystemMode: config.allowSystemMode,
    allowUserModeOverride: config.allowUserModeOverride,
    darkTokens: config.darkTokens as Prisma.InputJsonValue,
    lightTokens: config.lightTokens as Prisma.InputJsonValue,
    pageAccents: config.pageAccents as Prisma.InputJsonValue,
    componentSettings: config.componentSettings as Prisma.InputJsonValue,
    navigationSettings: config.navigationSettings as Prisma.InputJsonValue,
    backgroundSettings: config.backgroundSettings as Prisma.InputJsonValue,
  };
}

async function revalidateDesign(): Promise<void> {
  revalidatePath("/", "layout");
  revalidatePath("/admin/design");
  await touchAppDataRevisionSafely(getPrismaClient(), ["design"]);
}

export async function saveDesignDraftAction(
  _previousState: DesignActionState,
  formData: FormData,
): Promise<DesignActionState> {
  const user = await requirePermission(Permission.ManageBranding);
  const parsed = parsePayload(formData);
  if (!parsed?.success) {
    return errorState("Die Designkonfiguration ist ungültig.");
  }
  const warnings = themeContrastWarnings(parsed.data);
  const prisma = getPrismaClient();
  try {
    const existing = await prisma.designTheme.findFirst({
      where: { isDraft: true },
      orderBy: { updatedAt: "desc" },
      select: { id: true },
    });
    const theme = existing
      ? await prisma.designTheme.update({
          where: { id: existing.id },
          data: {
            ...configData(parsed.data),
            updatedById: user.id,
          },
        })
      : await prisma.designTheme.create({
          data: {
            ...configData(parsed.data),
            isDraft: true,
            isActive: false,
            createdById: user.id,
            updatedById: user.id,
          },
        });
    await writeSystemAudit(prisma, {
      actorId: user.id,
      action: "DESIGN_DRAFT_SAVED",
      entityType: "DesignTheme",
      entityId: theme.id,
      metadata: { preset: parsed.data.preset, warnings },
    });
  } catch {
    return errorState("Der Designentwurf konnte nicht gespeichert werden.");
  }
  revalidatePath("/admin/design");
  return {
    status: "success",
    message: "Designentwurf gespeichert.",
    warnings,
  };
}

export async function publishDesignAction(
  _previousState: DesignActionState,
  formData: FormData,
): Promise<DesignActionState> {
  const user = await requirePermission(Permission.ManageBranding);
  const parsed = parsePayload(formData);
  if (!parsed?.success) {
    return errorState("Die Designkonfiguration ist ungültig.");
  }
  const warnings = themeContrastWarnings(parsed.data);
  if (warnings.length > 0 && formData.get("acknowledgeWarnings") !== "true") {
    return errorState(
      "Diese Farbkombination besitzt nicht genügend Kontrast.",
      undefined,
      warnings,
    );
  }
  const prisma = getPrismaClient();
  try {
    await prisma.$transaction(async (transaction) => {
      const draft = await transaction.designTheme.findFirst({
        where: { isDraft: true },
        orderBy: { updatedAt: "desc" },
      });
      await transaction.designTheme.updateMany({
        where: { isActive: true },
        data: { isActive: false },
      });
      const theme = draft
        ? await transaction.designTheme.update({
            where: { id: draft.id },
            data: {
              ...configData(parsed.data),
              isDraft: false,
              isActive: true,
              publishedAt: new Date(),
              updatedById: user.id,
            },
          })
        : await transaction.designTheme.create({
            data: {
              ...configData(parsed.data),
              isDraft: false,
              isActive: true,
              publishedAt: new Date(),
              createdById: user.id,
              updatedById: user.id,
            },
          });
      const latest = await transaction.designThemeVersion.aggregate({
        where: { themeId: theme.id },
        _max: { version: true },
      });
      await transaction.designThemeVersion.create({
        data: {
          themeId: theme.id,
          version: (latest._max.version ?? 0) + 1,
          snapshot: parsed.data as Prisma.InputJsonValue,
          createdById: user.id,
        },
      });
      await writeSystemAudit(transaction, {
        actorId: user.id,
        action: "DESIGN_PUBLISHED",
        entityType: "DesignTheme",
        entityId: theme.id,
        metadata: { preset: parsed.data.preset },
      });
    });
  } catch {
    return errorState("Das Design konnte nicht veröffentlicht werden.");
  }
  await revalidateDesign();
  return { status: "success", message: "Design global veröffentlicht." };
}

export async function restoreDefaultDesignAction(): Promise<void> {
  const user = await requirePermission(Permission.ManageBranding);
  const prisma = getPrismaClient();
  await prisma.$transaction(async (transaction) => {
    await transaction.designTheme.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    const theme = await transaction.designTheme.create({
      data: {
        ...configData(defaultDesignTheme),
        isDraft: false,
        isActive: true,
        publishedAt: new Date(),
        createdById: user.id,
        updatedById: user.id,
      },
    });
    await transaction.designThemeVersion.create({
      data: {
        themeId: theme.id,
        version: 1,
        snapshot: defaultDesignTheme as Prisma.InputJsonValue,
        createdById: user.id,
      },
    });
    await writeSystemAudit(transaction, {
      actorId: user.id,
      action: "DESIGN_RESET",
      entityType: "DesignTheme",
      entityId: theme.id,
    });
  });
  await revalidateDesign();
}

export async function restoreDesignVersionAction(versionId: number): Promise<void> {
  const user = await requirePermission(Permission.ManageBranding);
  const prisma = getPrismaClient();
  const version = await prisma.designThemeVersion.findUnique({
    where: { id: versionId },
    select: { snapshot: true },
  });
  if (!version) return;
  const parsed = designThemeConfigSchema.safeParse(version.snapshot);
  if (!parsed.success) return;
  await prisma.designTheme.create({
    data: {
      ...configData(parsed.data),
      isDraft: true,
      isActive: false,
      createdById: user.id,
      updatedById: user.id,
    },
  });
  await writeSystemAudit(prisma, {
    actorId: user.id,
    action: "DESIGN_VERSION_RESTORED",
    entityType: "DesignThemeVersion",
    entityId: versionId,
  });
  revalidatePath("/admin/design");
}

export async function updateLeagueBrandingAction(formData: FormData): Promise<void> {
  const user = await requirePermission(Permission.ManageBranding);
  const id = Number(formData.get("leagueId"));
  const color = hexColorSchema.safeParse(formData.get("color"));
  if (!Number.isInteger(id) || id <= 0 || !color.success) return;
  await getPrismaClient().league.update({ where: { id }, data: { color: color.data } });
  await writeSystemAudit(getPrismaClient(), {
    actorId: user.id,
    action: "LEAGUE_BRANDING_UPDATED",
    entityType: "League",
    entityId: id,
    metadata: { color: color.data },
  });
  await revalidateDesign();
}

export async function updateTeamBrandingAction(formData: FormData): Promise<void> {
  const user = await requirePermission(Permission.ManageBranding);
  const id = Number(formData.get("teamId"));
  const color = hexColorSchema.safeParse(formData.get("color"));
  const secondaryColor = hexColorSchema.safeParse(formData.get("secondaryColor"));
  const logoUrl = teamLogoReferenceSchema.safeParse(formData.get("logoUrl") ?? "");
  if (!Number.isInteger(id) || id <= 0 || !color.success || !secondaryColor.success || !logoUrl.success) return;
  const contrastColor = readableTextColor(color.data);
  const prisma = getPrismaClient();
  await prisma.$transaction(async (transaction) => {
    await transaction.teamOrganization.update({
      where: { id, active: true, archivedAt: null },
      data: { color: color.data, secondaryColor: secondaryColor.data, contrastColor, logoUrl: logoUrl.data || null },
    });
    await transaction.team.updateMany({
      where: { organizationId: id },
      data: { color: color.data, secondaryColor: secondaryColor.data, contrastColor, logoUrl: logoUrl.data || null, systemManaged: true },
    });
  });
  await writeSystemAudit(prisma, {
    actorId: user.id,
    action: "TEAM_BRANDING_UPDATED",
    entityType: "TeamOrganization",
    entityId: id,
    metadata: { color: color.data, secondaryColor: secondaryColor.data, logoUpdated: Boolean(logoUrl.data) },
  });
  await revalidateDesign();
}
