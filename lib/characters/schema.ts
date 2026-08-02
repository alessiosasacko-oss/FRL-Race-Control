import { z } from "zod";

export const bodyShapes = ["SLIM", "REGULAR", "ATHLETIC", "STRONG"] as const;
export const faceShapes = ["OVAL", "ROUND", "ANGULAR", "NARROW", "WIDE"] as const;
export const skinTones = ["TONE_1", "TONE_2", "TONE_3", "TONE_4", "TONE_5", "TONE_6", "TONE_7", "TONE_8"] as const;
export const eyeShapes = ["ALMOND", "ROUND", "NARROW", "DEEP"] as const;
export const eyeColors = ["BROWN", "DARK_BROWN", "BLUE", "GREEN", "GRAY", "HAZEL"] as const;
export const eyebrowStyles = ["STRAIGHT", "SOFT", "DEFINED", "BOLD"] as const;
export const noseStyles = ["STRAIGHT", "SOFT", "WIDE", "NARROW"] as const;
export const mouthStyles = ["NEUTRAL", "SMILE", "FOCUSED", "CONFIDENT"] as const;
export const hairStyles = ["SHORT", "MEDIUM", "LONG", "CURLY", "STRAIGHT", "UNDERCUT", "SIDE_PART", "SLICKED", "BALD"] as const;
export const hairColors = ["BLACK", "DARK_BROWN", "BROWN", "LIGHT_BROWN", "BLOND", "RED", "GRAY", "WHITE"] as const;
export const beardStyles = ["NONE", "LIGHT", "STUBBLE", "FULL", "MOUSTACHE", "GOATEE"] as const;
export const eyewearStyles = ["NONE", "GLASSES", "SUNGLASSES"] as const;
export const faceDetails = ["NONE", "FRECKLES", "CHEEK_MARK", "BROW_MARK"] as const;
export const normalPoses = ["NEUTRAL", "ARMS_CROSSED", "HANDS_ON_HIPS", "HELM_UNDER_ARM", "THUMBS_UP"] as const;
export const winnerPoses = ["FIST_UP", "BOTH_ARMS_UP", "TROPHY", "CHAMPAGNE", "POINT_NUMBER_ONE", "HELM_UP"] as const;
export const helmetStyles = ["MODERN", "CLASSIC", "ANGULAR", "COMPACT"] as const;
export const helmetPatterns = ["NONE", "STRIPES", "CHEVRON", "GEOMETRIC", "SPLIT"] as const;
export const helmetModes = ["OFF", "CARRIED", "WORN_OPEN", "WORN_CLOSED"] as const;
export const backgrounds = ["FRL_BLUE", "TEAM_GLOW", "GRID", "PIT_WALL"] as const;
export const suitPatterns = ["CLEAN", "SHOULDER", "DIAGONAL", "CENTER_STRIPE", "SIDE_STRIPES"] as const;

