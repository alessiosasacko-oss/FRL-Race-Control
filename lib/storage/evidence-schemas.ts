import { z } from "zod";
import { safeEvidenceFilename } from "@/lib/storage/evidence-constants";

export const videoUploadRequestSchema = z.object({
  originalFilename: z
    .string()
    .transform(safeEvidenceFilename)
    .pipe(z.string().min(1).max(255)),
  mimeType: z.string().trim().min(1).max(120),
  fileSize: z.coerce.number().int().positive(),
  submissionKey: z.uuid().optional(),
  ticketId: z.coerce.number().int().positive().optional(),
}).refine(
  (value) =>
    (value.submissionKey === undefined) !==
    (value.ticketId === undefined),
  "Der Upload muss einem Ticket oder einer Ticketeinreichung zugeordnet sein.",
);

export const pendingStoragePathSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .regex(/^pending\/\d+\/[0-9a-f-]+\.(?:mp4|mov|webm)$/);

export const videoUploadPreparationSchema = z.object({
  temporaryUploadId: z.uuid(),
  signedUrl: z.url(),
  storagePath: pendingStoragePathSchema,
});

export const uploadedVideoInputSchema = z.object({
  kind: z.literal("upload"),
  temporaryUploadId: z.uuid(),
  storagePath: pendingStoragePathSchema,
  originalFilename: z
    .string()
    .transform(safeEvidenceFilename)
    .pipe(z.string().min(1).max(255)),
  mimeType: z.string().trim().min(1).max(120),
  fileSize: z.coerce.number().int().positive(),
  label: z.string().trim().min(1).max(160),
  uploadedAt: z.iso.datetime(),
});

export const externalEvidenceInputSchema = z.object({
  kind: z.literal("external"),
  url: z
    .url()
    .max(2000)
    .refine((url) => {
      const protocol = new URL(url).protocol;
      return protocol === "http:" || protocol === "https:";
    }, "Nur HTTP- und HTTPS-Links sind erlaubt."),
  label: z.string().trim().min(1).max(160),
});

export const ticketEvidenceInputSchema = z.discriminatedUnion("kind", [
  externalEvidenceInputSchema,
  uploadedVideoInputSchema,
]);

export const completeVideoUploadSchema = z.object({
  temporaryUploadId: z.uuid(),
  storagePath: pendingStoragePathSchema,
  label: z.string().trim().min(1).max(160),
});

export const cancelVideoUploadSchema = z.object({
  temporaryUploadId: z.uuid().optional(),
  storagePath: uploadedVideoInputSchema.shape.storagePath,
});

export const videoUploadCompletionSchema = z.object({
  upload: uploadedVideoInputSchema,
  evidenceId: z.number().int().positive().optional(),
});
