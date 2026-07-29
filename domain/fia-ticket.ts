import { z } from "zod";
import {
  descriptionSchema,
  entityIdSchema,
  isoDateTimeSchema,
  titleSchema,
} from "./common";
import {
  evidenceTypeSchema,
  decisionOutcomeSchema,
  penaltyTypeSchema,
  RaceSession,
  raceSessionSchema,
  ticketAuditActionSchema,
  ticketStatusSchema,
} from "./enums";

export const fiaRaceSessions = [
  RaceSession.Qualifying,
  RaceSession.Sprint,
  RaceSession.Race,
] as const;

export const fiaRaceSessionSchema = z.enum(fiaRaceSessions);

export const ticketEvidenceSchema = z
  .object({
    id: entityIdSchema,
    type: evidenceTypeSchema,
    url: z.url().nullable(),
    label: titleSchema,
    storagePath: z.string().trim().min(1).max(500).nullable(),
    originalFilename: z.string().trim().min(1).max(255).nullable(),
    mimeType: z.string().trim().min(1).max(120).nullable(),
    fileSize: z.number().int().positive().nullable(),
    submittedByUserId: entityIdSchema.nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict()
  .refine(
    (evidence) =>
      (evidence.url !== null && evidence.storagePath === null) ||
      (evidence.url === null &&
        evidence.storagePath !== null &&
        evidence.originalFilename !== null &&
        evidence.mimeType !== null &&
        evidence.fileSize !== null),
    "Evidence must be either an external URL or a complete stored file.",
  );

export const ticketDecisionSchema = z
  .object({
    outcome: decisionOutcomeSchema,
    penaltyType: penaltyTypeSchema,
    penaltyValue: z.number().nonnegative().nullable(),
    penalties: z.array(
      z
        .object({
          penaltyType: penaltyTypeSchema,
          penaltyValue: z.number().nonnegative().nullable(),
        })
        .strict(),
    ),
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
    status: ticketStatusSchema,
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
