import { z } from "zod";
import { entityIdSchema, isoDateTimeSchema } from "./common";
import {
  attendanceChangeSourceSchema,
  attendanceStatusSchema,
  roleSchema,
} from "./enums";

export const raceAttendanceSchema = z
  .object({
    id: entityIdSchema,
    raceId: entityIdSchema,
    leagueScheduleId: entityIdSchema,
    driverId: entityIdSchema,
    substituteDriverId: entityIdSchema.nullable(),
    representedTeamId: entityIdSchema.nullable(),
    submittedByUserId: entityIdSchema,
    status: attendanceStatusSchema,
    changeSource: attendanceChangeSourceSchema,
    changeReason: z.string().trim().max(1000).nullable(),
    changedAt: isoDateTimeSchema,
  })
  .strict();

export type RaceAttendance = z.infer<typeof raceAttendanceSchema>;

export const raceLeagueScheduleSchema = z
  .object({
    id: entityIdSchema,
    raceId: entityIdSchema,
    leagueId: entityIdSchema,
    scheduledAt: isoDateTimeSchema,
    timezone: z.string().trim().min(1).max(64),
    attendanceDeadline: isoDateTimeSchema.nullable(),
  })
  .strict();

export const attendanceAuditSchema = z
  .object({
    id: entityIdSchema,
    attendanceId: entityIdSchema.nullable(),
    leagueScheduleId: entityIdSchema,
    raceId: entityIdSchema,
    leagueId: entityIdSchema,
    driverId: entityIdSchema,
    changedByUserId: entityIdSchema.nullable(),
    actorRole: roleSchema,
    source: attendanceChangeSourceSchema,
    previousStatus: attendanceStatusSchema,
    newStatus: attendanceStatusSchema,
    reason: z.string().trim().max(1000).nullable(),
    createdAt: isoDateTimeSchema,
  })
  .strict();

export type RaceLeagueSchedule = z.infer<
  typeof raceLeagueScheduleSchema
>;
export type AttendanceAudit = z.infer<typeof attendanceAuditSchema>;
