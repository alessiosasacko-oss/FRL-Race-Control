import type { NextRequest } from "next/server";
import { AttendanceStatus } from "@/domain";
import {
  changeMobileAttendance,
  getMobileAttendanceDetail,
  requireMobileAttendanceUser,
} from "@/lib/mobile-api/attendance";
import { MOBILE_ATTENDANCE_RATE_LIMITS } from "@/lib/mobile-api/constants";
import { badRequest } from "@/lib/mobile-api/errors";
import {
  handleMobileRequest,
  mobileItem,
  mobileOptionsFor,
} from "@/lib/mobile-api/response";
import {
  mobileAttendanceUpdateSchema,
  mobileRaceIdSchema,
} from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AttendanceRouteContext = {
  params: Promise<{ raceId: string }>;
};

export async function GET(
  request: NextRequest,
  { params }: AttendanceRouteContext,
): Promise<Response> {
  return handleMobileRequest(
    request,
    "attendance-detail",
    async () => {
      const identity = await requireMobileAttendanceUser(request);
      const raceId = mobileRaceIdSchema.parse((await params).raceId);
      const data = await getMobileAttendanceDetail(identity, raceId);
      return {
        body: mobileItem(data, {
          league: data.league.code,
          seasonId: data.season.id,
        }),
        cache: { mode: "no-store" as const },
      };
    },
    { rateLimit: MOBILE_ATTENDANCE_RATE_LIMITS.read },
  );
}

export async function PUT(
  request: NextRequest,
  { params }: AttendanceRouteContext,
): Promise<Response> {
  return handleMobileRequest(
    request,
    "attendance-update",
    async () => {
      const identity = await requireMobileAttendanceUser(request);
      const raceId = mobileRaceIdSchema.parse((await params).raceId);
      let input: unknown;
      try {
        input = await request.json();
      } catch {
        throw badRequest(
          "INVALID_ATTENDANCE_STATUS",
          "Nur REGISTERED oder DECLINED sind als Fahrerantwort erlaubt.",
        );
      }
      const parsed = mobileAttendanceUpdateSchema.safeParse(input);
      if (!parsed.success) {
        throw badRequest(
          "INVALID_ATTENDANCE_STATUS",
          "Nur REGISTERED oder DECLINED sind als Fahrerantwort erlaubt.",
        );
      }
      const data = await changeMobileAttendance(
        identity,
        raceId,
        parsed.data.status as
          | AttendanceStatus.Registered
          | AttendanceStatus.Declined,
      );
      return {
        body: mobileItem(data, {
          league: data.league.code,
          seasonId: data.season.id,
        }),
        cache: { mode: "no-store" as const },
      };
    },
    {
      rateLimit: MOBILE_ATTENDANCE_RATE_LIMITS.write,
      rateLimitMessage:
        "Zu viele Änderungen. Bitte versuche es später erneut.",
    },
  );
}

export function OPTIONS(request: Request): Response {
  return mobileOptionsFor(request, ["GET", "PUT"]);
}
