import { z } from "zod";
import {
  descriptionSchema,
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";
import {
  evidenceTypeSchema,
  penaltyTypeSchema,
  raceSessionSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
} from "./enums";
import type { Driver } from "./driver";
import type { Race } from "./race";
import type { Team } from "./team";

export const ticketEvidenceSchema = z
  .object({
    id: entityIdSchema,
    type: evidenceTypeSchema,
    url: z.url(),
    label: titleSchema,
    submittedByUserId: entityIdSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export const ticketDecisionSchema = z
  .object({
    penaltyType: penaltyTypeSchema,
    penaltyValue: z.number().nonnegative().nullable(),
    reason: descriptionSchema,
    decidedByUserIds: z.array(entityIdSchema),
    decidedAt: isoDateTimeSchema,
  })
  .strict();

export const fiaTicketSchema = z
  .object({
    id: entityIdSchema,
    title: titleSchema,
    description: descriptionSchema,
    leagueId: entityIdSchema,
    seasonId: entityIdSchema,
    raceId: entityIdSchema,
    session: raceSessionSchema,
    lap: z.number().int().positive().nullable(),
    corner: z.string().trim().min(1).max(80).nullable(),
    status: ticketStatusSchema,
    priority: ticketPrioritySchema,
    reportedByUserId: entityIdSchema.nullable(),
    involvedDriverIds: z.array(entityIdSchema).min(1),
    assignedStewardIds: z.array(entityIdSchema),
    evidence: z.array(ticketEvidenceSchema),
    decision: ticketDecisionSchema.nullable(),
    createdAt: isoDateTimeSchema,
    updatedAt: isoDateTimeSchema,
  })
  .strict()
  .refine(
    (ticket) =>
      new Set(ticket.involvedDriverIds).size ===
      ticket.involvedDriverIds.length,
    {
      message: "Involved drivers must be unique.",
      path: ["involvedDriverIds"],
    },
  )
  .refine(
    (ticket) =>
      new Set(ticket.assignedStewardIds).size ===
      ticket.assignedStewardIds.length,
    {
      message: "Assigned stewards must be unique.",
      path: ["assignedStewardIds"],
    },
  );

export type TicketEvidence = z.infer<typeof ticketEvidenceSchema>;
export type TicketDecision = z.infer<typeof ticketDecisionSchema>;
export type FiaTicket = z.infer<typeof fiaTicketSchema>;

export type FiaTicketDriverWithTeam = Driver & {
  team: Team;
};

export type FiaTicketWithRelations = FiaTicket & {
  race: Race;
  drivers: FiaTicketDriverWithTeam[];
};
