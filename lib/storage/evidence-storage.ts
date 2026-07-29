import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEvidenceStorageConfig } from "@/lib/storage/evidence-config";
import {
  safeEvidenceFilename,
  validateVideoMetadata,
} from "@/lib/storage/evidence-constants";
import type { UploadedVideoMetadata } from "@/lib/storage/evidence-types";

type VideoUploadInput = {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

export class EvidenceStorageError extends Error {
  constructor(
    public readonly code: string,
    options?: ErrorOptions,
  ) {
    super(code, options);
    this.name = "EvidenceStorageError";
  }
}

let cachedClient: SupabaseClient | undefined;
let cachedClientKey = "";

function storageClient(): SupabaseClient {
  const config = getEvidenceStorageConfig();
  const key = `${config.supabaseUrl}:${config.serviceRoleKey}`;

  if (!cachedClient || cachedClientKey !== key) {
    cachedClient = createClient(
      config.supabaseUrl,
      config.serviceRoleKey,
      {
        auth: {
          autoRefreshToken: false,
          detectSessionInUrl: false,
          persistSession: false,
        },
      },
    );
    cachedClientKey = key;
  }

  return cachedClient;
}

function extensionForMimeType(mimeType: string): "mp4" | "mov" | "webm" {
  if (mimeType === "video/quicktime") return "mov";
  if (mimeType === "video/webm") return "webm";
  return "mp4";
}

export function isOwnedPendingStoragePath(
  storagePath: string,
  userId: number,
): boolean {
  return storagePath.startsWith(`pending/${userId}/`);
}

export function validateVideoUploadInput(input: VideoUploadInput): void {
  const { limits } = getEvidenceStorageConfig();
  const validationError = validateVideoMetadata(
    input.mimeType,
    input.fileSize,
    limits.maxFileSizeBytes,
    limits.allowedMimeTypes,
  );
  if (validationError) throw new Error(validationError);
}

export async function createSignedVideoUpload(
  userId: number,
  input: VideoUploadInput,
): Promise<{ signedUrl: string; storagePath: string }> {
  validateVideoUploadInput(input);
  const config = getEvidenceStorageConfig();
  const extension = extensionForMimeType(input.mimeType.toLowerCase());
  const storagePath = `pending/${userId}/${crypto.randomUUID()}.${extension}`;
  const { data, error } = await storageClient()
    .storage.from(config.bucket)
    .createSignedUploadUrl(storagePath, { upsert: false });

  if (error || !data) {
    throw new EvidenceStorageError("SIGNED_UPLOAD_FAILED", {
      cause: error,
    });
  }

  return { signedUrl: data.signedUrl, storagePath };
}

function hasMp4FamilySignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    bytes[4] === 0x66 &&
    bytes[5] === 0x74 &&
    bytes[6] === 0x79 &&
    bytes[7] === 0x70
  );
}

function hasWebmSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 4 &&
    bytes[0] === 0x1a &&
    bytes[1] === 0x45 &&
    bytes[2] === 0xdf &&
    bytes[3] === 0xa3
  );
}

async function readSignature(storagePath: string): Promise<Uint8Array> {
  const config = getEvidenceStorageConfig();
  const encodedBucket = encodeURIComponent(config.bucket);
  const encodedPath = storagePath
    .split("/")
    .map(encodeURIComponent)
    .join("/");
  let response: Response;

  try {
    response = await fetch(
      `${config.supabaseUrl}/storage/v1/object/${encodedBucket}/${encodedPath}`,
      {
        cache: "no-store",
        headers: {
          apikey: config.serviceRoleKey,
          Authorization: `Bearer ${config.serviceRoleKey}`,
          Range: "bytes=0-63",
        },
        signal: AbortSignal.timeout(15_000),
      },
    );
  } catch (error: unknown) {
    throw new EvidenceStorageError("VIDEO_SIGNATURE_READ_FAILED", {
      cause: error,
    });
  }

  if (!response.ok) {
    throw new EvidenceStorageError("VIDEO_SIGNATURE_READ_FAILED");
  }

  const value = new Uint8Array(await response.arrayBuffer());
  if (value.length === 0) {
    throw new EvidenceStorageError("VIDEO_SIGNATURE_READ_FAILED");
  }
  return value.slice(0, 64);
}

export async function verifyStoredVideo(
  userId: number,
  input: VideoUploadInput & {
    temporaryUploadId: string;
    storagePath: string;
    label: string;
  },
): Promise<UploadedVideoMetadata> {
  validateVideoUploadInput(input);

  if (!isOwnedPendingStoragePath(input.storagePath, userId)) {
    throw new EvidenceStorageError("INVALID_STORAGE_PATH");
  }

  const config = getEvidenceStorageConfig();
  const { data, error } = await storageClient()
    .storage.from(config.bucket)
    .info(input.storagePath);

  if (error || !data) {
    throw new EvidenceStorageError("UPLOADED_VIDEO_NOT_FOUND", {
      cause: error,
    });
  }

  const storedMimeType = data.contentType?.split(";")[0]?.toLowerCase();
  if (
    data.size !== input.fileSize ||
    storedMimeType !== input.mimeType.toLowerCase() ||
    !config.limits.allowedMimeTypes.includes(storedMimeType)
  ) {
    throw new EvidenceStorageError("UPLOADED_VIDEO_METADATA_MISMATCH");
  }

  const signature = await readSignature(input.storagePath);
  const signatureIsValid =
    storedMimeType === "video/webm"
      ? hasWebmSignature(signature)
      : hasMp4FamilySignature(signature);

  if (!signatureIsValid) {
    throw new EvidenceStorageError("UPLOADED_VIDEO_SIGNATURE_INVALID");
  }

  return {
    kind: "upload",
    temporaryUploadId: input.temporaryUploadId,
    storagePath: input.storagePath,
    originalFilename: safeEvidenceFilename(input.originalFilename),
    mimeType: storedMimeType,
    fileSize: data.size,
    label: input.label,
    uploadedAt: data.createdAt,
  };
}

export async function createSignedVideoViewUrl(
  storagePath: string,
  expiresIn?: number,
): Promise<string> {
  const config = getEvidenceStorageConfig();
  const { data, error } = await storageClient()
    .storage.from(config.bucket)
    .createSignedUrl(
      storagePath,
      expiresIn ?? config.signedUrlTtlSeconds,
    );

  if (error || !data) {
    throw new EvidenceStorageError("SIGNED_VIEW_URL_FAILED", {
      cause: error,
    });
  }

  return data.signedUrl;
}

export async function removeStoredEvidenceFiles(
  storagePaths: string[],
): Promise<void> {
  if (storagePaths.length === 0) return;
  const config = getEvidenceStorageConfig();
  const uniquePaths = [...new Set(storagePaths)];
  const { error } = await storageClient()
    .storage.from(config.bucket)
    .remove(uniquePaths);

  if (error) {
    throw new EvidenceStorageError("STORAGE_CLEANUP_FAILED", {
      cause: error,
    });
  }
}
