import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import {
  MOBILE_ACCESS_TOKEN_AUDIENCE,
  MOBILE_ACCESS_TOKEN_ISSUER,
  MOBILE_ACCESS_TOKEN_TTL_SECONDS,
} from "./constants";
import { unauthorized } from "./errors";
import { getMobileAuthSecret } from "./secrets";

const jwtHeaderSchema = z
  .object({ alg: z.literal("HS256"), typ: z.literal("JWT") })
  .strict();

const accessTokenClaimsSchema = z
  .object({
    iss: z.literal(MOBILE_ACCESS_TOKEN_ISSUER),
    aud: z.literal(MOBILE_ACCESS_TOKEN_AUDIENCE),
    sub: z.string().regex(/^\d+$/),
    sid: z.string().min(1).max(64),
    iat: z.number().int().nonnegative(),
    exp: z.number().int().positive(),
    jti: z.string().uuid(),
  })
  .strict();

export type MobileAccessTokenClaims = z.infer<typeof accessTokenClaimsSchema>;

type TokenOptions = {
  now?: Date;
  secret?: string;
};

function encodeJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

function decodeJson(value: string): unknown {
  if (value.length > 4_096) throw new Error("JWT_SEGMENT_TOO_LONG");
  return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
}

function signature(input: string, secret?: string): Buffer {
  return createHmac("sha256", getMobileAuthSecret(secret))
    .update(input, "ascii")
    .digest();
}

export function issueMobileAccessToken(
  input: { userId: number; sessionId: string },
  options: TokenOptions = {},
): { token: string; expiresAt: Date; claims: MobileAccessTokenClaims } {
  const now = options.now ?? new Date();
  const issuedAt = Math.floor(now.getTime() / 1_000);
  const claims: MobileAccessTokenClaims = {
    iss: MOBILE_ACCESS_TOKEN_ISSUER,
    aud: MOBILE_ACCESS_TOKEN_AUDIENCE,
    sub: String(input.userId),
    sid: input.sessionId,
    iat: issuedAt,
    exp: issuedAt + MOBILE_ACCESS_TOKEN_TTL_SECONDS,
    jti: randomUUID(),
  };
  const encodedHeader = encodeJson({ alg: "HS256", typ: "JWT" });
  const encodedClaims = encodeJson(claims);
  const unsigned = `${encodedHeader}.${encodedClaims}`;
  const tokenSignature = signature(unsigned, options.secret).toString("base64url");
  return {
    token: `${unsigned}.${tokenSignature}`,
    expiresAt: new Date(claims.exp * 1_000),
    claims,
  };
}

export function verifyMobileAccessToken(
  token: string,
  options: TokenOptions = {},
): MobileAccessTokenClaims {
  try {
    const segments = token.split(".");
    if (segments.length !== 3) throw new Error("JWT_SEGMENT_COUNT");
    const [encodedHeader, encodedClaims, encodedSignature] = segments;
    if (!encodedHeader || !encodedClaims || !encodedSignature) {
      throw new Error("JWT_SEGMENT_EMPTY");
    }
    jwtHeaderSchema.parse(decodeJson(encodedHeader));
    const expected = signature(
      `${encodedHeader}.${encodedClaims}`,
      options.secret,
    );
    const actual = Buffer.from(encodedSignature, "base64url");
    if (actual.length !== expected.length || !timingSafeEqual(actual, expected)) {
      throw new Error("JWT_SIGNATURE_INVALID");
    }
    const claims = accessTokenClaimsSchema.parse(decodeJson(encodedClaims));
    const now = Math.floor((options.now ?? new Date()).getTime() / 1_000);
    if (claims.exp <= now || claims.iat > now + 60 || claims.exp <= claims.iat) {
      throw new Error("JWT_TIME_INVALID");
    }
    return claims;
  } catch {
    throw unauthorized("ACCESS_TOKEN_INVALID", "Der Access Token ist nicht gültig.");
  }
}
