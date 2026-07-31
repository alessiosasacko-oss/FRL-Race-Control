import { z } from "zod";

export const entityIdSchema = z.number().int().positive();

export const isoDateSchema = z.iso.date();

export const isoDateTimeSchema = z.iso.datetime({ offset: true });

export const countryCodeSchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{2}$/, "Expected an ISO 3166-1 alpha-2 country code.")
  .transform((value) => value.toUpperCase());

export const hexColorSchema = z
  .string()
  .regex(/^#[0-9A-F]{6}$/i, "Expected a six-digit hexadecimal color.");

export const titleSchema = z.string().trim().min(1).max(160);

export const descriptionSchema = z.string().trim().min(1).max(5000);
