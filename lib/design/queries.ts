import "server-only";

import { cache } from "react";
import type { Prisma } from "@/generated/prisma/client";
import {
  defaultDesignTheme,
  designThemeConfigSchema,
  type DesignThemeConfig,
  type ThemeMode,
} from "@/lib/design/theme";
import { getPrismaClient } from "@/lib/db/prisma";

type StoredTheme = {
  id: number;
  name: string;
  preset: string;
  defaultMode: string;
  allowDarkMode: boolean;
  allowLightMode: boolean;
  allowSystemMode: boolean;
  allowUserModeOverride: boolean;
  darkTokens: Prisma.JsonValue;
  lightTokens: Prisma.JsonValue;
  pageAccents: Prisma.JsonValue;
  componentSettings: Prisma.JsonValue;
  navigationSettings: Prisma.JsonValue;
  backgroundSettings: Prisma.JsonValue | null;
};

export type ResolvedTheme = {
  id: number | null;
  config: DesignThemeConfig;
  mode: ThemeMode;
  source: "published" | "fallback";
};

export function parseStoredTheme(theme: StoredTheme): DesignThemeConfig {
  return designThemeConfigSchema.parse({
    name: theme.name,
    preset: theme.preset,
    defaultMode: theme.defaultMode,
    allowDarkMode: theme.allowDarkMode,
    allowLightMode: theme.allowLightMode,
    allowSystemMode: theme.allowSystemMode,
    allowUserModeOverride: theme.allowUserModeOverride,
    darkTokens: theme.darkTokens,
    lightTokens: theme.lightTokens,
    pageAccents: theme.pageAccents,
    componentSettings: theme.componentSettings,
    navigationSettings: theme.navigationSettings,
    backgroundSettings: theme.backgroundSettings ?? undefined,
  });
}

function allowedMode(
  config: DesignThemeConfig,
  preference: string | null | undefined,
): ThemeMode {
  if (!config.allowUserModeOverride) return config.defaultMode;
  if (preference === "light" && config.allowLightMode) return "LIGHT";
  if (preference === "system" && config.allowSystemMode) return "SYSTEM";
  if (preference === "dark" && config.allowDarkMode) return "DARK";
  return config.defaultMode;
}

export const getResolvedTheme = cache(
  async (userId?: number): Promise<ResolvedTheme> => {
    try {
      const prisma = getPrismaClient();
      const [theme, settings] = await Promise.all([
        prisma.designTheme.findFirst({
          where: { isActive: true, isDraft: false },
          orderBy: { publishedAt: "desc" },
          select: {
            id: true,
            name: true,
            preset: true,
            defaultMode: true,
            allowDarkMode: true,
            allowLightMode: true,
            allowSystemMode: true,
            allowUserModeOverride: true,
            darkTokens: true,
            lightTokens: true,
            pageAccents: true,
            componentSettings: true,
            navigationSettings: true,
            backgroundSettings: true,
          },
        }),
        userId
          ? prisma.userSettings.findUnique({
              where: { userId },
              select: { theme: true },
            })
          : Promise.resolve(null),
      ]);
      if (!theme) {
        return {
          id: null,
          config: defaultDesignTheme,
          mode: defaultDesignTheme.defaultMode,
          source: "fallback",
        };
      }
      const config = parseStoredTheme(theme);
      return {
        id: theme.id,
        config,
        mode: allowedMode(config, settings?.theme),
        source: "published",
      };
    } catch (error: unknown) {
      console.warn("[design] Published theme unavailable; using FRL defaults.", {
        errorName: error instanceof Error ? error.name : "UnknownError",
        prismaCode:
          typeof error === "object" && error !== null && "code" in error && typeof error.code === "string"
            ? error.code
            : null,
      });
      return {
        id: null,
        config: defaultDesignTheme,
        mode: defaultDesignTheme.defaultMode,
        source: "fallback",
      };
    }
  },
);

export async function getDesignAdminData() {
  const prisma = getPrismaClient();
  const [draft, active, versions, leagues, teams] = await Promise.all([
    prisma.designTheme.findFirst({
      where: { isDraft: true },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.designTheme.findFirst({
      where: { isActive: true, isDraft: false },
      orderBy: { publishedAt: "desc" },
    }),
    prisma.designThemeVersion.findMany({
      orderBy: { createdAt: "desc" },
      take: 10,
      include: {
        createdBy: { select: { displayName: true } },
        theme: { select: { name: true } },
      },
    }),
    prisma.league.findMany({
      orderBy: [{ displayOrder: "asc" }, { code: "asc" }],
      select: { id: true, code: true, name: true, color: true },
    }),
    prisma.teamOrganization.findMany({
      where: { active: true, archivedAt: null },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        shortName: true,
        color: true,
        secondaryColor: true,
        contrastColor: true,
        logoUrl: true,
      },
    }),
  ]);

  const selected = draft ?? active;
  return {
    themeId: selected?.id ?? null,
    config: selected ? parseStoredTheme(selected) : defaultDesignTheme,
    isDraft: selected?.isDraft ?? false,
    activeThemeName: active?.name ?? "FRL Racing Blue (Standard)",
    versions: versions.map((version) => ({
      id: version.id,
      version: version.version,
      themeName: version.theme.name,
      createdBy: version.createdBy.displayName,
      createdAt: version.createdAt.toISOString(),
    })),
    leagues,
    teams,
  };
}
