import type { NextRequest } from "next/server";
import { MOBILE_API_CACHE_SECONDS } from "@/lib/mobile-api/constants";
import { getMobileLeagues } from "@/lib/mobile-api/queries";
import {
  handleMobileRequest,
  mobileList,
  mobileOptions,
} from "@/lib/mobile-api/response";
import { mobileEmptyQuerySchema, searchParamsObject } from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handleMobileRequest(request, "leagues", async () => {
    mobileEmptyQuerySchema.parse(searchParamsObject(request.nextUrl.searchParams));
    const data = await getMobileLeagues();
    return {
      body: mobileList(data),
      cache: {
        mode: "public",
        seconds: MOBILE_API_CACHE_SECONDS.leagues,
        hiddenMysteryRevealTimes: data.flatMap((league) =>
          league.nextRace?.isMysteryRace &&
          !league.nextRace.mysteryRevealed &&
          league.nextRace.revealAt
            ? [league.nextRace.revealAt]
            : [],
        ),
      },
    };
  });
}

export const OPTIONS = mobileOptions;
