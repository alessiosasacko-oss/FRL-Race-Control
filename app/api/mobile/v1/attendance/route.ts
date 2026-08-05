import type { NextRequest } from "next/server";
import { getMobileAttendanceOverview, requireMobileAttendanceUser } from "@/lib/mobile-api/attendance";
import { MOBILE_ATTENDANCE_RATE_LIMITS } from "@/lib/mobile-api/constants";
import {
  handleMobileRequest,
  mobileList,
  mobileOptionsFor,
} from "@/lib/mobile-api/response";
import {
  mobileAttendanceQuerySchema,
  searchParamsObject,
} from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handleMobileRequest(
    request,
    "attendance",
    async () => {
      const identity = await requireMobileAttendanceUser(request);
      const query = mobileAttendanceQuerySchema.parse(
        searchParamsObject(request.nextUrl.searchParams),
      );
      const data = await getMobileAttendanceOverview(identity, query);
      return {
        body: mobileList(data, {
          league: data[0]?.league.code,
          seasonId: query.seasonId ?? data[0]?.season.id ?? null,
        }),
        cache: { mode: "no-store" as const },
      };
    },
    { rateLimit: MOBILE_ATTENDANCE_RATE_LIMITS.read },
  );
}

export function OPTIONS(request: Request): Response {
  return mobileOptionsFor(request, ["GET"]);
}
