import { z } from "zod";

export const designPresets = [
  "FRL_RACING_BLUE",
  "MIDNIGHT_MOTORSPORT",
  "RACING_RED",
  "CHAMPIONSHIP_GOLD",
  "NEON_RACE_CONTROL",
  "CLEAN_LIGHT",
  "CUSTOM",
] as const;

export const themeModes = ["DARK", "LIGHT", "SYSTEM"] as const;
export const displayDensities = [
  "COMPACT",
  "STANDARD",
  "COMFORTABLE",
] as const;

export type DesignPreset = (typeof designPresets)[number];
export type ThemeMode = (typeof themeModes)[number];

export const designPresetLabels: Record<DesignPreset, string> = {
  FRL_RACING_BLUE: "FRL Racing Blue",
  MIDNIGHT_MOTORSPORT: "Midnight Motorsport",
  RACING_RED: "Racing Red",
  CHAMPIONSHIP_GOLD: "Championship Gold",
  NEON_RACE_CONTROL: "Neon Race Control",
  CLEAN_LIGHT: "Clean Light",
  CUSTOM: "Custom",
};

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, "Bitte eine gültige Hex-Farbe angeben.")
  .transform((value) => value.toUpperCase());

export const themeTokensSchema = z.object({
  primary: hexColorSchema,
  secondary: hexColorSchema,
  background: hexColorSchema,
  backgroundElevated: hexColorSchema,
  card: hexColorSchema,
  sidebar: hexColorSchema,
  header: hexColorSchema,
  text: hexColorSchema,
  textMuted: hexColorSchema,
  border: hexColorSchema,
  info: hexColorSchema,
  success: hexColorSchema,
  open: hexColorSchema,
  warning: hexColorSchema,
  error: hexColorSchema,
  penalty: hexColorSchema,
  archived: hexColorSchema,
  live: hexColorSchema,
  admin: hexColorSchema,
  steward: hexColorSchema,
  fia: hexColorSchema,
  teamPrincipal: hexColorSchema,
  firstPlace: hexColorSchema,
  secondPlace: hexColorSchema,
  thirdPlace: hexColorSchema,
  fastestLap: hexColorSchema,
  positionGain: hexColorSchema,
  positionLoss: hexColorSchema,
  fiaOpen: hexColorSchema,
  fiaReview: hexColorSchema,
  fiaVoting: hexColorSchema,
  fiaAccepted: hexColorSchema,
  fiaRejected: hexColorSchema,
  fiaTie: hexColorSchema,
  fiaResolved: hexColorSchema,
  fiaArchived: hexColorSchema,
}).strict();

export const pageAccentsSchema = z.object({
  dashboard: hexColorSchema,
  calendar: hexColorSchema,
  raceWeekend: hexColorSchema,
  attendance: hexColorSchema,
  results: hexColorSchema,
  championship: hexColorSchema,
  fia: hexColorSchema,
  drivers: hexColorSchema,
  teams: hexColorSchema,
  notifications: hexColorSchema,
  administration: hexColorSchema,
}).strict();

