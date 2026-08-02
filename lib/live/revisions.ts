import "server-only";
import { Prisma } from "@/generated/prisma/client";
import type { PrismaClient } from "@/generated/prisma/client";
import type { AppDataScope } from "@/lib/live/data-events";

type RevisionDatabase = PrismaClient | Prisma.TransactionClient;

export async function touchAppDataRevision(
  database: RevisionDatabase,
  scopes: readonly AppDataScope[],
): Promise<void> {
  const uniqueScopes = [...new Set(scopes)];
  if (uniqueScopes.length === 0) return;

  const values = Prisma.join(
    uniqueScopes.map((scope) => Prisma.sql`(${scope}, 1, NOW())`),
  );
  await database.$executeRaw(Prisma.sql`
    INSERT INTO "AppDataRevision" ("scope", "revision", "updatedAt")
    VALUES ${values}
    ON CONFLICT ("scope") DO UPDATE
    SET "revision" = "AppDataRevision"."revision" + 1,
        "updatedAt" = NOW()
  `);
}

export async function touchAppDataRevisionSafely(
  database: RevisionDatabase,
  scopes: readonly AppDataScope[],
): Promise<void> {
  try {
    await touchAppDataRevision(database, scopes);
  } catch (error) {
    console.error("[live-revisions] revision update failed", {
      name: error instanceof Error ? error.name : "UnknownError",
      code: typeof error === "object" && error !== null && "code" in error
        ? String(error.code)
        : undefined,
      scopes,
    });
  }
}
