import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("retired character routes are no longer reachable", () => {
  assert.match(source("app/(protected)/profile/character/page.tsx"), /notFound\(\)/);
  assert.match(source("app/(protected)/admin/design/driver-suits/page.tsx"), /notFound\(\)/);
  assert.doesNotMatch(source("components/layout/navigation.ts"), /profile\/character|driver-suits/);
});

test("driver image route enforces ownership or master-data permission", () => {
  const route = source("app/api/drivers/[id]/image/route.ts");
  assert.match(route, /driver\.userId !== user\.id/);
  assert.match(route, /Permission\.ManageMasterData/);
  assert.match(route, /validOrigin/);
  assert.match(route, /uploadDriverImage/);
  assert.match(source("lib/storage/driver-image-storage.ts"), /validateDriverImageFile/);
  assert.match(route, /uploadFailureDetails/);
  assert.match(source("lib/storage/driver-image-storage.ts"), /DRIVER_IMAGE_BUCKET_UNAVAILABLE/);
});

test("productive driver surfaces use uploaded images with an initials fallback", () => {
  const avatar = source("components/drivers/DriverAvatar.tsx");
  for (const path of [
    "app/(protected)/drivers/page.tsx",
    "app/(protected)/drivers/[id]/page.tsx",
    "app/(protected)/teams/page.tsx",
    "app/(protected)/championship/page.tsx",
    "app/(protected)/results/[id]/page.tsx",
  ]) assert.match(source(path), /DriverAvatar/);
  assert.match(avatar, /initials/);
  assert.match(avatar, /sizes=/);
});
