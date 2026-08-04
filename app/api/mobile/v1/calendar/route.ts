import type { NextRequest } from "next/server";
import { MOBILE_API_CACHE_SECONDS } from "@/lib/mobile-api/constants";
import {
  getMobileCalendar,
  resolvePublicSelection,
} from "@/lib/mobile-api/queries";
import {
  handleMobileRequest,
  mobileList,
  mobileOptions,
} from "@/lib/mobile-api/response";
import {
  mobileCalendarQuerySchema,
  searchParamsObject,
} from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handleMobileRequest(request, "calendar", async () => {
    const query = mobileCalendarQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const selection = await resolvePublicSelection({
      leagueCode: query.league,
      seasonId: query.seasonId,
    });
    const data = await getMobileCalendar(selection);
    return {
      body: mobileList(data, {
        league: selection.league.code,
        seasonId: selection.season?.id ?? null,
      }),
      cache: {
        mode: "public",
        seconds: MOBILE_API_CACHE_SECONDS.calendar,
        hiddenMysteryRevealTimes: data.flatMap((race) =>
          race.isMysteryRace && !race.mysteryRevealed && race.revealAt
            ? [race.revealAt]
            : [],
        ),
      },
    };
  });
}

export const OPTIONS = mobileOptions;
