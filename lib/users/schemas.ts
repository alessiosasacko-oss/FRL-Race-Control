import { z } from "zod";
import { DriverLineupStatus, Role } from "@/domain";
import { countryCodeSchema } from "@/domain/common";

const entityId = z.coerce.number().int().positive();

export const userRoleUpdateSchema = z.object({
  roles: z.array(z.enum(Role)).min(1),
  confirmed: z.literal("on"),
  reason: z.string().trim().max(500).optional().default(""),
});

export const userSportAssignmentSchema = z.object({
  seasonId: entityId,
  leagueId: entityId,
  organizationId: z.preprocess(
    (value) => value === "" || value === null ? null : value,
    entityId.nullable(),
  ),
  lineupStatus: z.enum(DriverLineupStatus),
  replacementDriverId: z.preprocess(
    (value) => value === "" || value === null ? null : value,
    entityId.nullable(),
  ).optional().default(null),
  driverName: z.string().trim().min(1).max(160),
  number: z.coerce.number().int().min(1).max(999),
  countryCode: countryCodeSchema,
  active: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  confirmed: z.literal("on"),
  reason: z.string().trim().max(500).optional().default(""),
});

export const userStatusUpdateSchema = z.object({
  active: z.preprocess((value) => value === "on" || value === true, z.boolean()),
  confirmed: z.literal("on"),
  reason: z.string().trim().max(500).optional().default(""),
});

export const userListQuerySchema = z.object({
  q: z.string().trim().max(100).catch(""),
  role: z.enum(Role).optional().catch(undefined),
  leagueId: z.coerce.number().int().positive().optional().catch(undefined),
  teamId: z.coerce.number().int().positive().optional().catch(undefined),
  lineupStatus: z.enum(DriverLineupStatus).optional().catch(undefined),
});
