import "server-only";

import { createHash } from "node:crypto";
import { ZodError } from "zod";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import {
  MOBILE_API_RATE_LIMIT,
  MOBILE_API_VERSION,
} from "./constants";
import { MobileApiError } from "./errors";
import { toJsonSafe } from "./serialization";
import type {
  MobileApiErrorResponse,
  MobileApiItemResponse,
  MobileApiListResponse,
  MobileApiMeta,
} from "./types";

type CacheOptions =
  | { mode: "no-store" }
  | {
      mode: "public";
      seconds: number;
      hiddenMysteryRevealTimes?: readonly string[];
    };

type MobileHandlerResult = {
  body: unknown;
  status?: number;
  cache?: CacheOptions;
};

type MobileHandlerOptions = {
  rateLimit?: { limit: number; windowMs: number };
};

const DEFAULT_DEVELOPMENT_ORIGINS = new Set([
  "http://localhost:3000",
  "http://localhost:8081",
  "http://127.0.0.1:3000",
  "http://127.0.0.1:8081",
]);

function configuredOrigins(): Set<string> {
  const origins = new Set(DEFAULT_DEVELOPMENT_ORIGINS);
  for (const candidate of (
    process.env.MOBILE_API_ALLOWED_ORIGINS ?? ""
  ).split(",")) {
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    try {
      const url = new URL(trimmed);
      if (
        (url.protocol === "https:" || url.protocol === "http:") &&
        url.origin === trimmed
      ) {
        origins.add(url.origin);
      }
    } catch {
      // Invalid configuration is ignored instead of being reflected to clients.
    }
  }
  return origins;
}

function corsHeaders(request: Request): Headers {
  const headers = new Headers({ Vary: "Origin" });
  const origin = request.headers.get("origin");
  if (origin && configuredOrigins().has(origin)) {
    headers.set("Access-Control-Allow-Origin", origin);
    headers.set("Access-Control-Allow-Methods", "GET, POST, DELETE, OPTIONS");
    headers.set(
      "Access-Control-Allow-Headers",
      "Accept, Authorization, Content-Type",
    );
    headers.set("Access-Control-Max-Age", "600");
  }
  return headers;
}

export function mobileRequestFingerprint(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const value =
    forwarded ||
    request.headers.get("x-real-ip") ||
    request.headers.get("user-agent") ||
    "anonymous";
  return createHash("sha256").update(value).digest("hex").slice(0, 32);
}

export function buildCacheControl(
  cache: CacheOptions | undefined,
  now = new Date(),
): string {
  if (!cache || cache.mode === "no-store") {
    return "private, no-store, max-age=0";
  }

  const futureRevealTimes = (cache.hiddenMysteryRevealTimes ?? [])
    .map((value) => new Date(value).getTime())
    .filter((value) => Number.isFinite(value) && value > now.getTime());
  if (futureRevealTimes.length > 0) {
    const nearestReveal = Math.min(...futureRevealTimes);
    const secondsUntilReveal = Math.max(
      0,
      Math.floor((nearestReveal - now.getTime()) / 1000) - 1,
    );
    const seconds = Math.min(cache.seconds, secondsUntilReveal);
    if (seconds <= 0) return "private, no-store, max-age=0";
    return `public, max-age=0, s-maxage=${seconds}, must-revalidate`;
  }

  return `public, max-age=${Math.min(cache.seconds, 30)}, s-maxage=${cache.seconds}, stale-while-revalidate=${cache.seconds}`;
}

export function mobileJsonResponse(
  request: Request,
  body: unknown,
  options: { status?: number; cache?: CacheOptions; headers?: HeadersInit } = {},
): Response {
  const headers = corsHeaders(request);
  headers.set("Cache-Control", buildCacheControl(options.cache));
  headers.set("Content-Type", "application/json; charset=utf-8");
  headers.set("X-Content-Type-Options", "nosniff");
  for (const [key, value] of new Headers(options.headers)) {
    headers.set(key, value);
  }
  return Response.json(toJsonSafe(body), {
    status: options.status ?? 200,
    headers,
  });
}

function errorResponse(
  request: Request,
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
): Response {
  const body: MobileApiErrorResponse = { error: { code, message } };
  return mobileJsonResponse(request, body, {
    status,
    cache: { mode: "no-store" },
    headers,
  });
}

export async function handleMobileRequest(
  request: Request,
  endpoint: string,
  operation: () => Promise<MobileHandlerResult> | MobileHandlerResult,
  options: MobileHandlerOptions = {},
): Promise<Response> {
  const startedAt = performance.now();
  const rateLimit = options.rateLimit ?? MOBILE_API_RATE_LIMIT;
  const limitResult = consumeRateLimit(
    `mobile:${endpoint}:${mobileRequestFingerprint(request)}`,
    rateLimit,
  );
  if (!limitResult.allowed) {
    return errorResponse(
      request,
      429,
      "RATE_LIMITED",
      "Zu viele Anfragen. Bitte später erneut versuchen.",
      { "Retry-After": String(limitResult.retryAfterSeconds) },
    );
  }

  try {
    const result = await operation();
    logger.info("Public mobile API request completed", {
      endpoint,
      status: result.status ?? 200,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return mobileJsonResponse(request, result.body, {
      status: result.status,
      cache: result.cache,
    });
  } catch (error) {
    if (error instanceof MobileApiError) {
      return errorResponse(request, error.status, error.code, error.message);
    }
    if (error instanceof ZodError) {
      return errorResponse(
        request,
        400,
        "INVALID_QUERY",
        "Die Anfrageparameter sind ungültig.",
      );
    }

    const reference = crypto.randomUUID();
    logger.error("Public mobile API request failed", error, {
      endpoint,
      reference,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return errorResponse(
      request,
      500,
      "INTERNAL_ERROR",
      "Die Anfrage konnte nicht verarbeitet werden.",
    );
  }
}

export function mobileOptions(request: Request): Response {
  const headers = corsHeaders(request);
  headers.set("Allow", "GET, OPTIONS");
  headers.set("Cache-Control", "public, max-age=600");
  return new Response(null, { status: 204, headers });
}

export function mobileMeta(
  values: Omit<MobileApiMeta, "apiVersion" | "generatedAt"> = {},
  now = new Date(),
): MobileApiMeta {
  return {
    apiVersion: MOBILE_API_VERSION,
    generatedAt: now.toISOString(),
    ...values,
  };
}

export function mobileList<T>(
  data: T[],
  meta: Omit<MobileApiMeta, "apiVersion" | "generatedAt"> = {},
  now = new Date(),
): MobileApiListResponse<T> {
  return { data, meta: mobileMeta(meta, now) };
}

export function mobileItem<T>(
  data: T,
  meta: Omit<MobileApiMeta, "apiVersion" | "generatedAt"> = {},
  now = new Date(),
): MobileApiItemResponse<T> {
  return { data, meta: mobileMeta(meta, now) };
}
