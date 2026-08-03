export const TEAM_LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const TEAM_LOGO_MAX_EDGE = 1024;
export const TEAM_LOGO_THUMB_EDGE = 256;
export const TEAM_LOGO_MIME_TYPES = [
  "image/png",
  "image/webp",
  "image/jpeg",
] as const;

export type TeamLogoMimeType = (typeof TEAM_LOGO_MIME_TYPES)[number];

export class TeamLogoImageError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TeamLogoImageError";
  }
}

function fileExtension(fileName: string): string {
  return fileName.trim().toLowerCase().split(".").pop() ?? "";
}

function hasPngSignature(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function hasJpegSignature(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ascii = (start: number, end: number) => new TextDecoder("ascii").decode(bytes.slice(start, end));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

export function validateTeamLogoFile(
  fileName: string,
  mimeType: string,
  size: number,
  bytes: Uint8Array,
): TeamLogoMimeType {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (!TEAM_LOGO_MIME_TYPES.includes(normalizedMime as TeamLogoMimeType)) {
    throw new TeamLogoImageError("UNSUPPORTED_TEAM_LOGO_TYPE");
  }
  if (!Number.isInteger(size) || size <= 0 || size > TEAM_LOGO_MAX_BYTES || bytes.length !== size) {
    throw new TeamLogoImageError("INVALID_TEAM_LOGO_SIZE");
  }

  const extension = fileExtension(fileName);
  const extensionMatches = normalizedMime === "image/png"
    ? extension === "png"
    : normalizedMime === "image/webp"
      ? extension === "webp"
      : extension === "jpg" || extension === "jpeg";
  if (!extensionMatches) throw new TeamLogoImageError("TEAM_LOGO_EXTENSION_MISMATCH");

  const signatureMatches = normalizedMime === "image/png"
    ? hasPngSignature(bytes)
    : normalizedMime === "image/webp"
      ? hasWebpSignature(bytes)
      : hasJpegSignature(bytes);
  if (!signatureMatches) throw new TeamLogoImageError("INVALID_TEAM_LOGO_SIGNATURE");

  return normalizedMime as TeamLogoMimeType;
}

export function teamLogoThumbnailUrl(logoUrl: string | null | undefined): string | null {
  if (!logoUrl) return null;
  return logoUrl.endsWith(".webp") ? logoUrl.replace(/\.webp$/, "-thumb.webp") : logoUrl;
}
