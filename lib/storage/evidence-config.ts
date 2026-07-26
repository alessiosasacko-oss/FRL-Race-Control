import "server-only";

import type { VideoUploadLimits } from "@/lib/storage/evidence-types";

const DEFAULT_MAX_FILE_SIZE_MB = 100;
const DEFAULT_MAX_FILES = 3;
const DEFAULT_SIGNED_URL_TTL_SECONDS = 300;
const DEFAULT_ALLOWED_MIME_TYPES = [
  "video/mp4",
  "video/quicktime",
  "video/webm",
] as const;

function positiveInteger(
  value: string | undefined,
  fallback: number,
  maximum: number,
): number {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0
    ? Math.min(parsed, maximum)
    : fallback;
}

function allowedMimeTypes(): string[] {
  const configured = process.env.FIA_EVIDENCE_ALLOWED_MIME_TYPES?.split(",")
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return configured?.length
    ? configured.filter((value) =>
        DEFAULT_ALLOWED_MIME_TYPES.includes(
          value as (typeof DEFAULT_ALLOWED_MIME_TYPES)[number],
        ),
      )
    : [...DEFAULT_ALLOWED_MIME_TYPES];
}

export function getVideoUploadLimits(): VideoUploadLimits {
  const maxFileSizeMb = positiveInteger(
    process.env.FIA_EVIDENCE_MAX_FILE_SIZE_MB,
    DEFAULT_MAX_FILE_SIZE_MB,
    500,
  );

  return {
    enabled: Boolean(
      process.env.SUPABASE_URL &&
        process.env.SUPABASE_SERVICE_ROLE_KEY &&
        process.env.SUPABASE_STORAGE_BUCKET,
    ),
    maxFileSizeBytes: maxFileSizeMb * 1024 * 1024,
    maxFiles: positiveInteger(
      process.env.FIA_EVIDENCE_MAX_FILES,
      DEFAULT_MAX_FILES,
      10,
    ),
    allowedMimeTypes: allowedMimeTypes(),
  };
}

export type EvidenceStorageConfig = {
  supabaseUrl: string;
  serviceRoleKey: string;
  bucket: string;
  signedUrlTtlSeconds: number;
  limits: VideoUploadLimits;
};

export function getEvidenceStorageConfig(): EvidenceStorageConfig {
  const limits = getVideoUploadLimits();
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const bucket = process.env.SUPABASE_STORAGE_BUCKET;

  if (!limits.enabled || !supabaseUrl || !serviceRoleKey || !bucket) {
    throw new Error("EVIDENCE_STORAGE_NOT_CONFIGURED");
  }

  return {
    supabaseUrl,
    serviceRoleKey,
    bucket,
    signedUrlTtlSeconds: positiveInteger(
      process.env.FIA_EVIDENCE_SIGNED_URL_TTL_SECONDS,
      DEFAULT_SIGNED_URL_TTL_SECONDS,
      3600,
    ),
    limits,
  };
}
