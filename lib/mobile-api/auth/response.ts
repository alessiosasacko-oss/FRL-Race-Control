import "server-only";

import { ZodError } from "zod";
import { mobileJsonResponse, mobileRequestFingerprint } from "@/lib/mobile-api/response";
import { logger } from "@/lib/observability/logger";
import { consumeRateLimit } from "@/lib/security/rate-limit";
import { MobileAuthError } from "./errors";

type RateLimit = { limit: number; windowMs: number };

export function mobileAuthErrorResponse(
  request: Request,
  status: number,
  code: string,
  message: string,
  headers?: HeadersInit,
): Response {
  return mobileJsonResponse(
    request,
    { error: { code, message } },
    { status, cache: { mode: "no-store" }, headers },
  );
}

export function enforceMobileAuthRateLimit(
  request: Request,
  endpoint: string,
  rateLimit: RateLimit,
): Response | null {
  const result = consumeRateLimit(
    `mobile-auth:${endpoint}:${mobileRequestFingerprint(request)}`,
    rateLimit,
  );
  if (result.allowed) return null;
  return mobileAuthErrorResponse(
    request,
    429,
    "RATE_LIMITED",
    "Zu viele Anmeldeversuche. Bitte versuche es später erneut.",
    { "Retry-After": String(result.retryAfterSeconds) },
  );
}

export async function handleMobileAuthRequest(
  request: Request,
  endpoint: string,
  rateLimit: RateLimit,
  operation: () => Promise<unknown>,
): Promise<Response> {
  const limited = enforceMobileAuthRateLimit(request, endpoint, rateLimit);
  if (limited) return limited;
  const startedAt = performance.now();
  try {
    const body = await operation();
    logger.info("Mobile authentication request completed", {
      phase: endpoint,
      resultStatus: "success",
      durationMs: Math.round(performance.now() - startedAt),
    });
    return mobileJsonResponse(request, body, {
      cache: { mode: "no-store" },
    });
  } catch (error: unknown) {
    if (error instanceof MobileAuthError) {
      return mobileAuthErrorResponse(
        request,
        error.status,
        error.code,
        error.message,
      );
    }
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return mobileAuthErrorResponse(
        request,
        400,
        "INVALID_REQUEST",
        "Die Anfrage ist ungültig.",
      );
    }
    const reference = crypto.randomUUID();
    logger.error("Mobile authentication request failed", undefined, {
      phase: endpoint,
      resultStatus: "failure",
      errorClass: error instanceof Error ? error.name : "UnknownError",
      reference,
      durationMs: Math.round(performance.now() - startedAt),
    });
    return mobileAuthErrorResponse(
      request,
      500,
      "INTERNAL_ERROR",
      "Die Anmeldung konnte nicht verarbeitet werden.",
    );
  }
}

export function mobileAuthMeta(now = new Date()) {
  return { apiVersion: "v1" as const, generatedAt: now.toISOString() };
}

export function mobileAuthOptions(
  request: Request,
  methods: readonly string[],
): Response {
  const response = mobileJsonResponse(request, null, {
    status: 204,
    cache: { mode: "no-store" },
  });
  response.headers.set("Allow", [...methods, "OPTIONS"].join(", "));
  return new Response(null, { status: 204, headers: response.headers });
}
