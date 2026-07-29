import { z } from "zod";
import {
  DecisionOutcome,
  decisionOutcomeSchema,
  fiaRaceSessionSchema,
  PenaltyType,
  penaltyTypeSchema,
  ProposalKind,
  proposalVoteChoiceSchema,
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

export const fiaArchiveListParamsSchema = z.object({
  q: z
    .preprocess(firstValue, z.string().trim().max(100).optional())
    .catch("")
    .transform((value) => value ?? ""),
  leagueId: optionalIdQuerySchema,
  seasonId: optionalIdQuerySchema,
  raceId: optionalIdQuerySchema,
  driverId: optionalIdQuerySchema,
  decision: z
    .preprocess(firstValue, optionalEnumQuerySchema(penaltyTypeSchema))
    .catch(undefined),
  archivedFrom: z
    .preprocess(firstValue, z.iso.date().optional())
    .catch(undefined),
  archivedTo: z
    .preprocess(firstValue, z.iso.date().optional())
    .catch(undefined),
  page: z
    .preprocess(firstValue, z.coerce.number().int().positive())
    .catch(1),
  pageSize: z
    .preprocess(firstValue, z.coerce.number().int().min(6).max(48))
    .catch(20),
});

const optionalLapSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().int().positive().max(999).optional(),
);

export const createFiaTicketSchema = z.object({
  submissionKey: z.uuid(),
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
  clientMessageId: z.uuid(),
  mentionUserIds: z
    .array(z.coerce.number().int().positive())
    .max(20)
    .refine(
      (ids) => new Set(ids).size === ids.length,
      "Erwähnungen dürfen nicht doppelt vorkommen.",
    ),
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

const finalDecisionPenaltyTypeSchema = penaltyTypeSchema.refine(
  (penaltyType) =>
    penaltyType !== PenaltyType.NoFurtherAction &&
    penaltyType !== PenaltyType.GridPenalty,
  "Diese Strafart ist für FIA-Entscheidungen nicht verfügbar.",
);

export const finalizeFiaTicketSchema = z
  .object({
    outcome: decisionOutcomeSchema,
    affectedDriverId: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    reason: z.string().trim().min(5).max(5000),
    internalNote: z.preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.string().trim().max(5000).nullable(),
    ),
    proposalId: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
    confirmOpenVotes: z.boolean(),
    penalties: z
      .array(
        z.object({
          penaltyType: finalDecisionPenaltyTypeSchema,
          penaltyValue: z.number().nonnegative().max(9999).nullable(),
        }),
      )
      .max(10)
      .refine(
        (penalties) =>
          new Set(penalties.map(({ penaltyType }) => penaltyType)).size ===
          penalties.length,
        "Jede Strafkomponente darf nur einmal vorkommen.",
      ),
  })
  .superRefine((decision, context) => {
    if (
      decision.outcome === DecisionOutcome.Penalty &&
      decision.penalties.length === 0
    ) {
      context.addIssue({
        code: "custom",
        path: ["penalties"],
        message: "Eine Strafentscheidung benötigt mindestens eine Strafe.",
      });
    }
    if (
      decision.penalties.length > 0 &&
      decision.affectedDriverId === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["affectedDriverId"],
        message: "Für eine Strafe muss ein betroffener Fahrer gewählt werden.",
      });
    }
    for (const [index, penalty] of decision.penalties.entries()) {
      const requiresValue =
        penalty.penaltyType === PenaltyType.TimePenalty ||
        penalty.penaltyType === PenaltyType.PenaltyPoints ||
        penalty.penaltyType === PenaltyType.PointsDeduction;
      if (requiresValue && penalty.penaltyValue === null) {
        context.addIssue({
          code: "custom",
          path: ["penalties", index, "penaltyValue"],
          message: "Für diese Strafe ist ein Wert erforderlich.",
        });
      }
      if (!requiresValue && penalty.penaltyValue !== null) {
        context.addIssue({
          code: "custom",
          path: ["penalties", index, "penaltyValue"],
          message: "Für diese Strafe ist kein Zahlenwert vorgesehen.",
        });
      }
    }
  });

export const ticketIdSchema = z.coerce.number().int().positive();
export const proposalIdSchema = z.coerce.number().int().positive();

const optionalProposalValueSchema = z.preprocess(
  (value) => (value === "" || value === null ? undefined : value),
  z.coerce.number().nonnegative().max(9999).optional(),
);

const proposalValuePenaltyTypes = new Set<PenaltyType>([
  PenaltyType.TimePenalty,
  PenaltyType.PenaltyPoints,
  PenaltyType.PointsDeduction,
]);

const proposalPenaltyTypeSchema = penaltyTypeSchema.refine(
  (penaltyType) =>
    penaltyType !== PenaltyType.GridPenalty &&
    penaltyType !== PenaltyType.NoFurtherAction,
  "Diese Strafart ist für Vorschläge nicht verfügbar.",
);

export const createPenaltyProposalSchema = z
  .object({
    kind: z.nativeEnum(ProposalKind).default(ProposalKind.Penalty),
    title: z
      .string()
      .trim()
      .min(3)
      .max(160)
      .default("Strafenvorschlag"),
    proposedOutcome: z
      .nativeEnum(DecisionOutcome)
      .default(DecisionOutcome.Penalty),
    affectedDriverId: z.coerce.number().int().positive(),
    penaltyType: proposalPenaltyTypeSchema,
    penaltyValue: optionalProposalValueSchema,
    reason: z.string().trim().min(5).max(5000),
    durationMinutes: z.preprocess(
      (value) =>
        value === "" || value === null || value === "MANUAL"
          ? undefined
          : value,
      z.coerce.number().int().min(5).max(10080).optional(),
    ),
    closeWhenAllVoted: z.boolean(),
    evidenceIds: z
      .array(z.coerce.number().int().positive())
      .max(20)
      .refine(
        (values) => new Set(values).size === values.length,
        "Beweise dürfen nicht mehrfach verknüpft werden.",
      ),
    supersedesId: z.preprocess(
      (value) => (value === "" || value === null ? undefined : value),
      z.coerce.number().int().positive().optional(),
    ),
  })
  .superRefine((proposal, context) => {
    if (
      proposalValuePenaltyTypes.has(proposal.penaltyType) &&
      proposal.penaltyValue === undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["penaltyValue"],
        message: "Für diese Strafe ist ein Wert erforderlich.",
      });
    }
    if (
      !proposalValuePenaltyTypes.has(proposal.penaltyType) &&
      proposal.penaltyValue !== undefined
    ) {
      context.addIssue({
        code: "custom",
        path: ["penaltyValue"],
        message: "Für diese Strafe ist kein Zahlenwert vorgesehen.",
      });
    }
  });

export const penaltyProposalVoteSchema = z.object({
  choice: proposalVoteChoiceSchema,
});
