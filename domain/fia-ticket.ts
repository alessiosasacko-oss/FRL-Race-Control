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
  ticketAuditActionSchema,
  ticketPrioritySchema,
  ticketStatusSchema,
} from "./enums";

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

export const ticketAuditEntrySchema = z
  .object({
    id: entityIdSchema,
    action: ticketAuditActionSchema,
    actorUserId: entityIdSchema.nullable(),
    fromStatus: ticketStatusSchema.nullable(),
    toStatus: ticketStatusSchema.nullable(),
    details: z.string().trim().min(1).max(1000),
    createdAt: isoDateTimeSchema,
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
    auditLog: z.array(ticketAuditEntrySchema).default([]),
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
export type TicketAuditEntry = z.infer<typeof ticketAuditEntrySchema>;
export type FiaTicket = z.infer<typeof fiaTicketSchema>;
