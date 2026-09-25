export const DRIVER_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
export const DRIVER_IMAGE_MAX_EDGE = 1200;
export const DRIVER_IMAGE_THUMB_EDGE = 256;
export const DRIVER_IMAGE_MIME_TYPES = [
  "image/png",
  "image/webp",
  "image/jpeg",
] as const;

export type DriverImageMimeType = (typeof DRIVER_IMAGE_MIME_TYPES)[number];

export class DriverImageError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "DriverImageError";
  }
}

function extension(fileName: string): string {
  return fileName.trim().toLowerCase().split(".").pop() ?? "";
}

function png(bytes: Uint8Array): boolean {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  return bytes.length >= signature.length && signature.every((value, index) => bytes[index] === value);
}

function jpeg(bytes: Uint8Array): boolean {
  return bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes.at(-2) === 0xff && bytes.at(-1) === 0xd9;
}

function webp(bytes: Uint8Array): boolean {
  if (bytes.length < 12) return false;
  const ascii = (start: number, end: number) => new TextDecoder("ascii").decode(bytes.slice(start, end));
  return ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP";
}

export function validateDriverImageFile(
  fileName: string,
  mimeType: string,
  size: number,
  bytes: Uint8Array,
): DriverImageMimeType {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (!DRIVER_IMAGE_MIME_TYPES.includes(normalizedMime as DriverImageMimeType)) {
    throw new DriverImageError("UNSUPPORTED_DRIVER_IMAGE_TYPE");
  }
  if (!Number.isInteger(size) || size <= 0 || size > DRIVER_IMAGE_MAX_BYTES || bytes.length !== size) {
    throw new DriverImageError("INVALID_DRIVER_IMAGE_SIZE");
  }
  const suffix = extension(fileName);
  const extensionMatches = normalizedMime === "image/png"
    ? suffix === "png"
    : normalizedMime === "image/webp"
      ? suffix === "webp"
      : suffix === "jpg" || suffix === "jpeg";
  if (!extensionMatches) throw new DriverImageError("DRIVER_IMAGE_EXTENSION_MISMATCH");

  const signatureMatches = normalizedMime === "image/png"
    ? png(bytes)
    : normalizedMime === "image/webp"
      ? webp(bytes)
      : jpeg(bytes);
  if (!signatureMatches) throw new DriverImageError("INVALID_DRIVER_IMAGE_SIGNATURE");
  return normalizedMime as DriverImageMimeType;
}

export function driverImageThumbnailUrl(imageUrl: string | null | undefined): string | null {
  if (!imageUrl) return null;
  const generatedOriginal = /\/(?:drivers\/)?\d+\/[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\.webp(?=\?|$)/i;
  return generatedOriginal.test(imageUrl) ? imageUrl.replace(/\.webp(?=\?|$)/i, "-thumb.webp") : imageUrl;
}
