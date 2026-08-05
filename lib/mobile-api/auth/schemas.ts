import { z } from "zod";
import { MOBILE_REDIRECT_URI } from "./constants";
import { isValidCodeChallenge, isValidCodeVerifier } from "./pkce";

const clientStateSchema = z
  .string()
  .min(16)
  .max(255)
  .regex(/^[A-Za-z0-9._~-]+$/);

const opaqueTokenSchema = z.string().regex(/^[A-Za-z0-9_-]{43}$/);

export const mobileAuthStartSchema = z
  .object({
    redirectUri: z.literal(MOBILE_REDIRECT_URI),
    codeChallenge: z.string().refine(isValidCodeChallenge),
    codeChallengeMethod: z.literal("S256"),
    clientState: clientStateSchema,
  })
  .strict();

export const mobileAuthCallbackSchema = z
  .object({
    state: opaqueTokenSchema,
    code: z.string().min(1).max(512).optional(),
    error: z.string().min(1).max(128).optional(),
    error_description: z.string().max(512).optional(),
  })
  .strict()
  .refine((value) => Boolean(value.code) !== Boolean(value.error));

const deviceMetadataSchema = {
  platform: z.enum(["ios", "android"]).optional(),
  deviceName: z.string().trim().min(1).max(160).optional(),
  appVersion: z
    .string()
    .trim()
    .min(1)
    .max(40)
    .regex(/^[A-Za-z0-9.+_-]+$/)
    .optional(),
};

export const mobileAuthExchangeSchema = z
  .object({
    code: opaqueTokenSchema,
    codeVerifier: z.string().refine(isValidCodeVerifier),
    ...deviceMetadataSchema,
  })
  .strict();

export const mobileAuthRefreshSchema = z
  .object({ refreshToken: opaqueTokenSchema })
  .strict();

export function searchParamsObject(
  searchParams: URLSearchParams,
): Record<string, string> {
  return Object.fromEntries(searchParams.entries());
}
