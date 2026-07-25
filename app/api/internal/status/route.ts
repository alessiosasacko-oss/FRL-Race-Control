import {
  authorizeInternalRequest,
  internalRateLimitResponse,
  unauthorizedResponse,
} from "@/lib/api/internal-auth";
import { getPrismaClient } from "@/lib/db/prisma";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  if (!authorizeInternalRequest(request)) return unauthorizedResponse();
  const rateLimited = internalRateLimitResponse(request, "status", 60);
  if (rateLimited) return rateLimited;
  const prisma = getPrismaClient();
  const [guilds, jobs, discordQueue, emailQueue] =
    await prisma.$transaction([
      prisma.discordGuildSettings.findMany({
        select: {
          guildId: true,
          enabled: true,
          lastHeartbeatAt: true,
          lastError: true,
        },
      }),
      prisma.automationJob.findMany({
        select: {
          type: true,
          status: true,
          nextRunAt: true,
          lastRunAt: true,
          lastError: true,
        },
      }),
      prisma.discordDelivery.groupBy({
        by: ["status"],
        orderBy: { status: "asc" },
        _count: { _all: true },
      }),
      prisma.emailDelivery.groupBy({
        by: ["status"],
        orderBy: { status: "asc" },
        _count: { _all: true },
      }),
    ]);
  return Response.json({
    timestamp: new Date().toISOString(),
    discord: guilds,
    jobs,
    queues: { discord: discordQueue, email: emailQueue },
  });
}
