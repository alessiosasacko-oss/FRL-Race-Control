import { MOBILE_AUTH_RATE_LIMITS } from "@/lib/mobile-api/auth/constants";
import { exchangeMobileAuthorizationCode } from "@/lib/mobile-api/auth/mobile-session";
import {
  handleMobileAuthRequest,
  mobileAuthOptions,
} from "@/lib/mobile-api/auth/response";
import { mobileAuthExchangeSchema } from "@/lib/mobile-api/auth/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleMobileAuthRequest(
    request,
    "exchange",
    MOBILE_AUTH_RATE_LIMITS.exchange,
    async () =>
      exchangeMobileAuthorizationCode(
        mobileAuthExchangeSchema.parse(await request.json()),
      ),
  );
}

export function OPTIONS(request: Request): Response {
  return mobileAuthOptions(request, ["POST"]);
}
