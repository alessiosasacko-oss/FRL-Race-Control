import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { validateSvgAsset } from "@/lib/design/theme";
import { trackSchema } from "./schemas";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const form = source("components/tracks/TrackForm.tsx");
const page = source("app/(protected)/calendar/[id]/page.tsx");
const visual = source("components/tracks/TrackVisual.tsx");
const queries = source("lib/tracks/queries.ts");
const actions = source("lib/tracks/actions.ts");
const storage = source("lib/storage/branding-storage.ts");
const prisma = source("prisma/schema.prisma");
const migration = source("prisma/migrations/20260731210000_add_sm_straight_mode/migration.sql");

function validTrackInput() {
  return {
    name: "Hockenheimring",
    countryCode: "de",
    lengthKm: "4.574",
    lapCount: "67",
    sectorCount: "3",
    smStraightModeZones: "2",
    longestStraightM: "1050",
    poleSide: "LEFT",
    pitLaneLossSeconds: "20.4",
    notes: "",
    active: "on",
    layoutAsset: "",
    layoutMimeType: "",
    primaryColor: "#3B82F6",
    secondaryColor: "#22D3EE",
    overlayStrength: "65",
    lightBannerText: "on",
    useThemeLayoutColor: "on",
    layoutColor: "#3B82F6",
    lineWidth: "3",
    showStartFinish: "on",
    showSectors: "",
    showCornerNumbers: "",
  };
}

test("track can be validated without a total distance", () => {
  assert.equal(trackSchema.safeParse(validTrackInput()).success, true);
  assert.equal("totalDistanceKm" in trackSchema.shape, false);
});

test("track can be validated without overtake points", () => {
  assert.equal("overtakePoints" in trackSchema.shape, false);
});

test("the active track form has no DRS field", () => {
  assert.doesNotMatch(form, /DRS|drsZones/);
});

test("SM Straight Mode is validated as a bounded zone count", () => {
  const parsed = trackSchema.parse(validTrackInput());
  assert.equal(parsed.smStraightModeZones, 2);
  assert.equal(trackSchema.safeParse({ ...validTrackInput(), smStraightModeZones: "21" }).success, false);
});

test("race weekend presents SM Straight Mode", () => {
  assert.match(page, /SM Straight Mode/);
  assert.match(page, /formatStraightMode/);
});

test("total distance is absent from active form, page and query", () => {
  for (const activeSource of [form, page, queries]) assert.doesNotMatch(activeSource, /totalDistanceKm|Gesamtdistanz/);
});

test("overtake points are absent from active form, page and query", () => {
  for (const activeSource of [form, page, queries, visual]) assert.doesNotMatch(activeSource, /overtakePoints|Overtake Points/);
});

test("the track form offers exactly one media file input", () => {
  assert.equal(form.match(/type="file"/g)?.length, 1);
  assert.match(form, /Streckenlayout hochladen/);
});

test("hero image upload is not available", () => {
  assert.doesNotMatch(form, /heroAsset|Hero-Bild/);
});

test("mobile hero upload is not available", () => {
  assert.doesNotMatch(form, /mobileHeroAsset|Mobiles Hero/);
});

test("SVG layout sanitizer rejects active and external content", () => {
  assert.throws(() => validateSvgAsset('<svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'));
  assert.throws(() => validateSvgAsset('<svg xmlns="http://www.w3.org/2000/svg"><image href="https://example.com/a.png"/></svg>'));
});

test("PNG layout validation checks MIME and magic bytes", () => {
  assert.match(storage, /image\/png/);
  assert.match(storage, /hasPngSignature/);
});

test("WebP layout validation checks MIME and magic bytes", () => {
  assert.match(storage, /image\/webp/);
  assert.match(storage, /hasWebpSignature/);
});

test("a missing layout renders a neutral placeholder", () => {
  assert.match(visual, /noch kein Layout hinterlegt/i);
  assert.match(visual, /Route className/);
});

test("existing races remain linked to their track", () => {
  assert.match(prisma, /races\s+Race\[\]/);
  assert.match(queries, /_count:\s*\{\s*select:\s*\{\s*races: true/);
});

test("mobile track layouts stay contained without page overflow", () => {
  assert.match(visual, /w-full max-w-md/);
  assert.match(visual, /overflow-hidden/);
  assert.match(form, /min-w-0/);
});

test("desktop race weekend keeps the layout and facts grid", () => {
  assert.match(page, /xl:grid-cols-\[minmax\(0,1\.15fr\)_minmax\(22rem,\.85fr\)\]/);
  assert.match(page, /<TrackVisual/);
  assert.match(page, /<DesktopTrackFacts/);
});

test("legacy hero assets remain mapped and are never deleted by track updates", () => {
  assert.match(prisma, /legacyHeroAsset\s+String\?\s+@map\("heroAsset"\)/);
  assert.match(prisma, /legacyMobileHeroAsset\s+String\?\s+@map\("mobileHeroAsset"\)/);
  assert.doesNotMatch(actions, /legacyHeroAsset|legacyMobileHeroAsset|storage\.remove/);
  assert.match(migration, /intentionally not copied/);
  assert.doesNotMatch(migration, /DROP COLUMN|DELETE FROM/);
});
