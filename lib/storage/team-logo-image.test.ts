import assert from "node:assert/strict";
import test from "node:test";
import {
  TEAM_LOGO_MAX_BYTES,
  TeamLogoImageError,
  teamLogoThumbnailUrl,
  validateTeamLogoFile,
} from "./team-logo-image";

function expectCode(run: () => unknown, code: string) {
  assert.throws(run, (error: unknown) =>
    error instanceof TeamLogoImageError && error.code === code,
  );
}

test("accepts PNG, WebP and JPEG signatures with matching metadata", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);

  assert.equal(validateTeamLogoFile("logo.png", "image/png", png.length, png), "image/png");
  assert.equal(validateTeamLogoFile("logo.webp", "image/webp", webp.length, webp), "image/webp");
  assert.equal(validateTeamLogoFile("logo.jpeg", "image/jpeg", jpeg.length, jpeg), "image/jpeg");
  assert.equal(validateTeamLogoFile("logo.jpg", "image/jpeg", jpeg.length, jpeg), "image/jpeg");
});

test("rejects unsupported formats and disguised executable content", () => {
  expectCode(
    () => validateTeamLogoFile("logo.svg", "image/svg+xml", 5, new Uint8Array(5)),
    "UNSUPPORTED_TEAM_LOGO_TYPE",
  );
  const executable = Uint8Array.from([0x4d, 0x5a, 0x90, 0]);
  expectCode(
    () => validateTeamLogoFile("logo.png", "image/png", executable.length, executable),
    "INVALID_TEAM_LOGO_SIGNATURE",
  );
});

test("rejects a mismatched file extension", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  expectCode(
    () => validateTeamLogoFile("logo.jpg", "image/png", png.length, png),
    "TEAM_LOGO_EXTENSION_MISMATCH",
  );
});

test("rejects empty, inconsistent and oversized inputs", () => {
  expectCode(
    () => validateTeamLogoFile("logo.png", "image/png", 0, new Uint8Array()),
    "INVALID_TEAM_LOGO_SIZE",
  );
  expectCode(
    () => validateTeamLogoFile("logo.png", "image/png", 9, new Uint8Array(8)),
    "INVALID_TEAM_LOGO_SIZE",
  );
  expectCode(
    () => validateTeamLogoFile("logo.png", "image/png", TEAM_LOGO_MAX_BYTES + 1, new Uint8Array()),
    "INVALID_TEAM_LOGO_SIZE",
  );
});

test("derives the immutable thumbnail URL without altering legacy URLs", () => {
  assert.equal(
    teamLogoThumbnailUrl("https://project.supabase.co/storage/v1/object/public/team-logos/3/logo.webp"),
    "https://project.supabase.co/storage/v1/object/public/team-logos/3/logo-thumb.webp",
  );
  assert.equal(teamLogoThumbnailUrl("/legacy/logo.png"), "/legacy/logo.png");
  assert.equal(teamLogoThumbnailUrl(null), null);
});
