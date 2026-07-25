import {
  authorizeInternalRequest,
  internalRateLimitResponse,
  unauthorizedResponse,
} from "@/lib/api/internal-auth";
import { runDueAutomationJobs } from "@/lib/automation/runner";
import { logger } from "@/lib/observability/logger";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  if (!authorizeInternalRequest(request)) return unauthorizedResponse();
  const rateLimited = internalRateLimitResponse(request, "automation", 10);
  if (rateLimited) return rateLimited;

  try {
    const result = await runDueAutomationJobs();
    return Response.json(result);
  } catch (error: unknown) {
    logger.error("Automation endpoint failed", error);
    return Response.json(
      { error: "Automation processing failed." },
      { status: 500 },
    );
  }
}
