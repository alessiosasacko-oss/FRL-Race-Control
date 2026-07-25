import "server-only";
import { timingSafeEqual } from "node:crypto";
import { consumeRateLimit } from "@/lib/security/rate-limit";

function secureEqual(provided: string, expected: string): boolean {
  const providedBuffer = Buffer.from(provided);
  const expectedBuffer = Buffer.from(expected);
  return (
    providedBuffer.length === expectedBuffer.length &&
    timingSafeEqual(providedBuffer, expectedBuffer)
  );
}

export function authorizeInternalRequest(request: Request): boolean {
  const secret = process.env.INTERNAL_API_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;
  return secureEqual(authorization.slice(7), secret);
}

export function unauthorizedResponse(): Response {
  return Response.json({ error: "Unauthorized" }, { status: 401 });
}

export function internalRateLimitResponse(
  request: Request,
  scope: string,
  limit = 30,
): Response | null {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const clientKey = forwardedFor?.split(",")[0]?.trim() || "direct";
  const result = consumeRateLimit(`internal:${scope}:${clientKey}`, {
    limit,
    windowMs: 60_000,
  });
  if (result.allowed) return null;

  return Response.json(
    { error: "Too many requests." },
    {
      status: 429,
      headers: { "Retry-After": String(result.retryAfterSeconds) },
    },
  );
}
