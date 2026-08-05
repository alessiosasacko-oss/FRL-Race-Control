import { MOBILE_AUTH_RATE_LIMITS } from "@/lib/mobile-api/auth/constants";
import {
  requireMobileUser,
  serializeMobileUser,
} from "@/lib/mobile-api/auth/mobile-user";
import {
  handleMobileAuthRequest,
  mobileAuthMeta,
  mobileAuthOptions,
} from "@/lib/mobile-api/auth/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
  return handleMobileAuthRequest(
    request,
    "me",
    MOBILE_AUTH_RATE_LIMITS.me,
    async () => ({
      data: serializeMobileUser(await requireMobileUser(request)),
      meta: mobileAuthMeta(),
    }),
  );
}

export function OPTIONS(request: Request): Response {
  return mobileAuthOptions(request, ["GET"]);
}
