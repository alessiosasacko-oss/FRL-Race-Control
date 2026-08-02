import assert from "node:assert/strict";
import test from "node:test";
import {
  DEVELOPMENT_POOL_MAX,
  PRODUCTION_POOL_MAX,
  assertRuntimeDatabaseUrl,
  createPoolConfig,
} from "./pool-config";

const valid = "postgresql://user:secret@aws-0-eu-west-1.pooler.supabase.com:6543/postgres?sslmode=require";

test("production pool uses one connection", () => {
  assert.equal(createPoolConfig(valid, "production").max, PRODUCTION_POOL_MAX);
});

test("development pool is bounded", () => {
  assert.equal(createPoolConfig("postgresql://localhost/db", "development").max, DEVELOPMENT_POOL_MAX);
});

test("production rejects direct and non-SSL URLs without leaking credentials", () => {
  const secret = "do-not-print";
  assert.throws(
    () => assertRuntimeDatabaseUrl(`postgresql://user:${secret}@db.example.com:5432/db`, "production"),
    (error: unknown) => error instanceof Error && !error.message.includes(secret) && error.message.includes("Port 6543"),
  );
  assert.throws(() => assertRuntimeDatabaseUrl(valid.replace("?sslmode=require", ""), "production"));
});

test("runtime pool configuration does not accept DIRECT_URL", () => {
  assert.equal("connectionString" in createPoolConfig(valid, "production"), true);
  assert.equal(JSON.stringify(createPoolConfig(valid, "production")).includes("DIRECT_URL"), false);
});
