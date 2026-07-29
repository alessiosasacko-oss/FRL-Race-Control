import assert from "node:assert/strict";
import test from "node:test";
import {
  completeVideoUploadSchema,
  uploadedVideoInputSchema,
  videoUploadCompletionSchema,
  videoUploadPreparationSchema,
  videoUploadRequestSchema,
} from "@/lib/storage/evidence-schemas";
import {
  finalizationStage,
  isFinalizationRetryable,
  parseUploadResponse,
  videoUploadRetryPlan,
} from "@/lib/storage/evidence-upload-client";

const temporaryUploadId = "22af046a-82f1-4639-b8c8-2a5a44973967";
const submissionKey = "32d8befe-3156-47a1-8931-b1fb0743bcf7";
const storagePath =
  "pending/2/16c1d3ad-e5dd-4537-a56e-01c7d54ceab1.mp4";

const uploadedVideo = {
  kind: "upload" as const,
  temporaryUploadId,
  storagePath,
  originalFilename: "incident.mp4",
  mimeType: "video/mp4",
  fileSize: 1024,
  label: "Onboard",
  uploadedAt: "2026-07-29T16:00:00.000Z",
};

test("accepts a successful preparation response with HTTP 201", async () => {
  const response = new Response(
    JSON.stringify({
      temporaryUploadId,
      storagePath,
      signedUrl: "https://storage.example.test/upload",
    }),
    { status: 201 },
  );

  const parsed = await parseUploadResponse(
    response,
    videoUploadPreparationSchema,
  );
  assert.equal(parsed.temporaryUploadId, temporaryUploadId);
});

test("rejects an empty successful response instead of misreporting completion", async () => {
  await assert.rejects(
    parseUploadResponse(
      new Response(null, { status: 200 }),
      videoUploadCompletionSchema,
    ),
    /unvollständig/,
  );
});

test("uses the same completion schema for server and client", async () => {
  const body = { upload: uploadedVideo };
  assert.deepEqual(
    videoUploadCompletionSchema.parse(body),
    body,
  );
});

test("accepts a temporary wizard upload linked by submissionKey", () => {
  assert.equal(
    videoUploadRequestSchema.safeParse({
      originalFilename: "incident.mp4",
      mimeType: "video/mp4",
      fileSize: 1024,
      submissionKey,
    }).success,
    true,
  );
});

test("accepts an upload linked to an existing ticket", () => {
  assert.equal(
    videoUploadRequestSchema.safeParse({
      originalFilename: "incident.mp4",
      mimeType: "video/mp4",
      fileSize: 1024,
      ticketId: 12,
    }).success,
    true,
  );
});

test("rejects ambiguous preparation ownership", () => {
  assert.equal(
    videoUploadRequestSchema.safeParse({
      originalFilename: "incident.mp4",
      mimeType: "video/mp4",
      fileSize: 1024,
      submissionKey,
      ticketId: 12,
    }).success,
    false,
  );
});

test("requires the persistent upload ID during finalization", () => {
  assert.equal(
    completeVideoUploadSchema.safeParse({
      storagePath,
      label: "Onboard",
    }).success,
    false,
  );
});

test("preserves the persistent upload ID in completed evidence", () => {
  assert.equal(
    uploadedVideoInputSchema.parse(uploadedVideo).temporaryUploadId,
    temporaryUploadId,
  );
});

test("retries only finalization after the binary upload succeeded", () => {
  assert.equal(videoUploadRetryPlan(true), "finalize-only");
});

test("does not skip storage transfer before a binary upload succeeded", () => {
  assert.equal(
    videoUploadRetryPlan(false),
    "prepare-and-upload",
  );
});

test("marks an upload completed only after finalization succeeds", () => {
  assert.equal(finalizationStage(true), "completed");
  assert.equal(finalizationStage(false), "failed");
});

test("keeps a failed finalized upload retryable", () => {
  assert.equal(isFinalizationRetryable("failed", true), true);
});

test("does not retry a completed upload", () => {
  assert.equal(isFinalizationRetryable("completed", true), false);
});

test("does not treat a storage failure as a finalization retry", () => {
  assert.equal(isFinalizationRetryable("failed", false), false);
});

test("accepts the exact finalized upload response shape", () => {
  const parsed = videoUploadCompletionSchema.parse({
    upload: uploadedVideo,
    evidenceId: 42,
  });
  assert.equal(parsed.evidenceId, 42);
  assert.equal(parsed.upload.storagePath, storagePath);
});
