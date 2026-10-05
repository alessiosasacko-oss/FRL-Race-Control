import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  DRIVER_IMAGE_MAX_EDGE,
  DRIVER_IMAGE_THUMB_EDGE,
  DriverImageError,
  validateDriverImageFile,
} from "./driver-image";

export class DriverImageStorageError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "DriverImageStorageError";
  }
}

let cachedClient: SupabaseClient | undefined;
let cachedKey = "";

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_DRIVER_IMAGE_BUCKET?.trim()
    || process.env.SUPABASE_STORAGE_BUCKET?.trim();
  if (!url || !serviceRoleKey || !bucket) {
    throw new DriverImageStorageError("DRIVER_IMAGE_STORAGE_NOT_CONFIGURED");
  }
  return { url, serviceRoleKey, bucket };
}

function client(): SupabaseClient {
  const storage = config();
  const key = `${storage.url}:${storage.serviceRoleKey}`;
  if (!cachedClient || cachedKey !== key) {
    cachedClient = createClient(storage.url, storage.serviceRoleKey, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    cachedKey = key;
  }
  return cachedClient;
}

export async function processDriverImage(file: File, purpose: "profile" | "result" = "profile") {
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateDriverImageFile(file.name, file.type, file.size, bytes);
  try {
    const source = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 10_000 || metadata.height > 10_000) {
      throw new DriverImageError("INVALID_DRIVER_IMAGE_DIMENSIONS");
    }
    const original = await source
      .clone()
      .resize(purpose === "result"
        ? { width: 1400, height: 1800, fit: "inside", withoutEnlargement: true }
        : { width: DRIVER_IMAGE_MAX_EDGE, height: DRIVER_IMAGE_MAX_EDGE, fit: "cover", position: "attention", withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100, effort: 5 })
      .toBuffer();
    const thumbnail = await source
      .clone()
      .resize({ width: DRIVER_IMAGE_THUMB_EDGE, height: DRIVER_IMAGE_THUMB_EDGE, fit: "cover", position: "attention" })
      .webp({ quality: 84, alphaQuality: 100, effort: 5 })
      .toBuffer();
    return { original, thumbnail };
  } catch (error: unknown) {
    if (error instanceof DriverImageError) throw error;
    throw new DriverImageError("DRIVER_IMAGE_PROCESSING_FAILED");
  }
}

async function publicBucket() {
  const storage = config();
  const result = await client().storage.getBucket(storage.bucket);
  if (result.error || !result.data) {
    throw new DriverImageStorageError("DRIVER_IMAGE_BUCKET_UNAVAILABLE", {
      cause: result.error ?? undefined,
    });
  }
  if (!result.data.public) {
    throw new DriverImageStorageError("DRIVER_IMAGE_BUCKET_PRIVATE");
  }
  return client().storage.from(storage.bucket);
}

export async function uploadDriverImage(file: File, driverId: number, purpose: "profile" | "result" = "profile") {
  return uploadImageAtNamespace(file, purpose === "result" ? `drivers/${driverId}/result` : `drivers/${driverId}`, purpose);
}

export async function uploadTeamDriverRender(file: File, organizationId: number, slot: 1 | 2) {
  return uploadImageAtNamespace(file, `team-driver-renders/${organizationId}/driver-${slot}`, "result");
}

async function uploadImageAtNamespace(file: File, namespace: string, purpose: "profile" | "result") {
  const { original, thumbnail } = await processDriverImage(file, purpose);
  const uuid = crypto.randomUUID();
  const storagePath = `${namespace}/${uuid}.webp`;
  const thumbnailPath = `${namespace}/${uuid}-thumb.webp`;
  const bucket = await publicBucket();
  const uploaded = await bucket.upload(storagePath, original, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });
  if (uploaded.error) throw new DriverImageStorageError("DRIVER_IMAGE_UPLOAD_FAILED", { cause: uploaded.error });
  const thumbUploaded = await bucket.upload(thumbnailPath, thumbnail, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });
  if (thumbUploaded.error) {
    await bucket.remove([storagePath]);
    throw new DriverImageStorageError("DRIVER_IMAGE_UPLOAD_FAILED", { cause: thumbUploaded.error });
  }
  return { imageUrl: bucket.getPublicUrl(storagePath).data.publicUrl, storagePath, thumbnailPath };
}

export function ownedTeamDriverRenderPaths(imageUrl: string | null, organizationId: number, slot: 1 | 2): string[] {
  if (!imageUrl) return [];
  const storage = config();
  try {
    const url = new URL(imageUrl);
    const prefix = `/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`;
    if (url.origin !== new URL(storage.url).origin || !url.pathname.startsWith(prefix)) return [];
    const key = decodeURIComponent(url.pathname.slice(prefix.length));
    if (!new RegExp(`^team-driver-renders/${organizationId}/driver-${slot}/[a-f0-9-]+\\.webp$`).test(key)) return [];
    return [key, key.replace(/\.webp$/, "-thumb.webp")];
  } catch { return []; }
}

export function ownedDriverImagePaths(imageUrl: string | null, driverId: number): string[] {
  if (!imageUrl) return [];
  const storage = config();
  try {
    const parsed = new URL(imageUrl);
    const expectedOrigin = new URL(storage.url).origin;
    const bucketPrefix = `/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`;
    if (parsed.origin !== expectedOrigin || !parsed.pathname.startsWith(bucketPrefix)) return [];
    const path = decodeURIComponent(parsed.pathname.slice(bucketPrefix.length));
    const currentPath = `drivers/${driverId}/`;
    const legacyPath = `${driverId}/`;
    if (
      (!path.startsWith(currentPath) && !path.startsWith(legacyPath))
      || !path.endsWith(".webp")
      || path.includes("..")
    ) return [];
    return [path, path.replace(/\.webp$/, "-thumb.webp")];
  } catch {
    return [];
  }
}

export async function removeDriverImageFiles(paths: readonly string[]): Promise<void> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return;
  const { error } = await client().storage.from(config().bucket).remove(unique);
  if (error) throw new DriverImageStorageError("DRIVER_IMAGE_REMOVE_FAILED", { cause: error });
}
