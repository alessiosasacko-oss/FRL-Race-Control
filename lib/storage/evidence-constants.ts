export const MAX_FIA_VIDEO_SIZE_BYTES = 100 * 1024 * 1024;
export const MAX_FIA_VIDEO_FILES = 3;
export const FIA_VIDEO_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;
export const FIA_VIDEO_ACCEPT =
  ".mp4,.mov,.webm,video/mp4,video/quicktime,video/webm";

export type FiaVideoMimeType = (typeof FIA_VIDEO_MIME_TYPES)[number];

export type VideoMetadataValidationError =
  | "UNSUPPORTED_VIDEO_TYPE"
  | "VIDEO_TOO_LARGE"
  | "INVALID_VIDEO_SIZE";

export function validateVideoMetadata(
  mimeType: string,
  fileSize: number,
  maxFileSizeBytes = MAX_FIA_VIDEO_SIZE_BYTES,
  allowedMimeTypes: readonly string[] = FIA_VIDEO_MIME_TYPES,
): VideoMetadataValidationError | null {
  if (!allowedMimeTypes.includes(mimeType.trim().toLowerCase())) {
    return "UNSUPPORTED_VIDEO_TYPE";
  }
  if (!Number.isSafeInteger(fileSize) || fileSize <= 0) {
    return "INVALID_VIDEO_SIZE";
  }
  if (fileSize > maxFileSizeBytes) {
    return "VIDEO_TOO_LARGE";
  }
  return null;
}

export function safeEvidenceFilename(filename: string): string {
  const basename = filename
    .replaceAll("\\", "/")
    .split("/")
    .at(-1)
    ?.normalize("NFKC")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();

  return (basename || "video").slice(0, 255);
}