export const componentSettingsSchema = z.object({
  baseFont: z.enum(["SYSTEM", "MODERN", "HUMANIST"]).default("MODERN"),
  headingFont: z.enum(["INHERIT", "CONDENSED", "TECHNICAL"]).default("CONDENSED"),
  numberFont: z.enum(["SYSTEM_MONO", "CASCADE", "TABULAR"]).default("CASCADE"),
  radius: z.enum(["SHARP", "SOFT", "ROUNDED"]),
  shadow: z.enum(["NONE", "SUBTLE", "MEDIUM", "STRONG"]),
  glow: z.enum(["NONE", "SUBTLE", "STRONG"]),
  cardContrast: z.enum(["LOW", "NORMAL", "HIGH"]),
  borderStyle: z.enum(["NONE", "SUBTLE", "ACCENT"]),
  cardBackground: z.enum(["SOLID", "GRADIENT", "TEXTURE"]),
  texture: z.enum([
    "NONE",
    "CARBON",
    "RACING_GRID",
    "CHECKERED",
    "TRACK_LINES",
    "CONTROL_GRID",
    "GRADIENT",
  ]),
  textureIntensity: z.number().int().min(0).max(30),
  textureScope: z.enum(["HERO", "PAGES", "RACES"]),
  heroStyle: z.enum(["CINEMATIC", "RACE_CONTROL", "MINIMAL", "COMPACT"]),
  heroImage: z.boolean(),
  heroOverlay: z.number().int().min(20).max(90),
  heroGlow: z.boolean(),
  showTrackLayout: z.boolean(),
  showTeamLogo: z.boolean(),
  showCountryFlag: z.boolean(),
  showCountdown: z.boolean(),
  density: z.enum(displayDensities),
  typographyDensity: z.enum(["COMPACT", "STANDARD", "SPACIOUS"]),
  headingWeight: z.enum(["700", "800", "900"]),
  numberWeight: z.enum(["600", "700", "800", "900"]),
  uppercaseHeadings: z.boolean(),
  codeLetterSpacing: z.enum(["NORMAL", "WIDE", "EXTRA_WIDE"]),
}).strict();

export const navigationSettingsSchema = z.object({
  sidebarWidth: z.enum(["COMPACT", "WIDE"]),
  collapsible: z.boolean(),
  grouped: z.boolean(),
  logoSize: z.enum(["SMALL", "MEDIUM", "LARGE"]),
  activeStyle: z.enum(["SURFACE", "LINE", "GLOW", "COMBINED"]),
  mobileBottomNavigation: z.boolean(),
  mobileItems: z
    .array(
      z.enum([
        "dashboard",
        "calendar",
        "attendance",
        "championship",
        "fia",
        "notifications",
        "drivers",
        "teams",
      ]),
    )
    .min(3)
    .max(5),
}).strict();

export const designThemeConfigSchema = z.object({
  name: z.string().trim().min(3).max(160),
  preset: z.enum(designPresets),
  defaultMode: z.enum(themeModes),
  allowDarkMode: z.boolean(),
  allowLightMode: z.boolean(),
  allowSystemMode: z.boolean(),
  allowUserModeOverride: z.boolean(),
  darkTokens: themeTokensSchema,
  lightTokens: themeTokensSchema,
  pageAccents: pageAccentsSchema,
  componentSettings: componentSettingsSchema,
  navigationSettings: navigationSettingsSchema,
}).strict().superRefine((config, context) => {
  const allowed = {
    DARK: config.allowDarkMode,
    LIGHT: config.allowLightMode,
    SYSTEM: config.allowSystemMode,
  } as const;
  if (!Object.values(allowed).some(Boolean)) {
    context.addIssue({ code: "custom", path: ["allowDarkMode"], message: "Mindestens ein Farbmodus muss erlaubt sein." });
  }
  if (!allowed[config.defaultMode]) {
    context.addIssue({ code: "custom", path: ["defaultMode"], message: "Der Standardmodus muss erlaubt sein." });
  }
});

export type ThemeTokens = z.infer<typeof themeTokensSchema>;
export type PageAccents = z.infer<typeof pageAccentsSchema>;
export type ComponentSettings = z.infer<typeof componentSettingsSchema>;
export type NavigationSettings = z.infer<typeof navigationSettingsSchema>;
export type DesignThemeConfig = z.infer<typeof designThemeConfigSchema>;

