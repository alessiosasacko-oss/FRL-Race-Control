import { z } from "zod";
import {
  fiaRaceSessionSchema,
  penaltyTypeSchema,
  ticketStatusSchema,
} from "@/domain";
import {
  externalEvidenceInputSchema,
  ticketEvidenceInputSchema,
} from "@/lib/storage/evidence-schemas";

const firstValue = (value: unknown): unknown =>
  Array.isArray(value) ? value[0] : value;

const optionalIdQuerySchema = z
  .preprocess(
    firstValue,
    z.preprocess(
      (value) => (value === "" || value === undefined ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
  )
  .catch(undefined);

const optionalEnumQuerySchema = <T extends z.ZodType>(
  schema: T,
): z.ZodCatch<z.ZodOptional<T>> =>
  schema.optional().catch(undefined);

export const fiaTicketListParamsSchema = z.object({
  q: z
    .preprocess(firstValue, z.string().trim().max(100).optional())
    .catch("")
    .transform((value) => value ?? ""),
  leagueId: optionalIdQuerySchema,
  seasonId: optionalIdQuerySchema,
  raceId: optionalIdQuerySchema,
  status: z
    .preprocess(firstValue, optionalEnumQuerySchema(ticketStatusSchema))
    .catch(undefined),
  session: z
    .preprocess(firstValue, optionalEnumQuerySchema(fiaRaceSessionSchema))
    .catch(undefined),
  page: z
    .preprocess(firstValue, z.coerce.number().int().positive())
    .catch(1),
  pageSize: z
    .preprocess(firstValue, z.coerce.number().int().min(6).max(48))
    .catch(12),
  sort: z
    .preprocess(
      firstValue,
      z.enum(["createdAt", "updatedAt", "title", "status"]),
    )
    .catch("updatedAt"),
  direction: z
    .preprocess(firstValue, z.enum(["asc", "desc"]))
    .catch("desc"),
});

const optionalLapSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive().max(999).optional(),
);

export const createFiaTicketSchema = z.object({
  leagueId: z.coerce.number().int().positive(),
  raceId: z.coerce.number().int().positive(),
  title: z.string().trim().min(3).max(160),
  description: z.string().trim().min(10).max(5000),
  session: fiaRaceSessionSchema,
  lap: optionalLapSchema,
  driverIds: z
    .array(z.coerce.number().int().positive())
    .min(1, "Mindestens ein Fahrer muss ausgewählt werden.")
    .max(8)
    .refine(
      (driverIds) => new Set(driverIds).size === driverIds.length,
      "Fahrer dürfen nicht mehrfach ausgewählt werden.",
    ),
  evidence: z
    .array(ticketEvidenceInputSchema)
    .max(20)
    .refine(
      (evidence) =>
        new Set(
          evidence.map((item) =>
            item.kind === "upload" ? item.storagePath : item.url,
          ),
        ).size === evidence.length,
      "Beweise dürfen nicht mehrfach hinzugefügt werden.",
    ),
});

export const addEvidenceSchema = externalEvidenceInputSchema;

export const discussionMessageSchema = z.object({
  message: z.string().trim().min(2).max(5000),
});

export const voteSchema = z.object({
  penaltyType: penaltyTypeSchema,
  penaltyValue: z.preprocess(
    (value) => (value === "" || value === null ? undefined : value),
    z.coerce.number().nonnegative().max(9999).optional(),
  ),
  reason: z.string().trim().min(5).max(5000),
});

export const decisionSchema = voteSchema;

export const ticketIdSchema = z.coerce.number().int().positive();
