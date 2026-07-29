import type { ZodType } from "zod";
import type { VideoUploadStage } from "@/lib/storage/evidence-types";

export type VideoUploadRetryPlan =
  | "prepare-and-upload"
  | "finalize-only";

export async function parseUploadResponse<T>(
  response: Response,
  schema: ZodType<T>,
): Promise<T> {
  const text = await response.text();
  let body: unknown;
  try {
    body = text ? (JSON.parse(text) as unknown) : null;
  } catch {
    throw new Error("Der Server hat keine gültige Upload-Antwort geliefert.");
  }
  if (!response.ok) {
    const error =
      body && typeof body === "object" && "error" in body
        ? String(body.error)
        : "Der Upload ist fehlgeschlagen.";
    throw new Error(error);
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    throw new Error("Die Upload-Antwort des Servers ist unvollständig.");
  }
  return parsed.data;
}

export function videoUploadRetryPlan(
  storageUploaded: boolean,
): VideoUploadRetryPlan {
  return storageUploaded ? "finalize-only" : "prepare-and-upload";
}

export function finalizationStage(
  successful: boolean,
): VideoUploadStage {
  return successful ? "completed" : "failed";
}

export function isFinalizationRetryable(
  stage: VideoUploadStage,
  storageUploaded: boolean,
): boolean {
  return stage === "failed" && storageUploaded;
}