const baseDark: ThemeTokens = {
  primary: "#3B82F6",
  secondary: "#22D3EE",
  background: "#05080E",
  backgroundElevated: "#0B1220",
  card: "#101A2A",
  sidebar: "#07101D",
  header: "#080F1B",
  text: "#F8FAFC",
  textMuted: "#94A3B8",
  border: "#27364E",
  info: "#38BDF8",
  success: "#34D399",
  open: "#60A5FA",
  warning: "#FBBF24",
  error: "#FB7185",
  penalty: "#F97316",
  archived: "#94A3B8",
  live: "#22D3EE",
  admin: "#A78BFA",
  steward: "#2DD4BF",
  fia: "#F43F5E",
  teamPrincipal: "#C084FC",
  firstPlace: "#FACC15",
  secondPlace: "#CBD5E1",
  thirdPlace: "#FB923C",
  fastestLap: "#D946EF",
  positionGain: "#22C55E",
  positionLoss: "#EF4444",
  fiaOpen: "#60A5FA",
  fiaReview: "#FB923C",
  fiaVoting: "#A78BFA",
  fiaAccepted: "#34D399",
  fiaRejected: "#FB7185",
  fiaTie: "#FBBF24",
  fiaResolved: "#22C55E",
  fiaArchived: "#94A3B8",
};

const baseLight: ThemeTokens = {
  ...baseDark,
  primary: "#1D4ED8",
  secondary: "#0369A1",
  background: "#F1F5F9",
  backgroundElevated: "#FFFFFF",
  card: "#FFFFFF",
  sidebar: "#E8EEF7",
  header: "#FFFFFF",
  text: "#0F172A",
  textMuted: "#475569",
  border: "#CBD5E1",
  info: "#0369A1",
  success: "#047857",
  open: "#1D4ED8",
  warning: "#B45309",
  error: "#BE123C",
  penalty: "#C2410C",
  archived: "#475569",
  live: "#0E7490",
  admin: "#6D28D9",
  steward: "#0F766E",
  fia: "#BE123C",
  teamPrincipal: "#7E22CE",
  firstPlace: "#A16207",
  secondPlace: "#475569",
  thirdPlace: "#C2410C",
  fastestLap: "#A21CAF",
  positionGain: "#15803D",
  positionLoss: "#B91C1C",
  fiaOpen: "#1D4ED8",
  fiaReview: "#C2410C",
  fiaVoting: "#6D28D9",
  fiaAccepted: "#047857",
  fiaRejected: "#BE123C",
  fiaTie: "#B45309",
  fiaResolved: "#15803D",
  fiaArchived: "#475569",
};

const defaultPageAccents: PageAccents = {
  dashboard: "#38BDF8",
  calendar: "#22D3EE",
  raceWeekend: "#34D399",
  attendance: "#2DD4BF",
  results: "#60A5FA",
  championship: "#FACC15",
  fia: "#F43F5E",
  drivers: "#818CF8",
  teams: "#22D3EE",
  notifications: "#A78BFA",
  administration: "#C084FC",
};

const defaultComponents: ComponentSettings = {
  baseFont: "MODERN",
  headingFont: "CONDENSED",
  numberFont: "CASCADE",
  radius: "ROUNDED",
  shadow: "MEDIUM",
  glow: "SUBTLE",
  cardContrast: "NORMAL",
  borderStyle: "SUBTLE",
  cardBackground: "GRADIENT",
  texture: "CONTROL_GRID",
  textureIntensity: 8,
  textureScope: "PAGES",
  heroStyle: "RACE_CONTROL",
  heroImage: true,
  heroOverlay: 65,
  heroGlow: true,
  showTrackLayout: true,
  showTeamLogo: true,
  showCountryFlag: true,
  showCountdown: true,
  density: "STANDARD",
  typographyDensity: "STANDARD",
  headingWeight: "900",
  numberWeight: "800",
  uppercaseHeadings: false,
  codeLetterSpacing: "WIDE",
};

const defaultNavigation: NavigationSettings = {
  sidebarWidth: "WIDE",
  collapsible: true,
  grouped: true,
  logoSize: "MEDIUM",
  activeStyle: "COMBINED",
  mobileBottomNavigation: true,
  mobileItems: ["dashboard", "calendar", "attendance", "championship"],
};

