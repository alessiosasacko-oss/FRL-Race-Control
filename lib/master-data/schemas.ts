import { z } from "zod";
import {
  RaceStatus,
  countryCodeSchema,
  hexColorSchema,
  raceStatusSchema,
} from "@/domain";

const optionalId = z.preprocess(
  (value) => (value === "" || value === null ? null : value),
  z.coerce.number().int().positive().nullable(),
);

const checkbox = z.preprocess(
  (value) => value === "on" || value === "true" || value === true,
  z.boolean(),
);

const name = z.string().trim().min(2).max(160);
const entityId = z.coerce.number().int().positive();

export const leagueUpdateSchema = z.object({
  name,
  description: z
    .preprocess(
      (value) => (value === "" || value === null ? null : value),
      z.string().trim().max(5000).nullable(),
    ),
  currentSeasonId: optionalId,
  active: checkbox,
});

export const seasonSchema = z
  .object({
    leagueId: entityId,
    name,
    startsOn: z.iso.date(),
    endsOn: z.iso.date(),
    active: checkbox,
  })
  .refine((season) => season.endsOn >= season.startsOn, {
    message: "Das Saisonende darf nicht vor dem Start liegen.",
    path: ["endsOn"],
  });

export const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .max(64)
  .refine((timezone) => {
    try {
      new Intl.DateTimeFormat("de-DE", { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }, "Ungültige IANA-Zeitzone.");

export const raceSchema = z.object({
  leagueId: entityId,
  seasonId: entityId,
  name,
  circuit: name,
  countryCode: countryCodeSchema,
  round: z.coerce.number().int().positive().max(999),
  localStart: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  timezone: timezoneSchema,
  status: raceStatusSchema.default(RaceStatus.Scheduled),
  sprint: checkbox,
  doublePoints: checkbox,
  mystery: checkbox,
});

export const driverSchema = z.object({
  name,
  number: z.coerce.number().int().min(1).max(999),
  flag: z.string().trim().min(1).max(16),
  countryCode: countryCodeSchema,
  userId: optionalId,
  leagueId: entityId,
  teamId: optionalId,
  active: checkbox,
});

export const teamSchema = z.object({
  name,
  shortName: z
    .string()
    .trim()
    .min(2)
    .max(12)
    .transform((value) => value.toUpperCase()),
  color: hexColorSchema,
  leagueId: entityId,
  seasonId: entityId,
  principalUserId: optionalId,
  driverIds: z.array(entityId).max(20),
  active: checkbox,
});

const firstValue = (value: unknown) =>
  Array.isArray(value) ? value[0] : value;

export const listQuerySchema = z.object({
  q: z
    .preprocess(firstValue, z.string().trim().max(100).optional())
    .catch("")
    .transform((value) => value ?? ""),
  leagueId: z
    .preprocess(
      firstValue,
      z.preprocess(
        (value) => (value === "" || value === undefined ? undefined : value),
        entityId.optional(),
      ),
    )
    .catch(undefined),
  seasonId: z
    .preprocess(
      firstValue,
      z.preprocess(
        (value) => (value === "" || value === undefined ? undefined : value),
        entityId.optional(),
      ),
    )
    .catch(undefined),
  status: z
    .preprocess(firstValue, raceStatusSchema.optional())
    .catch(undefined),
  active: z
    .preprocess(firstValue, z.enum(["all", "active", "inactive"]))
    .catch("all"),
});

export const entityIdSchema = entityId;
