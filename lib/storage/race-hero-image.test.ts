import assert from "node:assert/strict";
import test from "node:test";
import {
  RACE_HERO_MAX_BYTES,
  RaceHeroImageError,
  raceHeroVariants,
  validateRaceHeroDimensions,
  validateRaceHeroFile,
} from "./race-hero-image";

function expectCode(run: () => unknown, code: string) {
  assert.throws(run, (error: unknown) =>
    error instanceof RaceHeroImageError && error.code === code,
  );
}

test("race heroes accept matching JPEG, PNG and WebP files", () => {
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  assert.equal(validateRaceHeroFile("race.jpg", "image/jpeg", jpeg.length, jpeg), "image/jpeg");
  assert.equal(validateRaceHeroFile("race.png", "image/png", png.length, png), "image/png");
  assert.equal(validateRaceHeroFile("race.webp", "image/webp", webp.length, webp), "image/webp");
});

test("race heroes reject disguised, oversized and mismatched files", () => {
  const executable = Uint8Array.from([0x4d, 0x5a, 0x90, 0]);
  expectCode(() => validateRaceHeroFile("race.png", "image/png", executable.length, executable), "INVALID_RACE_HERO_SIGNATURE");
  expectCode(() => validateRaceHeroFile("race.jpg", "image/png", 8, new Uint8Array(8)), "RACE_HERO_EXTENSION_MISMATCH");
  expectCode(() => validateRaceHeroFile("race.png", "image/png", RACE_HERO_MAX_BYTES + 1, new Uint8Array()), "INVALID_RACE_HERO_SIZE");
});

test("desktop and mobile hero crops enforce useful source dimensions", () => {
  assert.doesNotThrow(() => validateRaceHeroDimensions("desktop", 1920, 1080));
  assert.doesNotThrow(() => validateRaceHeroDimensions("mobile", 1080, 1350));
  expectCode(() => validateRaceHeroDimensions("desktop", 800, 600), "INVALID_DESKTOP_HERO_DIMENSIONS");
  expectCode(() => validateRaceHeroDimensions("mobile", 1920, 1080), "INVALID_MOBILE_HERO_RATIO");
  assert.deepEqual(raceHeroVariants.desktop, { width: 1920, height: 1080, minWidth: 1280, minHeight: 640 });
});
