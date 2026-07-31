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
  raceWeekday: z.coerce.number().int().min(1).max(7),
  raceStartTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .refine((value) => {
      const [hour, minute] = value.split(":").map(Number);
      return hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59;
    }, "Ungültige Startzeit."),
  raceTimezone: z
    .string()
    .trim()
    .min(1)
    .max(64)
    .refine((timezone) => {
      try {
        new Intl.DateTimeFormat("de-DE", {
          timeZone: timezone,
        }).format();
        return true;
      } catch {
        return false;
      }
    }, "Ungültige IANA-Zeitzone."),
  defaultAttendanceDeadlineHours: z.preprocess(
    (value) =>
      value === "" || value === null || value === undefined
        ? null
        : value,
    z.coerce.number().int().min(0).max(720).nullable(),
  ),
  displayOrder: z.coerce.number().int().min(0).max(999),
  updateFutureSchedules: checkbox,
  confirmFutureScheduleUpdate: checkbox,
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

export const raceSchema = z
  .object({
    seasonId: entityId,
    trackId: optionalId,
    name,
    circuit: z.preprocess(
      (value) => (value === "" || value === null ? null : value),
      name.nullable(),
    ),
    countryCode: z.preprocess(
      (value) => (value === "" || value === null ? null : value),
      countryCodeSchema.nullable(),
    ),
    round: z.coerce.number().int().positive().max(999),
    weekendDate: z.iso.date(),
    status: raceStatusSchema.default(RaceStatus.Scheduled),
    sprint: checkbox,
    doublePoints: checkbox,
    mystery: checkbox,
  })
  .superRefine((race, context) => {
    if (!race.mystery && !race.circuit) {
      context.addIssue({
        code: "custom",
        path: ["circuit"],
        message: "Bitte eine Strecke angeben.",
      });
    }
    if (!race.mystery && !race.countryCode) {
      context.addIssue({
        code: "custom",
        path: ["countryCode"],
        message: "Bitte einen Ländercode angeben.",
      });
    }
  });

export const raceDeadlineOverrideSchema = z.object({
  leagueId: entityId,
  localDeadline: z.preprocess(
    (value) => (value === "" || value === null ? null : value),
    z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/)
      .nullable(),
  ),
});

export const driverSchema = z.object({
  name,
  number: z.coerce.number().int().min(1).max(999),
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
  organizationId: entityId,
  principalUserId: optionalId,
  driverIds: z.array(entityId).max(20),
  active: checkbox,
});

export const teamOrganizationSchema = z
  .object({
    name,
    shortName: z
      .string()
      .trim()
      .min(2)
      .max(12)
      .transform((value) => value.toUpperCase()),
    color: hexColorSchema,
    active: checkbox,
    seasonId: optionalId,
    principalUserId: optionalId,
  })
  .refine(
    (organization) =>
      organization.seasonId !== null ||
      organization.principalUserId === null,
    {
      path: ["seasonId"],
      message: "Für einen Teamchef muss eine Saison gewählt werden.",
    },
  );

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
