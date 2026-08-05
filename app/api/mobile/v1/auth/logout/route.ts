import { MOBILE_AUTH_RATE_LIMITS } from "@/lib/mobile-api/auth/constants";
import { revokeMobileSession } from "@/lib/mobile-api/auth/mobile-session";
import { requireMobileUser } from "@/lib/mobile-api/auth/mobile-user";
import {
  handleMobileAuthRequest,
  mobileAuthOptions,
} from "@/lib/mobile-api/auth/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleMobileAuthRequest(
    request,
    "logout",
    MOBILE_AUTH_RATE_LIMITS.logout,
    async () =>
      revokeMobileSession(
        await requireMobileUser(request, {
          allowRevoked: true,
          allowIneligible: true,
        }),
      ),
  );
}

export function OPTIONS(request: Request): Response {
  return mobileAuthOptions(request, ["POST"]);
}
