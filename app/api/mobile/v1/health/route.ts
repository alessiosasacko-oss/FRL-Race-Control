import type { NextRequest } from "next/server";
import { createHealthPayload } from "@/lib/mobile-api/serialization";
import { mobileEmptyQuerySchema, searchParamsObject } from "@/lib/mobile-api/schemas";
import { handleMobileRequest, mobileOptions } from "@/lib/mobile-api/response";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
  return handleMobileRequest(request, "health", () => {
    mobileEmptyQuerySchema.parse(searchParamsObject(request.nextUrl.searchParams));
    return {
      body: createHealthPayload(),
      cache: { mode: "no-store" },
    };
  });
}

export const OPTIONS = mobileOptions;
