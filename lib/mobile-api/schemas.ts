import { z } from "zod";

const leagueCode = z
  .string()
  .trim()
  .min(1)
  .max(12)
  .regex(/^[A-Za-z0-9_-]+$/)
  .transform((value) => value.toUpperCase());

const positiveInteger = z.coerce.number().int().positive();

export const mobileLeagueQuerySchema = z
  .object({
    league: leagueCode.optional(),
  })
  .strict();

export const mobileCalendarQuerySchema = z
  .object({
    league: leagueCode.optional(),
    seasonId: positiveInteger.optional(),
  })
  .strict();

export const mobileChampionshipQuerySchema = z
  .object({
    league: leagueCode.optional(),
    seasonId: positiveInteger.optional(),
    type: z.enum(["DRIVERS", "TEAMS"]).default("DRIVERS"),
  })
  .strict();

export const mobileResultsQuerySchema = z
  .object({
    league: leagueCode.optional(),
    seasonId: positiveInteger.optional(),
    limit: z.coerce
      .number()
      .int()
      .positive()
      .transform((value) => Math.min(value, 50))
      .default(20),
    cursor: positiveInteger.optional(),
  })
  .strict();

export const mobileRaceIdSchema = positiveInteger;

export const mobileEmptyQuerySchema = z.object({}).strict();

export function searchParamsObject(
  searchParams: URLSearchParams,
): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}
