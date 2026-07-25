import { z } from "zod";
import { entityIdSchema, isoDateTimeSchema } from "./common";
import { attendanceStatusSchema } from "./enums";

export const raceAttendanceSchema = z
  .object({
    id: entityIdSchema,
    raceId: entityIdSchema,
    driverId: entityIdSchema,
    substituteDriverId: entityIdSchema.nullable(),
    representedTeamId: entityIdSchema.nullable(),
    submittedByUserId: entityIdSchema,
    status: attendanceStatusSchema,
    changedAt: isoDateTimeSchema,
  })
  .strict();

export type RaceAttendance = z.infer<typeof raceAttendanceSchema>;
