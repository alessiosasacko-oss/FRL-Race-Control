export const MAX_BACKGROUND_IMAGE_BYTES = 10 * 1024 * 1024;
export const BACKGROUND_IMAGE_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"] as const;

export type BackgroundImageMimeType = (typeof BACKGROUND_IMAGE_MIME_TYPES)[number];

export class BackgroundImageError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "BackgroundImageError";
  }
}

function extensionFor(fileName: string) {
  return fileName.trim().toLowerCase().split(".").pop() ?? "";
}

function pngDimensions(bytes: Uint8Array) {
  const signature = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (bytes.length < 24 || !signature.every((value, index) => bytes[index] === value)) return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return { width: view.getUint32(16), height: view.getUint32(20) };
}

function jpegDimensions(bytes: Uint8Array) {
  if (bytes.length < 10 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  const sof = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
  let offset = 2;
  while (offset + 8 < bytes.length) {
    if (bytes[offset] !== 0xff) { offset += 1; continue; }
    const marker = bytes[offset + 1];
    if (marker === 0xd8 || marker === 0xd9) { offset += 2; continue; }
    const length = (bytes[offset + 2] << 8) | bytes[offset + 3];
    if (length < 2 || offset + length + 2 > bytes.length) return null;
    if (sof.has(marker)) {
      return {
        height: (bytes[offset + 5] << 8) | bytes[offset + 6],
        width: (bytes[offset + 7] << 8) | bytes[offset + 8],
      };
    }
    offset += length + 2;
  }
  return null;
}

function webpDimensions(bytes: Uint8Array) {
  const ascii = (start: number, end: number) => new TextDecoder("ascii").decode(bytes.slice(start, end));
  if (bytes.length < 30 || ascii(0, 4) !== "RIFF" || ascii(8, 12) !== "WEBP") return null;
  const kind = ascii(12, 16);
  if (kind === "VP8X") {
    return {
      width: 1 + bytes[24] + (bytes[25] << 8) + (bytes[26] << 16),
      height: 1 + bytes[27] + (bytes[28] << 8) + (bytes[29] << 16),
    };
  }
  if (kind === "VP8L" && bytes[20] === 0x2f) {
    return {
      width: 1 + bytes[21] + ((bytes[22] & 0x3f) << 8),
      height: 1 + ((bytes[22] & 0xc0) >> 6) + (bytes[23] << 2) + ((bytes[24] & 0x0f) << 10),
    };
  }
  if (kind === "VP8 " && bytes[23] === 0x9d && bytes[24] === 0x01 && bytes[25] === 0x2a) {
    return {
      width: (bytes[26] | (bytes[27] << 8)) & 0x3fff,
      height: (bytes[28] | (bytes[29] << 8)) & 0x3fff,
    };
  }
  return null;
}

export function validateBackgroundImage(fileName: string, mimeType: string, size: number, bytes: Uint8Array) {
  const normalizedMime = mimeType.trim().toLowerCase();
  if (!BACKGROUND_IMAGE_MIME_TYPES.includes(normalizedMime as BackgroundImageMimeType)) {
    throw new BackgroundImageError("UNSUPPORTED_BACKGROUND_TYPE");
  }
  if (!Number.isInteger(size) || size <= 0 || size > MAX_BACKGROUND_IMAGE_BYTES || bytes.length !== size) {
    throw new BackgroundImageError("INVALID_BACKGROUND_SIZE");
  }
  const extension = extensionFor(fileName);
  const allowedExtension = normalizedMime === "image/jpeg"
    ? extension === "jpg" || extension === "jpeg"
    : normalizedMime === "image/png"
      ? extension === "png"
      : extension === "webp";
  if (!allowedExtension) throw new BackgroundImageError("BACKGROUND_EXTENSION_MISMATCH");

  const dimensions = normalizedMime === "image/jpeg"
    ? jpegDimensions(bytes)
    : normalizedMime === "image/png"
      ? pngDimensions(bytes)
      : webpDimensions(bytes);
  if (!dimensions) throw new BackgroundImageError("INVALID_BACKGROUND_SIGNATURE");
  if (dimensions.width < 320 || dimensions.height < 320 || dimensions.width > 10000 || dimensions.height > 10000) {
    throw new BackgroundImageError("INVALID_BACKGROUND_DIMENSIONS");
  }
  return { mimeType: normalizedMime as BackgroundImageMimeType, extension, ...dimensions };
}
