import type { NextRequest } from "next/server";
import { MOBILE_API_CACHE_SECONDS } from "@/lib/mobile-api/constants";
import {
  getMobileChampionship,
  resolvePublicSelection,
} from "@/lib/mobile-api/queries";
import {
  handleMobileRequest,
  mobileList,
  mobileOptions,
} from "@/lib/mobile-api/response";
import {
  mobileChampionshipQuerySchema,
  searchParamsObject,
} from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handleMobileRequest(request, "championship", async () => {
    const query = mobileChampionshipQuerySchema.parse(
      searchParamsObject(request.nextUrl.searchParams),
    );
    const selection = await resolvePublicSelection({
      leagueCode: query.league,
      seasonId: query.seasonId,
    });
    const data = await getMobileChampionship(selection, query.type);
    return {
      body: mobileList(data, {
        league: selection.league.code,
        seasonId: selection.season?.id ?? null,
      }),
      cache: {
        mode: "public",
        seconds: MOBILE_API_CACHE_SECONDS.championship,
      },
    };
  });
}

export const OPTIONS = mobileOptions;
