import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateSvgAsset } from "@/lib/design/theme";

const MAX_BRANDING_ASSET_BYTES = 4 * 1024 * 1024;
const ALLOWED_MIME_TYPES = [
  "image/svg+xml",
  "image/png",
  "image/webp",
] as const;

type BrandingMimeType = (typeof ALLOWED_MIME_TYPES)[number];

export class BrandingStorageError extends Error {
  constructor(public readonly code: string, options?: ErrorOptions) {
    super(code, options);
    this.name = "BrandingStorageError";
  }
}

let cachedClient: SupabaseClient | undefined;
let cachedClientKey = "";

function storageConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_BRANDING_BUCKET?.trim();

  if (!supabaseUrl || !serviceRoleKey || !bucket) {
    throw new BrandingStorageError("BRANDING_STORAGE_NOT_CONFIGURED");
  }

  return { supabaseUrl, serviceRoleKey, bucket };
}

function storageClient(): SupabaseClient {
  const config = storageConfig();
  const key = `${config.supabaseUrl}:${config.serviceRoleKey}`;

  if (!cachedClient || cachedClientKey !== key) {
    cachedClient = createClient(config.supabaseUrl, config.serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        detectSessionInUrl: false,
        persistSession: false,
      },
    });
    cachedClientKey = key;
  }

  return cachedClient;
}

function isBrandingMimeType(value: string): value is BrandingMimeType {
  return ALLOWED_MIME_TYPES.includes(value as BrandingMimeType);
}

function hasPngSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  );
}

function hasWebpSignature(bytes: Uint8Array): boolean {
  return (
    bytes.length >= 12 &&
    new TextDecoder("ascii").decode(bytes.slice(0, 4)) === "RIFF" &&
    new TextDecoder("ascii").decode(bytes.slice(8, 12)) === "WEBP"
  );
}

export function validateBrandingAsset(
  mimeType: string,
  size: number,
  bytes: Uint8Array,
): BrandingMimeType {
  if (!isBrandingMimeType(mimeType)) {
    throw new BrandingStorageError("UNSUPPORTED_ASSET_TYPE");
  }
  if (size <= 0 || size > MAX_BRANDING_ASSET_BYTES) {
    throw new BrandingStorageError("INVALID_ASSET_SIZE");
  }

  if (mimeType === "image/svg+xml") {
    try {
      validateSvgAsset(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    } catch (error: unknown) {
      throw new BrandingStorageError("UNSAFE_SVG", { cause: error });
    }
  } else if (mimeType === "image/png" && !hasPngSignature(bytes)) {
    throw new BrandingStorageError("INVALID_PNG_SIGNATURE");
  } else if (mimeType === "image/webp" && !hasWebpSignature(bytes)) {
    throw new BrandingStorageError("INVALID_WEBP_SIGNATURE");
  }

  return mimeType;
}

export async function uploadBrandingAsset(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const mimeType = validateBrandingAsset(file.type.toLowerCase(), file.size, bytes);
  const config = storageConfig();
  const extension =
    mimeType === "image/svg+xml" ? "svg" : mimeType === "image/png" ? "png" : "webp";
  const storagePath = `tracks/${crypto.randomUUID()}.${extension}`;
  const { error } = await storageClient().storage.from(config.bucket).upload(storagePath, bytes, {
    cacheControl: "31536000",
    contentType: mimeType,
    upsert: false,
  });

  if (error) {
    throw new BrandingStorageError("BRANDING_ASSET_UPLOAD_FAILED", { cause: error });
  }

  return storageClient().storage.from(config.bucket).getPublicUrl(storagePath).data.publicUrl;
}
