import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { canonicalAdapterEmail } from "./adapter";

test("keeps existing e-mails and gives legacy adapter users a non-persisted value", () => {
  assert.equal(
    canonicalAdapterEmail("driver@example.test", 42),
    "driver@example.test",
  );
  assert.equal(
    canonicalAdapterEmail(null, 42),
    "legacy-user-42@auth.frl.invalid",
  );
});

test("repairs an authenticated legacy Discord identity without creating a second user", () => {
  const source = readFileSync(
    join(process.cwd(), "lib/auth/adapter.ts"),
    "utf8",
  );

  assert.match(source, /if \(provider !== "discord"\) return null;/);
  assert.match(source, /where: \{ discordId: providerAccountId \}/);
  assert.match(source, /const repairedAccount = await prisma\.account\.upsert/);
  assert.match(source, /userId: legacyUser\.id/);
  assert.match(source, /return toAdapterUser\(repairedAccount\.user\);/);
});
