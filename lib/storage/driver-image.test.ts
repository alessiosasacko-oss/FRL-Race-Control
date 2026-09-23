import assert from "node:assert/strict";
import test from "node:test";
import {
  DRIVER_IMAGE_MAX_BYTES,
  DriverImageError,
  driverImageThumbnailUrl,
  validateDriverImageFile,
} from "./driver-image";

function expectCode(run: () => unknown, code: string) {
  assert.throws(run, (error: unknown) => error instanceof DriverImageError && error.code === code);
}

test("driver images accept only matching PNG, WebP and JPEG files", () => {
  const png = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const webp = Uint8Array.from([0x52, 0x49, 0x46, 0x46, 0, 0, 0, 0, 0x57, 0x45, 0x42, 0x50]);
  const jpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xd9]);
  assert.equal(validateDriverImageFile("driver.png", "image/png", png.length, png), "image/png");
  assert.equal(validateDriverImageFile("driver.webp", "image/webp", webp.length, webp), "image/webp");
  assert.equal(validateDriverImageFile("driver.jpeg", "image/jpeg", jpeg.length, jpeg), "image/jpeg");
});

test("driver image validation rejects disguised and oversized files", () => {
  const executable = Uint8Array.from([0x4d, 0x5a, 0x90, 0]);
  expectCode(() => validateDriverImageFile("driver.png", "image/png", executable.length, executable), "INVALID_DRIVER_IMAGE_SIGNATURE");
  expectCode(() => validateDriverImageFile("driver.jpg", "image/png", executable.length, executable), "DRIVER_IMAGE_EXTENSION_MISMATCH");
  expectCode(() => validateDriverImageFile("driver.png", "image/png", DRIVER_IMAGE_MAX_BYTES + 1, executable), "INVALID_DRIVER_IMAGE_SIZE");
});

test("driver image thumbnails use the immutable upload companion", () => {
  assert.equal(
    driverImageThumbnailUrl("https://project.supabase.co/storage/v1/object/public/driver-images/12/123e4567-e89b-12d3-a456-426614174000.webp"),
    "https://project.supabase.co/storage/v1/object/public/driver-images/12/123e4567-e89b-12d3-a456-426614174000-thumb.webp",
  );
  assert.equal(driverImageThumbnailUrl("https://cdn.example.com/avatar.webp"), "https://cdn.example.com/avatar.webp");
  assert.equal(driverImageThumbnailUrl("/legacy/driver.png"), "/legacy/driver.png");
  assert.equal(driverImageThumbnailUrl(null), null);
});
