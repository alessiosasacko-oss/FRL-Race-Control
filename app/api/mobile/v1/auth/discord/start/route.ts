import { MOBILE_AUTH_RATE_LIMITS } from "@/lib/mobile-api/auth/constants";
import { createMobileOAuthAttempt } from "@/lib/mobile-api/auth/oauth-attempt";
import {
  mobileAuthErrorResponse,
  enforceMobileAuthRateLimit,
  mobileAuthOptions,
} from "@/lib/mobile-api/auth/response";
import {
  mobileAuthStartSchema,
  searchParamsObject,
} from "@/lib/mobile-api/auth/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const limited = enforceMobileAuthRateLimit(
    request,
    "discord_start",
    MOBILE_AUTH_RATE_LIMITS.start,
  );
  if (limited) return limited;
  const parsed = mobileAuthStartSchema.safeParse(
    searchParamsObject(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return mobileAuthErrorResponse(
      request,
      400,
      "INVALID_AUTH_REQUEST",
      "Redirect-URI, PKCE oder State sind ungültig.",
    );
  }
  try {
    const result = await createMobileOAuthAttempt(parsed.data);
    return new Response(null, {
      status: 302,
      headers: {
        Location: result.authorizationUrl.href,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
    });
  } catch {
    return mobileAuthErrorResponse(
      request,
      500,
      "AUTH_CONFIGURATION_ERROR",
      "Die Anmeldung ist vorübergehend nicht verfügbar.",
    );
  }
}

export function OPTIONS(request: Request): Response {
  return mobileAuthOptions(request, ["GET"]);
}
