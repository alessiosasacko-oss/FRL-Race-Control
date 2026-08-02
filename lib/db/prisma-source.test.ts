import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./prisma.ts", import.meta.url), "utf8");

test("Prisma and pg share one global runtime in development and production", () => {
  assert.match(source, /frlDatabaseRuntime/);
  assert.match(source, /\?\?= createDatabaseRuntime\(\)/);
  assert.doesNotMatch(source, /NODE_ENV !== "production"/);
  assert.match(source, /new PrismaPg\(pool\)/);
});

test("runtime never disconnects Prisma per request", () => {
  assert.doesNotMatch(source, /\$disconnect/);
});
