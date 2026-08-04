import type { NextRequest } from "next/server";
import { MOBILE_API_CACHE_SECONDS } from "@/lib/mobile-api/constants";
import {
  getMobileResults,
  resolvePublicSelection,
} from "@/lib/mobile-api/queries";
import {
  handleMobileRequest,
  mobileList,
  mobileOptions,
} from "@/lib/mobile-api/response";
import {
  mobileResultsQuerySchema,
  searchParamsObject,
} from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handleMobileRequest(request, "results", async () => {
    const query = mobileResultsQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const selection = await resolvePublicSelection({
      leagueCode: query.league,
      seasonId: query.seasonId,
    });
    const result = await getMobileResults({
      selection,
      limit: query.limit,
      cursor: query.cursor,
    });
    return {
      body: mobileList(result.data, {
        league: selection.league.code,
        seasonId: selection.season?.id ?? null,
        nextCursor: result.nextCursor,
      }),
      cache: {
        mode: "public",
        seconds: MOBILE_API_CACHE_SECONDS.results,
        hiddenMysteryRevealTimes: result.data.flatMap((race) =>
          race.isMysteryRace && !race.mysteryRevealed && race.revealAt
            ? [race.revealAt]
            : [],
        ),
      },
    };
  });
}

export const OPTIONS = mobileOptions;
