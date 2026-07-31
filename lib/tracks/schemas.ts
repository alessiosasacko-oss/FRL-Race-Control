import { z } from "zod";
import { assetReferenceSchema, hexColorSchema } from "@/lib/design/theme";

const optionalNumber = (schema: z.ZodNumber) =>
  z.preprocess(
    (value) => value === "" || value === null ? null : value,
    z.coerce.number().pipe(schema).nullable(),
  );

export const trackSchema = z.object({
  name: z.string().trim().min(2).max(160),
  countryCode: z.string().trim().length(2).transform((value) => value.toUpperCase()),
  lengthKm: optionalNumber(z.number().positive().max(100)),
  lapCount: optionalNumber(z.number().int().positive().max(500)),
  totalDistanceKm: optionalNumber(z.number().positive().max(5000)),
  sectorCount: z.coerce.number().int().min(1).max(10),
  drsZones: optionalNumber(z.number().int().min(0).max(20)),
  overtakePoints: optionalNumber(z.number().int().min(0).max(50)),
  longestStraightM: optionalNumber(z.number().int().positive().max(10000)),
  poleSide: z.preprocess((value) => value === "" ? null : value, z.enum(["LEFT", "RIGHT"]).nullable()),
  pitLaneLossSeconds: optionalNumber(z.number().positive().max(300)),
  notes: z.preprocess((value) => value === "" ? null : value, z.string().trim().max(4000).nullable()),
  active: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  layoutAsset: z.preprocess((value) => value ?? "", assetReferenceSchema),
  layoutMimeType: z.preprocess((value) => value === "" ? null : value, z.enum(["image/svg+xml", "image/png", "image/webp"]).nullable()),
  heroAsset: z.preprocess((value) => value ?? "", assetReferenceSchema),
  mobileHeroAsset: z.preprocess((value) => value ?? "", assetReferenceSchema),
  trackLogoAsset: z.preprocess((value) => value ?? "", assetReferenceSchema),
  primaryColor: hexColorSchema,
  secondaryColor: hexColorSchema,
  overlayStrength: z.coerce.number().int().min(20).max(90),
  imagePosition: z.enum(["left", "center", "right"]),
  imageCrop: z.enum(["cover", "contain"]),
  lightBannerText: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  useThemeLayoutColor: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  layoutColor: z.preprocess((value) => value === "" ? null : value, hexColorSchema.nullable()),
  lineWidth: z.coerce.number().int().min(1).max(12),
  showStartFinish: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  showSectors: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  showDrsZones: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  showOvertakePoints: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  showCornerNumbers: z.preprocess((value) => value === "on" || value === true, z.boolean()),
}).strict();

export type TrackInput = z.infer<typeof trackSchema>;
