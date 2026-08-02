import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = performance.now();
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: "Nicht angemeldet." }, { status: 401 });
  }

  try {
    const revisions = await getPrismaClient().appDataRevision.findMany({
      select: { scope: true, revision: true, updatedAt: true },
      orderBy: { scope: "asc" },
    });
    console.info("[live-revisions] request completed", {
      durationMs: Math.round(performance.now() - startedAt),
      scopeCount: revisions.length,
    });
    return NextResponse.json(
      {
        revisions: revisions.map((revision) => ({
          scope: revision.scope,
          revision: revision.revision.toString(),
          updatedAt: revision.updatedAt.toISOString(),
        })),
      },
      { headers: { "Cache-Control": "private, no-store, max-age=0" } },
    );
  } catch (error) {
    const reference = crypto.randomUUID();
    console.error("[live-revisions] request failed", {
      reference,
      durationMs: Math.round(performance.now() - startedAt),
      name: error instanceof Error ? error.name : "UnknownError",
      code: typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined,
    });
    return NextResponse.json(
      { error: "Datenstand konnte nicht geprüft werden.", reference },
      { status: 503 },
    );
  }
}
