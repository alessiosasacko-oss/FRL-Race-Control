import { z } from "zod";
import { descriptionSchema, entityIdSchema, isoDateTimeSchema } from "./common";
import {
  penaltyProposalStatusSchema,
  penaltyTypeSchema,
  proposalVoteChoiceSchema,
} from "./enums";

export const penaltyProposalVoteSchema = z
  .object({
    id: entityIdSchema,
    voterId: entityIdSchema,
    choice: proposalVoteChoiceSchema,
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export const penaltyProposalSchema = z
  .object({
    id: entityIdSchema,
    ticketId: entityIdSchema,
    messageId: entityIdSchema,
    creatorId: entityIdSchema,
    affectedDriverId: entityIdSchema,
    supersedesId: entityIdSchema.nullable(),
    penaltyType: penaltyTypeSchema,
    penaltyValue: z.number().nonnegative().nullable(),
    reason: descriptionSchema,
    closesAt: isoDateTimeSchema.nullable(),
    closeWhenAllVoted: z.boolean(),
    status: penaltyProposalStatusSchema,
    revision: z.number().int().positive(),
    closedAt: isoDateTimeSchema.nullable(),
    reviewedAt: isoDateTimeSchema.nullable(),
    reviewReason: descriptionSchema.nullable(),
    votes: z.array(penaltyProposalVoteSchema),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict();

export type PenaltyProposalVote = z.infer<
  typeof penaltyProposalVoteSchema
>;
export type PenaltyProposal = z.infer<typeof penaltyProposalSchema>;
