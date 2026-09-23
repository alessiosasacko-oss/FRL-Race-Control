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
  const bucket = process.env.SUPABASE_DRIVER_IMAGE_BUCKET?.trim() || "driver-images";
  if (!url || !serviceRoleKey) throw new DriverImageStorageError("DRIVER_IMAGE_STORAGE_NOT_CONFIGURED");
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

async function processImage(file: File) {
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
      .resize({ width: DRIVER_IMAGE_MAX_EDGE, height: DRIVER_IMAGE_MAX_EDGE, fit: "cover", position: "attention", withoutEnlargement: true })
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

export async function uploadDriverImage(file: File, driverId: number) {
  const { original, thumbnail } = await processImage(file);
  const storage = config();
  const uuid = crypto.randomUUID();
  const storagePath = `${driverId}/${uuid}.webp`;
  const thumbnailPath = `${driverId}/${uuid}-thumb.webp`;
  const bucket = client().storage.from(storage.bucket);
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

export function ownedDriverImagePaths(imageUrl: string | null, driverId: number): string[] {
  if (!imageUrl) return [];
  const storage = config();
  try {
    const parsed = new URL(imageUrl);
    const expectedOrigin = new URL(storage.url).origin;
    const bucketPrefix = `/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`;
    if (parsed.origin !== expectedOrigin || !parsed.pathname.startsWith(`${bucketPrefix}${driverId}/`)) return [];
    const path = decodeURIComponent(parsed.pathname.slice(bucketPrefix.length));
    if (!path.startsWith(`${driverId}/`) || !path.endsWith(".webp") || path.includes("..")) return [];
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
