import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { validateBackgroundImage } from "@/lib/storage/background-image";

let cachedClient: SupabaseClient | undefined;
let cachedKey = "";

function storageConfig() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_BRANDING_BUCKET?.trim() || "frl-branding";
  if (!url || !key) throw new Error("BACKGROUND_STORAGE_NOT_CONFIGURED");
  return { url, key, bucket };
}

function client() {
  const config = storageConfig();
  const identity = `${config.url}:${config.key}`;
  if (!cachedClient || cachedKey !== identity) {
    cachedClient = createClient(config.url, config.key, {
      auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false },
    });
    cachedKey = identity;
  }
  return cachedClient;
}

export async function uploadBackgroundImage(file: File, themeId: number | null) {
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = validateBackgroundImage(file.name, file.type, file.size, bytes);
  const config = storageConfig();
  const namespace = themeId && Number.isInteger(themeId) && themeId > 0 ? String(themeId) : "draft";
  const storagePath = `backgrounds/${namespace}/${crypto.randomUUID()}.${image.extension === "jpeg" ? "jpg" : image.extension}`;
  const { error } = await client().storage.from(config.bucket).upload(storagePath, bytes, {
    cacheControl: "31536000",
    contentType: image.mimeType,
    upsert: false,
  });
  if (error) throw new Error("BACKGROUND_UPLOAD_FAILED", { cause: error });
  const url = client().storage.from(config.bucket).getPublicUrl(storagePath).data.publicUrl;
  return { url, storagePath, width: image.width, height: image.height };
}
