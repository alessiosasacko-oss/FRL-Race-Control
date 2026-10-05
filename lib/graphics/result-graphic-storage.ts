import "server-only";

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

let cached: SupabaseClient | null = null;
let cacheKey = "";

export async function hydrateGraphicAssets<T extends { teamLogoUrl: string | null; imageUrl: string | null; renderImageUrl?: string | null; teamRenderImageUrl?: string | null }>(rows: readonly T[], load: (url: string) => Promise<string | null> = safeGraphicAssetDataUrl) {
  const unique = [...new Set(rows.flatMap((row) => [row.teamRenderImageUrl, row.renderImageUrl, row.imageUrl, row.teamLogoUrl].filter((url): url is string => Boolean(url))))];
  const byUrl = new Map<string, string | null>();
  const deadline = Date.now() + 12_000;
  // Bound concurrent downloads and decoding; a missing asset must not fail a result.
  for (let offset = 0; offset < unique.length; offset += 4) {
    if (Date.now() >= deadline) break;
    await Promise.all(unique.slice(offset, offset + 4).map(async (url) => {
      byUrl.set(url, await load(url).catch(() => null));
    }));
  }
  return rows.map((row) => {
    const render = (row.teamRenderImageUrl ? byUrl.get(row.teamRenderImageUrl) : null) || (row.renderImageUrl ? byUrl.get(row.renderImageUrl) : null);
    return { ...row, teamLogoDataUrl: row.teamLogoUrl ? byUrl.get(row.teamLogoUrl) ?? null : null,
      imageDataUrl: render || (row.imageUrl ? byUrl.get(row.imageUrl) ?? null : null),
      imageKind: render ? "render" as const : "profile" as const };
  });
}

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

export function isControlledResultGraphicUrl(url: string): boolean {
  const storageUrl = process.env.SUPABASE_URL?.trim();
  const bucket = process.env.SUPABASE_RESULT_GRAPHICS_BUCKET?.trim() || "result-graphics";
  if (!storageUrl) return false;
  try {
    const candidate = new URL(url);
    return candidate.origin === new URL(storageUrl).origin && candidate.pathname.startsWith(`/storage/v1/object/public/${encodeURIComponent(bucket)}/`);
  } catch {
    return false;
  }
}

export async function safeGraphicAssetDataUrl(url: string | null): Promise<string | null> {
  if (!url) return null;
  const storageUrl = process.env.SUPABASE_URL?.trim();
  if (!storageUrl) return null;
  const parsed = new URL(url);
  const buckets = [process.env.SUPABASE_TEAM_LOGO_BUCKET?.trim() || "team-logos", process.env.SUPABASE_DRIVER_IMAGE_BUCKET?.trim() || process.env.SUPABASE_STORAGE_BUCKET?.trim()].filter(Boolean);
  if (parsed.origin !== new URL(storageUrl).origin || parsed.username || parsed.password || !buckets.some((bucket) => parsed.pathname.startsWith(`/storage/v1/object/public/${encodeURIComponent(bucket!)}/`))) return null;
  const response = await fetch(parsed, { cache: "no-store", redirect: "error", signal: AbortSignal.timeout(6000) });
  if (!response.ok || !response.body) return null;
  const contentType = response.headers.get("content-type")?.split(";")[0] ?? "";
  const max = 4 * 1024 * 1024;
  if (!new Set(["image/webp", "image/png", "image/jpeg"]).has(contentType) || Number(response.headers.get("content-length")) > max) { await response.body.cancel(); return null; }
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      length += chunk.value.length;
      if (length > max) { await reader.cancel(); return null; }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = await sharp(Buffer.concat(chunks), { limitInputPixels: 40_000_000, failOn: "error" })
    .rotate().resize({ width: 1200, height: 1400, fit: "inside", withoutEnlargement: true }).png().toBuffer();
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
