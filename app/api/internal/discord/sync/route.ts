import {
  authorizeInternalRequest,
  internalRateLimitResponse,
  unauthorizedResponse,
} from "@/lib/api/internal-auth";
import { synchronizeDiscordRoles } from "@/lib/discord/roles";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!authorizeInternalRequest(request)) return unauthorizedResponse();
  const rateLimited = internalRateLimitResponse(request, "discord-sync", 5);
  if (rateLimited) return rateLimited;

  try {
    return Response.json(await synchronizeDiscordRoles());
  } catch (error: unknown) {
    logger.error("Discord synchronization endpoint failed", error);
    return Response.json(
      { error: "Discord synchronization failed." },
      { status: 500 },
    );
  }
}