function recolor(
  dark: Partial<ThemeTokens>,
  light: Partial<ThemeTokens>,
  accents: Partial<PageAccents>,
): Omit<DesignThemeConfig, "name" | "preset"> {
  return {
    defaultMode: "DARK",
    allowDarkMode: true,
    allowLightMode: true,
    allowSystemMode: true,
    allowUserModeOverride: true,
    darkTokens: { ...baseDark, ...dark },
    lightTokens: { ...baseLight, ...light },
    pageAccents: { ...defaultPageAccents, ...accents },
    componentSettings: { ...defaultComponents },
    navigationSettings: { ...defaultNavigation },
  };
}

export const themePresets: Record<DesignPreset, DesignThemeConfig> = {
  FRL_RACING_BLUE: {
    name: "FRL Racing Blue",
    preset: "FRL_RACING_BLUE",
    ...recolor({}, {}, {}),
  },
  MIDNIGHT_MOTORSPORT: {
    name: "Midnight Motorsport",
    preset: "MIDNIGHT_MOTORSPORT",
    ...recolor(
      { primary: "#2563EB", secondary: "#60A5FA", card: "#111827" },
      { primary: "#1D4ED8", secondary: "#2563EB" },
      { dashboard: "#60A5FA", results: "#3B82F6" },
    ),
  },
  RACING_RED: {
    name: "Racing Red",
    preset: "RACING_RED",
    ...recolor(
      { primary: "#EF4444", secondary: "#F97316", fia: "#FB7185" },
      { primary: "#B91C1C", secondary: "#C2410C", fia: "#BE123C" },
      { dashboard: "#F97316", fia: "#EF4444", results: "#FB7185" },
    ),
  },
  CHAMPIONSHIP_GOLD: {
    name: "Championship Gold",
    preset: "CHAMPIONSHIP_GOLD",
    ...recolor(
      { primary: "#EAB308", secondary: "#3B82F6", card: "#121827" },
      { primary: "#A16207", secondary: "#1D4ED8" },
      { dashboard: "#EAB308", championship: "#FACC15" },
    ),
  },
  NEON_RACE_CONTROL: {
    name: "Neon Race Control",
    preset: "NEON_RACE_CONTROL",
    ...recolor(
      { primary: "#06B6D4", secondary: "#A855F7", card: "#0D1724" },
      { primary: "#0E7490", secondary: "#7E22CE" },
      { dashboard: "#22D3EE", notifications: "#C084FC", fia: "#F472B6" },
    ),
  },
  CLEAN_LIGHT: {
    name: "Clean Light",
    preset: "CLEAN_LIGHT",
    ...recolor({}, {}, {}),
    defaultMode: "LIGHT",
  },
  CUSTOM: {
    name: "Custom",
    preset: "CUSTOM",
    ...recolor({}, {}, {}),
  },
};

export const defaultDesignTheme = themePresets.FRL_RACING_BLUE;

function channel(hex: string, start: number): number {
  return Number.parseInt(hex.slice(start, start + 2), 16) / 255;
}

function luminance(hex: string): number {
  const normalized = hexColorSchema.parse(hex);
  const values = [channel(normalized, 1), channel(normalized, 3), channel(normalized, 5)]
    .map((value) =>
      value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4,
    );
  return 0.2126 * values[0] + 0.7152 * values[1] + 0.0722 * values[2];
}

export function contrastRatio(foreground: string, background: string): number {
  const lighter = Math.max(luminance(foreground), luminance(background));
  const darker = Math.min(luminance(foreground), luminance(background));
  return (lighter + 0.05) / (darker + 0.05);
}

export function readableTextColor(background: string): "#FFFFFF" | "#0F172A" {
  return contrastRatio("#FFFFFF", background) >= contrastRatio("#0F172A", background)
    ? "#FFFFFF"
    : "#0F172A";
}

