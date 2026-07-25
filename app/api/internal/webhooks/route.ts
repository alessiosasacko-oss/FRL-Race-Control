import { z } from "zod";
import { webhookEventTypeSchema } from "@/domain";
import {
  authorizeInternalRequest,
  internalRateLimitResponse,
  unauthorizedResponse,
} from "@/lib/api/internal-auth";
import { getPrismaClient } from "@/lib/db/prisma";
import { recordWebhookEvent } from "@/lib/integrations/events";

export const runtime = "nodejs";

const webhookInputSchema = z.object({
  type: webhookEventTypeSchema,
  source: z.string().trim().min(1).max(80),
  dedupeKey: z.string().trim().min(1).max(190),
  payload: z.record(z.string(), z.json()),
});

export async function POST(request: Request): Promise<Response> {
  if (!authorizeInternalRequest(request)) return unauthorizedResponse();
  const rateLimited = internalRateLimitResponse(request, "webhooks", 120);
  if (rateLimited) return rateLimited;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON." }, { status: 400 });
  }
  const parsed = webhookInputSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: "Invalid webhook event.", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  await recordWebhookEvent(getPrismaClient(), parsed.data);
  return Response.json({ accepted: true }, { status: 202 });
}
