import "server-only";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "@/generated/prisma/client";
import { createPoolConfig } from "@/lib/db/pool-config";

const globalForPrisma = globalThis as unknown as {
  frlDatabaseRuntime: DatabaseRuntime | undefined;
};

type DatabaseRuntime = {
  pool: Pool;
  adapter: PrismaPg;
  prisma: PrismaClient;
};

function createDatabaseRuntime(): DatabaseRuntime {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required before the Prisma client can connect.");
  }

  const config = createPoolConfig(connectionString);
  const pool = new Pool(config);
  pool.on("error", (error) => {
    console.error("[database-pool] idle client error", {
      name: error.name,
      code: "code" in error ? String(error.code) : undefined,
    });
  });
  const adapter = new PrismaPg(pool);
  const prisma = new PrismaClient({ adapter });

  console.info("[database-pool] initialized", {
    environment: process.env.NODE_ENV ?? "development",
    max: config.max,
    connectionTimeoutMillis: config.connectionTimeoutMillis,
    idleTimeoutMillis: config.idleTimeoutMillis,
    maxLifetimeSeconds: config.maxLifetimeSeconds,
  });

  return { pool, adapter, prisma };
}

export function getPrismaClient(): PrismaClient {
  globalForPrisma.frlDatabaseRuntime ??= createDatabaseRuntime();
  return globalForPrisma.frlDatabaseRuntime.prisma;
}