export function themeContrastWarnings(config: DesignThemeConfig): string[] {
  const warnings: string[] = [];
  for (const [mode, tokens] of [
    ["Dark", config.darkTokens],
    ["Light", config.lightTokens],
  ] as const) {
    if (contrastRatio(tokens.text, tokens.background) < 4.5) {
      warnings.push(`${mode}: Text auf Hintergrund`);
    }
    if (contrastRatio(tokens.text, tokens.card) < 4.5) {
      warnings.push(`${mode}: Text auf Karten`);
    }
    if (contrastRatio(readableTextColor(tokens.primary), tokens.primary) < 4.5) {
      warnings.push(`${mode}: Text auf Hauptfarbe`);
    }
    if (contrastRatio(tokens.textMuted, tokens.background) < 3) {
      warnings.push(`${mode}: Sekundärtext auf Hintergrund`);
    }
  }
  return warnings;
}

export const assetReferenceSchema = z.string().trim().max(1000).refine(
  (value) =>
    value === "" ||
    value.startsWith("/assets/tracks/") ||
    (() => {
      try {
        return new URL(value).protocol === "https:" && !/[<>"'()\\\u0000-\u001F]/.test(value);
      } catch {
        return false;
      }
    })(),
  "Asset muss ein sicherer HTTPS- oder Track-Asset-Pfad sein.",
);

export const teamLogoReferenceSchema = z.string().trim().max(1000).refine(
  (value) =>
    value === "" ||
    value.startsWith("/assets/teams/") ||
    (() => {
      try {
        return new URL(value).protocol === "https:" && !/[<>"'()\\\u0000-\u001F]/.test(value);
      } catch {
        return false;
      }
    })(),
  "Logo muss ein sicherer HTTPS- oder Team-Asset-Pfad sein.",
);

export function validateSvgAsset(svg: string): string {
  const unsafe = [
    /<script\b/i,
    /<foreignObject\b/i,
    /\son\w+\s*=/i,
    /javascript\s*:/i,
    /<style\b/i,
    /@import/i,
    /url\s*\(/i,
    /(?:href|xlink:href)\s*=\s*["']https?:/i,
    /<!ENTITY/i,
    /<\?xml-stylesheet/i,
  ];
  if (!/^\s*<svg\b/i.test(svg) || unsafe.some((pattern) => pattern.test(svg))) {
    throw new Error("UNSAFE_SVG");
  }
  return svg;
}

const tokenCssNames: Record<keyof ThemeTokens, string> = {
  primary: "--color-primary",
  secondary: "--color-secondary",
  background: "--color-background",
  backgroundElevated: "--color-background-elevated",
  card: "--color-card",
  sidebar: "--color-sidebar",
  header: "--color-header",
  text: "--color-text",
  textMuted: "--color-text-muted",
  border: "--color-border",
  info: "--color-info",
  success: "--color-success",
  open: "--color-open",
  warning: "--color-warning",
  error: "--color-danger",
  penalty: "--color-penalty",
  archived: "--color-archived",
  live: "--color-live",
  admin: "--color-admin",
  steward: "--color-steward",
  fia: "--color-fia",
  teamPrincipal: "--color-team-principal",
  firstPlace: "--color-position-1",
  secondPlace: "--color-position-2",
  thirdPlace: "--color-position-3",
  fastestLap: "--color-fastest-lap",
  positionGain: "--color-position-gain",
  positionLoss: "--color-position-loss",
  fiaOpen: "--color-fia-open",
  fiaReview: "--color-fia-review",
  fiaVoting: "--color-fia-voting",
  fiaAccepted: "--color-fia-accepted",
  fiaRejected: "--color-fia-rejected",
  fiaTie: "--color-fia-tie",
  fiaResolved: "--color-fia-resolved",
  fiaArchived: "--color-fia-archived",
};

export function themeCssVariables(
  config: DesignThemeConfig,
  mode: "DARK" | "LIGHT",
): Record<string, string> {
  const tokens = mode === "LIGHT" ? config.lightTokens : config.darkTokens;
  const variables = Object.fromEntries(
    Object.entries(tokens).map(([key, value]) => [
      tokenCssNames[key as keyof ThemeTokens],
      value,
    ]),
  );
  for (const [key, value] of Object.entries(config.pageAccents)) {
    variables[`--accent-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`] = value;
  }
  return variables;
}
