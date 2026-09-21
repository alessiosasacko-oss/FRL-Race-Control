export const RACE_HERO_MAX_BYTES = 10 * 1024 * 1024;

export const raceHeroVariants = {
  desktop: { width: 1920, height: 1080, minWidth: 1280, minHeight: 640 },
  mobile: { width: 1080, height: 1350, minWidth: 720, minHeight: 900 },
} as const;

export type RaceHeroVariant = keyof typeof raceHeroVariants;

const allowedMimeTypes = ["image/jpeg", "image/png", "image/webp"] as const;
type RaceHeroMimeType = (typeof allowedMimeTypes)[number];

export class RaceHeroImageError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "RaceHeroImageError";
  }
}

function hasSignature(mimeType: RaceHeroMimeType, bytes: Uint8Array): boolean {
  if (mimeType === "image/png") {
    return bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
      .every((value, index) => bytes[index] === value);
  }
  if (mimeType === "image/webp") {
    return bytes.length >= 12 &&
      new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
      new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP";
  }
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

export function validateRaceHeroFile(
  fileName: string,
  mimeType: string,
  size: number,
  bytes: Uint8Array,
): RaceHeroMimeType {
  if (!allowedMimeTypes.includes(mimeType as RaceHeroMimeType)) {
    throw new RaceHeroImageError("UNSUPPORTED_RACE_HERO_TYPE");
  }
  if (size <= 0 || size > RACE_HERO_MAX_BYTES || bytes.length !== size) {
    throw new RaceHeroImageError("INVALID_RACE_HERO_SIZE");
  }
  const expectedExtensions: Record<RaceHeroMimeType, readonly string[]> = {
    "image/jpeg": ["jpg", "jpeg"],
    "image/png": ["png"],
    "image/webp": ["webp"],
  };
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const normalizedMime = mimeType as RaceHeroMimeType;
  if (!expectedExtensions[normalizedMime].includes(extension)) {
    throw new RaceHeroImageError("RACE_HERO_EXTENSION_MISMATCH");
  }
  if (!hasSignature(normalizedMime, bytes)) {
    throw new RaceHeroImageError("INVALID_RACE_HERO_SIGNATURE");
  }
  return normalizedMime;
}

export function validateRaceHeroDimensions(
  variant: RaceHeroVariant,
  width: number,
  height: number,
): void {
  const target = raceHeroVariants[variant];
  if (width < target.minWidth || height < target.minHeight || width > 12_000 || height > 12_000) {
    throw new RaceHeroImageError(
      variant === "desktop" ? "INVALID_DESKTOP_HERO_DIMENSIONS" : "INVALID_MOBILE_HERO_DIMENSIONS",
    );
  }
  const ratio = width / height;
  if ((variant === "desktop" && (ratio < 1.35 || ratio > 2.5)) ||
      (variant === "mobile" && (ratio < 0.5 || ratio > 1.05))) {
    throw new RaceHeroImageError(
      variant === "desktop" ? "INVALID_DESKTOP_HERO_RATIO" : "INVALID_MOBILE_HERO_RATIO",
    );
  }
}
