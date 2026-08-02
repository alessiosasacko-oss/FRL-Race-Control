import type { PoolConfig } from "pg";

export const PRODUCTION_POOL_MAX = 1;
export const DEVELOPMENT_POOL_MAX = 4;
export const CONNECTION_TIMEOUT_MS = 8_000;
export const IDLE_TIMEOUT_MS = 10_000;
export const MAX_LIFETIME_SECONDS = 300;

export function assertRuntimeDatabaseUrl(
  connectionString: string,
  nodeEnv = process.env.NODE_ENV,
): void {
  if (nodeEnv !== "production") return;

  let url: URL;
  try {
    url = new URL(connectionString);
  } catch {
    throw new Error(
      "DATABASE_URL muss in Production den Supabase Transaction Pooler auf Port 6543 verwenden.",
    );
  }

  const isPostgres = url.protocol === "postgres:" || url.protocol === "postgresql:";
  const isSupabasePooler = url.hostname.endsWith(".pooler.supabase.com");
  const usesTransactionPort = url.port === "6543";
  const sslMode = url.searchParams.get("sslmode")?.toLowerCase();
  const usesSsl = sslMode === "require" || sslMode === "verify-ca" || sslMode === "verify-full";

  if (!isPostgres || !isSupabasePooler || !usesTransactionPort || !usesSsl) {
    throw new Error(
      "DATABASE_URL muss in Production den Supabase Transaction Pooler auf Port 6543 verwenden.",
    );
  }
}

export function createPoolConfig(
  connectionString: string,
  nodeEnv = process.env.NODE_ENV,
): PoolConfig {
  assertRuntimeDatabaseUrl(connectionString, nodeEnv);

  return {
    connectionString,
    max: nodeEnv === "production" ? PRODUCTION_POOL_MAX : DEVELOPMENT_POOL_MAX,
    connectionTimeoutMillis: CONNECTION_TIMEOUT_MS,
    idleTimeoutMillis: IDLE_TIMEOUT_MS,
    maxLifetimeSeconds: MAX_LIFETIME_SECONDS,
    allowExitOnIdle: true,
    application_name: "frl-race-control",
  };
}
