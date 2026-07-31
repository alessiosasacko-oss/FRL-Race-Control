"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import {
  themeCssVariables,
  type DesignThemeConfig,
  type ThemeMode,
} from "@/lib/design/theme";

type ThemeStyle = CSSProperties & Record<`--${string}`, string>;

export default function ThemeSurface({
  config,
  mode,
  children,
}: {
  config: DesignThemeConfig;
  mode: ThemeMode;
  children: React.ReactNode;
}) {
  const [systemMode, setSystemMode] = useState<"DARK" | "LIGHT">("DARK");

  useEffect(() => {
    if (mode !== "SYSTEM") return;
    const media = window.matchMedia("(prefers-color-scheme: light)");
    const update = (event: MediaQueryListEvent) =>
      setSystemMode(event.matches ? "LIGHT" : "DARK");
    const initialUpdate = window.setTimeout(
      () => setSystemMode(media.matches ? "LIGHT" : "DARK"),
      0,
    );
    media.addEventListener("change", update);
    return () => {
      window.clearTimeout(initialUpdate);
      media.removeEventListener("change", update);
    };
  }, [mode]);

  const resolvedMode = mode === "SYSTEM" ? systemMode : mode;

  const style = useMemo<ThemeStyle>(() => {
    const settings = config.componentSettings;
    const baseFont =
      settings.baseFont === "HUMANIST"
        ? '"Segoe UI", Candara, Calibri, system-ui, sans-serif'
        : settings.baseFont === "SYSTEM"
          ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif'
          : 'Inter, "Segoe UI", ui-sans-serif, system-ui, sans-serif';
    const headingFont =
      settings.headingFont === "CONDENSED"
        ? '"Arial Narrow", "Roboto Condensed", Inter, sans-serif'
        : settings.headingFont === "TECHNICAL"
          ? 'Bahnschrift, Inter, "Segoe UI", sans-serif'
          : baseFont;
    const numberFont =
      settings.numberFont === "TABULAR"
        ? 'Bahnschrift, "Segoe UI", sans-serif'
        : settings.numberFont === "SYSTEM_MONO"
          ? 'ui-monospace, SFMono-Regular, Menlo, monospace'
          : '"Cascadia Code", Consolas, ui-monospace, monospace';
    const radius =
      settings.radius === "SHARP"
        ? "0.25rem"
        : settings.radius === "SOFT"
          ? "0.875rem"
          : "1.25rem";
    const shadow =
      settings.shadow === "NONE"
        ? "none"
        : settings.shadow === "SUBTLE"
          ? "0 12px 35px rgb(0 0 0 / 0.16)"
          : settings.shadow === "STRONG"
            ? "0 30px 90px rgb(0 0 0 / 0.45)"
            : "0 20px 60px rgb(0 0 0 / 0.28)";
    const glow =
      settings.glow === "NONE"
        ? "0%"
        : settings.glow === "STRONG"
          ? "34%"
          : "16%";
    const density =
      settings.density === "COMPACT"
        ? "0.86"
        : settings.density === "COMFORTABLE"
          ? "1.14"
          : "1";
    return {
      ...themeCssVariables(config, resolvedMode),
      "--radius-card": radius,
      "--shadow-card": shadow,
      "--glow-strength": glow,
      "--spacing-density": density,
      "--heading-weight": settings.headingWeight,
      "--number-weight": settings.numberWeight,
      "--texture-intensity": `${settings.textureIntensity}%`,
      "--font-app": baseFont,
      "--font-heading": headingFont,
      "--font-number": numberFont,
    };
  }, [config, resolvedMode]);

  return (
    <div
      className="theme-root min-h-screen"
      data-theme-mode={resolvedMode.toLowerCase()}
      data-density={config.componentSettings.density.toLowerCase()}
      data-texture={config.componentSettings.texture.toLowerCase()}
      data-texture-scope={config.componentSettings.textureScope.toLowerCase()}
      data-card-background={config.componentSettings.cardBackground.toLowerCase()}
      data-card-contrast={config.componentSettings.cardContrast.toLowerCase()}
      data-border-style={config.componentSettings.borderStyle.toLowerCase()}
      data-hero-style={config.componentSettings.heroStyle.toLowerCase()}
      data-typography-density={config.componentSettings.typographyDensity.toLowerCase()}
      data-uppercase-headings={config.componentSettings.uppercaseHeadings ? "true" : "false"}
      data-code-spacing={config.componentSettings.codeLetterSpacing.toLowerCase()}
      data-sidebar-width={config.navigationSettings.sidebarWidth.toLowerCase()}
      data-sidebar-collapsible={config.navigationSettings.collapsible ? "true" : "false"}
      data-navigation-groups={config.navigationSettings.grouped ? "visible" : "compact"}
      data-navigation-active={config.navigationSettings.activeStyle.toLowerCase()}
      data-logo-size={config.navigationSettings.logoSize.toLowerCase()}
      data-mobile-navigation={config.navigationSettings.mobileBottomNavigation ? "visible" : "hidden"}
      style={style}
    >
      {children}
    </div>
  );
}
