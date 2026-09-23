import type {
  BackgroundSettings,
  DesignThemeConfig,
  ThemeTokens,
} from "@/lib/design/theme";

// Browser-safe presentation helpers live separately from the Zod-backed theme
// schema. Importing the schema from the global client shell would otherwise
// ship the complete validation library to every route.
const patternImages: Record<BackgroundSettings["pattern"], string> = {
  NONE: "none",
  FINE_GRID: "linear-gradient(var(--app-pattern-color) 1px, transparent 1px), linear-gradient(90deg, var(--app-pattern-color) 1px, transparent 1px)",
  DOTS: "radial-gradient(circle, var(--app-pattern-color) 1.2px, transparent 1.4px)",
  DIAGONAL_LINES: "repeating-linear-gradient(135deg, var(--app-pattern-color) 0 1px, transparent 1px 12px)",
  CARBON: "linear-gradient(45deg, var(--app-pattern-color) 25%, transparent 25% 75%, var(--app-pattern-color) 75%), linear-gradient(45deg, var(--app-pattern-color) 25%, transparent 25% 75%, var(--app-pattern-color) 75%)",
  TRACK_LINES: "radial-gradient(ellipse at 15% 115%, transparent 0 42%, var(--app-pattern-color) 43% 44%, transparent 45%), radial-gradient(ellipse at 90% -15%, transparent 0 48%, var(--app-pattern-color) 49% 50%, transparent 51%)",
  BLUEPRINT_GRID: "linear-gradient(var(--app-pattern-color) 1px, transparent 1px), linear-gradient(90deg, var(--app-pattern-color) 1px, transparent 1px), linear-gradient(color-mix(in srgb, var(--app-pattern-color) 45%, transparent) 1px, transparent 1px), linear-gradient(90deg, color-mix(in srgb, var(--app-pattern-color) 45%, transparent) 1px, transparent 1px)",
  CHECKERED: "conic-gradient(var(--app-pattern-color) 25%, transparent 0 50%, var(--app-pattern-color) 0 75%, transparent 0)",
  NOISE: "radial-gradient(circle at 20% 30%, var(--app-pattern-color) 0 0.6px, transparent 0.8px), radial-gradient(circle at 75% 68%, var(--app-pattern-color) 0 0.5px, transparent 0.8px)",
  SPEED_LINES: "repeating-linear-gradient(165deg, transparent 0 18px, var(--app-pattern-color) 19px 20px, transparent 21px 44px)",
};

export function backgroundPresentation(
  settings: BackgroundSettings,
  mode: "DARK" | "LIGHT",
) {
  const modeColor = mode === "LIGHT" ? settings.colorLight : settings.colorDark;
  const fallbackColor = settings.type === "IMAGE" ? settings.color : modeColor;
  const gradientDirection = settings.gradientType === "RADIAL"
    ? `circle at ${settings.gradientPosition.toLowerCase()}`
    : `${settings.gradientAngle}deg`;
  const gradientColors = settings.gradientColors
    .map((color) =>
      `color-mix(in srgb, ${color} ${settings.gradientIntensity}%, ${fallbackColor})`,
    )
    .join(", ");
  const image = settings.type === "IMAGE" && settings.assetPath
    ? `url("${settings.assetPath}")`
    : settings.type === "GRADIENT"
      ? `${settings.gradientType === "RADIAL" ? "radial" : "linear"}-gradient(${gradientDirection}, ${gradientColors})`
      : settings.type === "PATTERN"
        ? patternImages[settings.pattern]
        : "none";

  return {
    fallbackColor:
      settings.type === "PATTERN"
        ? settings.patternBackgroundColor
        : fallbackColor,
    image,
    size:
      settings.type === "IMAGE"
        ? settings.imageFit.toLowerCase()
        : settings.type === "PATTERN"
          ? `${Math.max(8, Math.round(settings.patternSpacing * settings.patternScale / 100))}px ${Math.max(8, Math.round(settings.patternSpacing * settings.patternScale / 100))}px`
          : "cover",
    position:
      settings.type === "IMAGE"
        ? `${settings.imagePositionX}% ${settings.imagePositionY}%`
        : "center",
    repeat: settings.type === "IMAGE" ? "no-repeat" : "repeat",
    opacity:
      settings.type === "IMAGE"
        ? settings.imageOpacity / 100
        : settings.type === "PATTERN"
          ? settings.patternOpacity / 100
          : 1,
    filter:
      settings.type === "IMAGE"
        ? `blur(${settings.imageBlur}px) brightness(${settings.imageBrightness}%) contrast(${settings.imageContrast}%) saturate(${settings.imageSaturation}%)`
        : settings.type === "PATTERN"
          ? `contrast(${settings.patternContrast}%)`
          : "none",
    rotation: settings.type === "PATTERN" ? settings.patternRotation : 0,
    blendMode: settings.patternBlendMode.toLowerCase().replace("_", "-"),
    overlayColor: settings.overlayColor,
    overlayOpacity: settings.overlayOpacity / 100,
  };
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
    variables[
      `--accent-${key.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`)}`
    ] = value;
  }
  return variables;
}
