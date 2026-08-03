import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;
let cacheKey = "";

function config() {
  const url = process.env.SUPABASE_URL?.trim();
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
  const bucket = process.env.SUPABASE_RESULT_GRAPHICS_BUCKET?.trim() || "result-graphics";
  if (!url || !key) throw new Error("RESULT_GRAPHIC_STORAGE_NOT_CONFIGURED");
  return { url, key, bucket };
}

function client() {
  const value = config();
  const nextKey = `${value.url}:${value.key}`;
  if (!cached || cacheKey !== nextKey) {
    cached = createClient(value.url, value.key, { auth: { autoRefreshToken: false, detectSessionInUrl: false, persistSession: false } });
    cacheKey = nextKey;
  }
  return cached;
}

export async function uploadResultGraphic(path: string, png: Buffer) {
  const value = config();
  const bucket = client().storage.from(value.bucket);
  const { error } = await bucket.upload(path, png, { contentType: "image/png", cacheControl: "31536000", upsert: true });
  if (error) throw new Error("RESULT_GRAPHIC_UPLOAD_FAILED", { cause: error });
  return bucket.getPublicUrl(path).data.publicUrl;
}

export async function safeGraphicAssetDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  const value = config();
  const parsed = new URL(url);
  if (parsed.origin !== new URL(value.url).origin || !parsed.pathname.includes("/storage/v1/object/public/team-logos/")) return null;
  const response = await fetch(parsed, { cache: "force-cache" });
  if (!response.ok) return null;
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  if (!new Set(["image/webp", "image/png", "image/jpeg"]).has(contentType)) return null;
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.length > 2 * 1024 * 1024) return null;
  return `data:${contentType};base64,${bytes.toString("base64")}`;
}
