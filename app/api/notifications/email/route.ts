import { timingSafeEqual } from "node:crypto";
import { processEmailOutbox } from "@/lib/email/outbox";
import { generateAttendanceNotifications } from "@/lib/notifications/scheduler";

export const runtime = "nodejs";

function authorized(request: Request): boolean {
  const secret = process.env.EMAIL_CRON_SECRET;
  const authorization = request.headers.get("authorization");
  if (!secret || !authorization?.startsWith("Bearer ")) return false;

  const provided = Buffer.from(authorization.slice(7));
  const expected = Buffer.from(secret);
  return (
    provided.length === expected.length &&
    timingSafeEqual(provided, expected)
  );
}

export async function POST(request: Request): Promise<Response> {
  if (!authorized(request)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  await generateAttendanceNotifications();
  const result = await processEmailOutbox();
  return Response.json(result);
}
