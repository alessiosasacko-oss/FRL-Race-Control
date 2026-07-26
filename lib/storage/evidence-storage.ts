import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getEvidenceStorageConfig } from "@/lib/storage/evidence-config";
import type { UploadedVideoMetadata } from "@/lib/storage/evidence-types";

type VideoUploadInput = {
  originalFilename: string;
  mimeType: string;
  fileSize: number;
};

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
  const normalizedMimeType = input.mimeType.toLowerCase();

  if (!limits.allowedMimeTypes.includes(normalizedMimeType)) {
    throw new Error("UNSUPPORTED_VIDEO_TYPE");
  }

  if (input.fileSize > limits.maxFileSizeBytes) {
    throw new Error("VIDEO_TOO_LARGE");
  }
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
    throw new Error("SIGNED_UPLOAD_FAILED", { cause: error });
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
  const signedUrl = await createSignedVideoViewUrl(storagePath, 60);
  const response = await fetch(signedUrl, {
    cache: "no-store",
    headers: { Range: "bytes=0-63" },
  });

  if (!response.ok) {
    throw new Error("VIDEO_SIGNATURE_READ_FAILED");
  }

  const reader = response.body?.getReader();
  if (!reader) throw new Error("VIDEO_SIGNATURE_READ_FAILED");
  const { value } = await reader.read();
  await reader.cancel();
  if (!value) throw new Error("VIDEO_SIGNATURE_READ_FAILED");
  return value.slice(0, 64);
}

export async function verifyStoredVideo(
  userId: number,
  input: VideoUploadInput & {
    storagePath: string;
    label: string;
  },
): Promise<UploadedVideoMetadata> {
  validateVideoUploadInput(input);

  if (!isOwnedPendingStoragePath(input.storagePath, userId)) {
    throw new Error("INVALID_STORAGE_PATH");
  }

  const config = getEvidenceStorageConfig();
  const { data, error } = await storageClient()
    .storage.from(config.bucket)
    .info(input.storagePath);

  if (error || !data) {
    throw new Error("UPLOADED_VIDEO_NOT_FOUND", { cause: error });
  }

  const storedMimeType = data.contentType?.split(";")[0]?.toLowerCase();
  if (
    data.size !== input.fileSize ||
    storedMimeType !== input.mimeType.toLowerCase() ||
    !config.limits.allowedMimeTypes.includes(storedMimeType)
  ) {
    throw new Error("UPLOADED_VIDEO_METADATA_MISMATCH");
  }

  const signature = await readSignature(input.storagePath);
  const signatureIsValid =
    storedMimeType === "video/webm"
      ? hasWebmSignature(signature)
      : hasMp4FamilySignature(signature);

  if (!signatureIsValid) {
    throw new Error("UPLOADED_VIDEO_SIGNATURE_INVALID");
  }

  return {
    kind: "upload",
    storagePath: input.storagePath,
    originalFilename: input.originalFilename,
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
    throw new Error("SIGNED_VIEW_URL_FAILED", { cause: error });
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
    throw new Error("STORAGE_CLEANUP_FAILED", { cause: error });
  }
}
