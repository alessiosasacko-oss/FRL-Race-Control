import assert from "node:assert/strict";
import test from "node:test";
import {
  FIA_VIDEO_MIME_TYPES,
  MAX_FIA_VIDEO_SIZE_BYTES,
  safeEvidenceFilename,
  validateVideoMetadata,
} from "./evidence-constants";

test("accepts an MP4 video below the size limit", () => {
  assert.equal(
    validateVideoMetadata("video/mp4", 1_024),
    null,
  );
});

test("accepts a MOV video below the size limit", () => {
  assert.equal(
    validateVideoMetadata("video/quicktime", 1_024),
    null,
  );
});

test("accepts a WebM video below the size limit", () => {
  assert.equal(
    validateVideoMetadata("video/webm", 1_024),
    null,
  );
});

test("normalizes MIME type casing", () => {
  assert.equal(
    validateVideoMetadata(" VIDEO/MP4 ", 1_024),
    null,
  );
});

test("rejects an AVI video", () => {
  assert.equal(
    validateVideoMetadata("video/x-msvideo", 1_024),
    "UNSUPPORTED_VIDEO_TYPE",
  );
});

test("rejects an image disguised as evidence", () => {
  assert.equal(
    validateVideoMetadata("image/png", 1_024),
    "UNSUPPORTED_VIDEO_TYPE",
  );
});

test("rejects a missing MIME type", () => {
  assert.equal(
    validateVideoMetadata("", 1_024),
    "UNSUPPORTED_VIDEO_TYPE",
  );
});

test("rejects a zero-byte video", () => {
  assert.equal(
    validateVideoMetadata("video/mp4", 0),
    "INVALID_VIDEO_SIZE",
  );
});

test("rejects a negative video size", () => {
  assert.equal(
    validateVideoMetadata("video/mp4", -1),
    "INVALID_VIDEO_SIZE",
  );
});

test("rejects a non-integer video size", () => {
  assert.equal(
    validateVideoMetadata("video/mp4", 1.5),
    "INVALID_VIDEO_SIZE",
  );
});

test("accepts the exact maximum file size", () => {
  assert.equal(
    validateVideoMetadata("video/mp4", MAX_FIA_VIDEO_SIZE_BYTES),
    null,
  );
});

test("rejects one byte above the maximum file size", () => {
  assert.equal(
    validateVideoMetadata(
      "video/mp4",
      MAX_FIA_VIDEO_SIZE_BYTES + 1,
    ),
    "VIDEO_TOO_LARGE",
  );
});

test("honors a configured lower file size limit", () => {
  assert.equal(
    validateVideoMetadata("video/mp4", 11, 10),
    "VIDEO_TOO_LARGE",
  );
});

test("honors a configured MIME allowlist", () => {
  assert.equal(
    validateVideoMetadata(
      "video/webm",
      10,
      100,
      ["video/mp4"],
    ),
    "UNSUPPORTED_VIDEO_TYPE",
  );
});

test("defines exactly the supported browser video MIME types", () => {
  assert.deepEqual(FIA_VIDEO_MIME_TYPES, [
    "video/mp4",
    "video/quicktime",
    "video/webm",
  ]);
});

test("removes a Windows path from the original filename", () => {
  assert.equal(
    safeEvidenceFilename("C:\\fakepath\\incident.mp4"),
    "incident.mp4",
  );
});

test("removes a Unix path from the original filename", () => {
  assert.equal(
    safeEvidenceFilename("../../incident.webm"),
    "incident.webm",
  );
});

test("removes control characters from the filename", () => {
  assert.equal(
    safeEvidenceFilename("incident\u0000\u0007.mov"),
    "incident.mov",
  );
});

test("uses a safe fallback for an empty filename", () => {
  assert.equal(safeEvidenceFilename(""), "video");
});

test("limits persisted filenames to 255 characters", () => {
  assert.equal(safeEvidenceFilename("a".repeat(300)).length, 255);
});
