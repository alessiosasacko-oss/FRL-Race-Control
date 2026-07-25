import type { NextRequest } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { globalSearch } from "@/lib/search/queries";

export async function GET(request: NextRequest): Promise<Response> {
  const user = await getCurrentUser();
  if (!user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await globalSearch(
    request.nextUrl.searchParams.get("q") ?? "",
  );
  return Response.json({ results });
}
