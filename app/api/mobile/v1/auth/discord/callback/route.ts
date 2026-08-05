import { logger } from "@/lib/observability/logger";
import { MOBILE_AUTH_RATE_LIMITS } from "@/lib/mobile-api/auth/constants";
import { MobileAuthError } from "@/lib/mobile-api/auth/errors";
import {
  completeMobileDiscordOAuth,
  mobileOAuthCallbackRedirect,
} from "@/lib/mobile-api/auth/oauth-attempt";
import {
  enforceMobileAuthRateLimit,
  mobileAuthErrorResponse,
} from "@/lib/mobile-api/auth/response";
import {
  mobileAuthCallbackSchema,
  searchParamsObject,
} from "@/lib/mobile-api/auth/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  const limited = enforceMobileAuthRateLimit(
    request,
    "discord_callback",
    MOBILE_AUTH_RATE_LIMITS.callback,
  );
  if (limited) return limited;
  const parsed = mobileAuthCallbackSchema.safeParse(
    searchParamsObject(new URL(request.url).searchParams),
  );
  if (!parsed.success) {
    return mobileAuthErrorResponse(
      request,
      400,
      "OAUTH_CALLBACK_INVALID",
      "Der OAuth-Callback ist ungültig.",
    );
  }
  try {
    const result = await completeMobileDiscordOAuth({
      oauthState: parsed.data.state,
      discordCode: parsed.data.code,
      discordError: parsed.data.error,
    });
    const location = mobileOAuthCallbackRedirect(result);
    return new Response(null, {
      status: 302,
      headers: {
        Location: location.href,
        "Cache-Control": "private, no-store, max-age=0",
        Pragma: "no-cache",
        "Referrer-Policy": "no-referrer",
        "X-Content-Type-Options": "nosniff",
      },
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
    logger.error("Mobile OAuth callback failed", undefined, {
      phase: "discord_callback",
      resultStatus: "failure",
      errorClass: error instanceof Error ? error.name : "UnknownError",
    });
    return mobileAuthErrorResponse(
      request,
      500,
      "LOGIN_FAILED",
      "Die Anmeldung konnte nicht verarbeitet werden.",
    );
  }
}