const hexColor = z.string().regex(/^#[0-9A-F]{6}$/i);

export const driverCharacterConfigurationSchema = z.object({
  version: z.literal(1),
  bodyShape: z.enum(bodyShapes),
  faceShape: z.enum(faceShapes),
  skinTone: z.enum(skinTones),
  eyeShape: z.enum(eyeShapes),
  eyeColor: z.enum(eyeColors),
  eyebrowStyle: z.enum(eyebrowStyles),
  noseStyle: z.enum(noseStyles),
  mouthStyle: z.enum(mouthStyles),
  hairStyle: z.enum(hairStyles),
  hairColor: z.enum(hairColors),
  beardStyle: z.enum(beardStyles),
  eyewearStyle: z.enum(eyewearStyles),
  faceDetail: z.enum(faceDetails),
  helmet: z.object({
    style: z.enum(helmetStyles),
    primaryColor: hexColor,
    secondaryColor: hexColor,
    accentColor: hexColor,
    pattern: z.enum(helmetPatterns),
    mode: z.enum(helmetModes),
    showNumber: z.boolean(),
    showInitials: z.boolean(),
    showFlag: z.boolean(),
    finish: z.enum(["MATTE", "GLOSS"]),
  }),
  gloves: z.enum(["TEAM", "BLACK", "WHITE"]),
  shoes: z.enum(["TEAM", "BLACK", "WHITE"]),
  background: z.enum(backgrounds),
}).strict();

export const teamSuitConfigurationSchema = z.object({
  version: z.literal(1),
  primaryColor: hexColor,
  secondaryColor: hexColor,
  accentColor: hexColor,
  pattern: z.enum(suitPatterns),
  collarColor: hexColor,
  sleeveStyle: z.enum(["SOLID", "CONTRAST", "STRIPED"]),
  sideStripes: z.boolean(),
  chestLogoAsset: z.string().regex(/^\/(images|uploads\/teams)\/[a-zA-Z0-9/_-]+\.(png|webp|svg)$/).nullable(),
  smallLogoAssets: z.array(z.string().regex(/^\/(images|uploads\/teams)\/[a-zA-Z0-9/_-]+\.(png|webp|svg)$/)).max(4),
  helmetBase: z.enum(helmetStyles),
}).strict();

export const saveDriverCharacterSchema = z.object({
  configuration: driverCharacterConfigurationSchema,
  normalPose: z.enum(normalPoses),
  winnerPose: z.enum(winnerPoses),
  suitVariantId: z.number().int().positive().nullable(),
}).superRefine((value, context) => {
  if (JSON.stringify(value).length > 8_192) context.addIssue({ code: "custom", message: "Charakterkonfiguration ist zu groß." });
});

export const driverCharacterSnapshotSchema = z.object({
  version: z.literal(1),
  characterVersion: z.number().int().positive(),
  configuration: driverCharacterConfigurationSchema,
  normalPose: z.enum(normalPoses),
  winnerPose: z.enum(winnerPoses),
  driverNumber: z.number().int().min(0).max(999),
  flag: z.string().trim().min(1).max(16),
  teamSuit: teamSuitConfigurationSchema,
  suitTemplateId: z.number().int().positive().nullable(),
}).strict();

export type DriverCharacterSnapshot = z.infer<typeof driverCharacterSnapshotSchema>;

export const teamSuitTemplateInputSchema = z.object({
  id: z.number().int().positive().optional(),
  organizationId: z.number().int().positive(),
  name: z.string().trim().min(2).max(120),
  configuration: teamSuitConfigurationSchema,
  active: z.boolean(),
  displayOrder: z.number().int().min(0).max(100),
});

export type DriverCharacterConfiguration = z.infer<typeof driverCharacterConfigurationSchema>;
export type TeamSuitConfiguration = z.infer<typeof teamSuitConfigurationSchema>;
export type NormalPose = (typeof normalPoses)[number];
export type WinnerPose = (typeof winnerPoses)[number];

export const defaultDriverCharacter: DriverCharacterConfiguration = {
  version: 1,
  bodyShape: "ATHLETIC",
  faceShape: "OVAL",
  skinTone: "TONE_3",
  eyeShape: "ALMOND",
  eyeColor: "BROWN",
  eyebrowStyle: "DEFINED",
  noseStyle: "STRAIGHT",
  mouthStyle: "CONFIDENT",
  hairStyle: "SHORT",
  hairColor: "DARK_BROWN",
  beardStyle: "NONE",
  eyewearStyle: "NONE",
  faceDetail: "NONE",
  helmet: { style: "MODERN", primaryColor: "#0B3A82", secondaryColor: "#F8FAFC", accentColor: "#22D3EE", pattern: "STRIPES", mode: "OFF", showNumber: true, showInitials: false, showFlag: true, finish: "GLOSS" },
  gloves: "TEAM",
  shoes: "BLACK",
  background: "FRL_BLUE",
};

export const neutralFrlSuit: TeamSuitConfiguration = {
  version: 1,
  primaryColor: "#0B3A82",
  secondaryColor: "#111827",
  accentColor: "#22D3EE",
  pattern: "SHOULDER",
  collarColor: "#F8FAFC",
  sleeveStyle: "CONTRAST",
  sideStripes: true,
  chestLogoAsset: null,
  smallLogoAssets: [],
  helmetBase: "MODERN",
};

export function parseCharacterConfiguration(value: unknown): DriverCharacterConfiguration {
  return driverCharacterConfigurationSchema.safeParse(value).data ?? defaultDriverCharacter;
}

export function parseSuitConfiguration(value: unknown, fallback = neutralFrlSuit): TeamSuitConfiguration {
  return teamSuitConfigurationSchema.safeParse(value).data ?? fallback;
}
