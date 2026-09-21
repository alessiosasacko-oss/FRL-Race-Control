import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
  RaceHeroImageError,
  raceHeroVariants,
  type RaceHeroVariant,
  validateRaceHeroDimensions,
  validateRaceHeroFile,
} from "./race-hero-image";

export class RaceHeroStorageError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "RaceHeroStorageError";
  }
}

let cachedClient: SupabaseClient | undefined;
let cachedKey = "";

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_BRANDING_BUCKET?.trim();
  if (!url || !serviceRoleKey || !bucket) {
    throw new RaceHeroStorageError("RACE_HERO_STORAGE_NOT_CONFIGURED");
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

export async function uploadRaceHero(file: File, variant: RaceHeroVariant) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  validateRaceHeroFile(file.name, file.type.toLowerCase(), file.size, bytes);
  const target = raceHeroVariants[variant];

  let output: Buffer;
  try {
    const source = sharp(bytes, { failOn: "error", limitInputPixels: 80_000_000 }).rotate();
    const metadata = await source.metadata();
    if (!metadata.width || !metadata.height) {
      throw new RaceHeroImageError("INVALID_RACE_HERO_DIMENSIONS");
    }
    validateRaceHeroDimensions(variant, metadata.width, metadata.height);
    output = await source
      .resize({ width: target.width, height: target.height, fit: "cover", position: "attention" })
      .webp({ quality: variant === "desktop" ? 82 : 80, effort: 5 })
      .toBuffer();
  } catch (error: unknown) {
    if (error instanceof RaceHeroImageError) throw error;
    throw new RaceHeroImageError("RACE_HERO_PROCESSING_FAILED", { cause: error });
  }

  const storage = config();
  const path = `race-heroes/${variant}/${crypto.randomUUID()}.webp`;
  const bucket = client().storage.from(storage.bucket);
  const { error } = await bucket.upload(path, output, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false,
  });
  if (error) throw new RaceHeroStorageError("RACE_HERO_UPLOAD_FAILED", { cause: error });

  return {
    url: bucket.getPublicUrl(path).data.publicUrl,
    width: target.width,
    height: target.height,
  };
}
