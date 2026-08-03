import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  TEAM_LOGO_MAX_EDGE,
  TEAM_LOGO_THUMB_EDGE,
  TeamLogoImageError,
  validateTeamLogoFile,
} from "./team-logo-image";

export class TeamLogoStorageError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "TeamLogoStorageError";
  }
}

let cachedClient: SupabaseClient | undefined;
let cachedKey = "";

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_TEAM_LOGO_BUCKET?.trim() || "team-logos";
  if (!url || !serviceRoleKey) throw new TeamLogoStorageError("TEAM_LOGO_STORAGE_NOT_CONFIGURED");
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

async function processLogo(file: File) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateTeamLogoFile(file.name, file.type, file.size, bytes);
  try {
    const source = sharp(bytes, { failOn: "error", limitInputPixels: 40_000_000 }).rotate();
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height || metadata.width > 10_000 || metadata.height > 10_000) {
      throw new TeamLogoImageError("INVALID_TEAM_LOGO_DIMENSIONS");
    }
    const original = await source
      .clone()
      .resize({ width: TEAM_LOGO_MAX_EDGE, height: TEAM_LOGO_MAX_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 88, alphaQuality: 100, effort: 5 })
      .toBuffer();
    const thumbnail = await source
      .clone()
      .resize({ width: TEAM_LOGO_THUMB_EDGE, height: TEAM_LOGO_THUMB_EDGE, fit: "inside", withoutEnlargement: true })
      .webp({ quality: 84, alphaQuality: 100, effort: 5 })
      .toBuffer();
    return { original, thumbnail };
  } catch (error: unknown) {
    if (error instanceof TeamLogoImageError) throw error;
    throw new TeamLogoImageError("TEAM_LOGO_PROCESSING_FAILED");
  }
}

export async function uploadTeamLogo(file: File, organizationId: number) {
  const { original, thumbnail } = await processLogo(file);
  const storage = config();
  const uuid = crypto.randomUUID();
  const storagePath = `${organizationId}/${uuid}.webp`;
  const thumbnailPath = `${organizationId}/${uuid}-thumb.webp`;
  const bucket = client().storage.from(storage.bucket);

  const originalUpload = await bucket.upload(storagePath, original, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });
  if (originalUpload.error) throw new TeamLogoStorageError("TEAM_LOGO_UPLOAD_FAILED", { cause: originalUpload.error });

  const thumbnailUpload = await bucket.upload(thumbnailPath, thumbnail, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });
  if (thumbnailUpload.error) {
    await bucket.remove([storagePath]);
    throw new TeamLogoStorageError("TEAM_LOGO_UPLOAD_FAILED", { cause: thumbnailUpload.error });
  }

  return {
    logoUrl: bucket.getPublicUrl(storagePath).data.publicUrl,
    storagePath,
    thumbnailPath,
  };
}

export function ownedTeamLogoPaths(logoUrl: string | null, organizationId: number): string[] {
  if (!logoUrl) return [];
  const storage = config();
  try {
    const parsed = new URL(logoUrl);
    const expectedOrigin = new URL(storage.url).origin;
    const prefix = `/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/${organizationId}/`;
    if (parsed.origin !== expectedOrigin || !parsed.pathname.startsWith(prefix)) return [];
    const path = decodeURIComponent(parsed.pathname.slice(`/storage/v1/object/public/${encodeURIComponent(storage.bucket)}/`.length));
    if (!path.startsWith(`${organizationId}/`) || !path.endsWith(".webp") || path.includes("..")) return [];
    return [path, path.replace(/\.webp$/, "-thumb.webp")];
  } catch {
    return [];
  }
}

export async function removeTeamLogoFiles(paths: readonly string[]): Promise<void> {
  const unique = [...new Set(paths)];
  if (unique.length === 0) return;
  const { error } = await client().storage.from(config().bucket).remove(unique);
  if (error) throw new TeamLogoStorageError("TEAM_LOGO_REMOVE_FAILED", { cause: error });
}
