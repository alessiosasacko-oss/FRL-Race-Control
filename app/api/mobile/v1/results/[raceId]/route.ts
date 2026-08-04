import type { NextRequest } from "next/server";
import { MOBILE_API_CACHE_SECONDS } from "@/lib/mobile-api/constants";
import { getMobileResultDetail } from "@/lib/mobile-api/queries";
import {
  handleMobileRequest,
  mobileItem,
  mobileOptions,
} from "@/lib/mobile-api/response";
import {
  mobileLeagueQuerySchema,
  mobileRaceIdSchema,
  searchParamsObject,
} from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ raceId: string }> },
): Promise<Response> {
  return handleMobileRequest(request, "result-detail", async () => {
    const raceId = mobileRaceIdSchema.parse((await params).raceId);
    const query = mobileLeagueQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const data = await getMobileResultDetail({
      raceId,
      leagueCode: query.league,
    });
    return {
      body: mobileItem(data, { league: data.race.league.code }),
      cache: {
        mode: "public",
        seconds: MOBILE_API_CACHE_SECONDS.results,
        hiddenMysteryRevealTimes:
          data.race.isMysteryRace &&
          !data.race.mysteryRevealed &&
          data.race.revealAt
            ? [data.race.revealAt]
            : [],
      },
    };
  });
}

export const OPTIONS = mobileOptions;
