import type { NextRequest } from "next/server";
import { MOBILE_API_CACHE_SECONDS } from "@/lib/mobile-api/constants";
import { getMobileBootstrap } from "@/lib/mobile-api/queries";
import { handleMobileRequest, mobileOptions } from "@/lib/mobile-api/response";
import { mobileEmptyQuerySchema, searchParamsObject } from "@/lib/mobile-api/schemas";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handleMobileRequest(request, "bootstrap", async () => {
    mobileEmptyQuerySchema.parse(searchParamsObject(request.nextUrl.searchParams));
    return {
      body: await getMobileBootstrap(),
      cache: { mode: "public", seconds: MOBILE_API_CACHE_SECONDS.bootstrap },
    };
  });
}

export const OPTIONS = mobileOptions;
