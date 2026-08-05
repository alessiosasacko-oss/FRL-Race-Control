import { MOBILE_AUTH_RATE_LIMITS } from "@/lib/mobile-api/auth/constants";
import { rotateMobileRefreshToken } from "@/lib/mobile-api/auth/mobile-session";
import {
  handleMobileAuthRequest,
  mobileAuthOptions,
} from "@/lib/mobile-api/auth/response";
import { mobileAuthRefreshSchema } from "@/lib/mobile-api/auth/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request): Promise<Response> {
  return handleMobileAuthRequest(
    request,
    "refresh",
    MOBILE_AUTH_RATE_LIMITS.refresh,
    async () => {
      const input = mobileAuthRefreshSchema.parse(await request.json());
      return rotateMobileRefreshToken(input);
    },
  );
}

export function OPTIONS(request: Request): Response {
  return mobileAuthOptions(request, ["POST"]);
}
