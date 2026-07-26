import { z } from "zod";

export const videoUploadRequestSchema = z.object({
  originalFilename: z.string().trim().min(1).max(255),
  mimeType: z.string().trim().min(1).max(120),
  fileSize: z.coerce.number().int().positive(),
});

export const uploadedVideoInputSchema = videoUploadRequestSchema.extend({
  kind: z.literal("upload"),
  storagePath: z
    .string()
    .trim()
    .min(1)
    .max(500)
    .regex(/^pending\/\d+\/[0-9a-f-]+\.(?:mp4|mov|webm)$/),
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

export const completeVideoUploadSchema = uploadedVideoInputSchema.omit({
  uploadedAt: true,
});

export const cancelVideoUploadSchema = z.object({
  storagePath: uploadedVideoInputSchema.shape.storagePath,
});
