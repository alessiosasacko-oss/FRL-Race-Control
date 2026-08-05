import { createHash, timingSafeEqual } from "node:crypto";

const CODE_CHALLENGE_PATTERN = /^[A-Za-z0-9_-]{43}$/;
const CODE_VERIFIER_PATTERN = /^[A-Za-z0-9._~-]{43,128}$/;

export function isValidCodeChallenge(value: string): boolean {
  return CODE_CHALLENGE_PATTERN.test(value);
}

export function isValidCodeVerifier(value: string): boolean {
  return CODE_VERIFIER_PATTERN.test(value);
}

export function deriveCodeChallenge(codeVerifier: string): string {
  if (!isValidCodeVerifier(codeVerifier)) {
    throw new Error("INVALID_PKCE_CODE_VERIFIER");
  }
  return createHash("sha256")
    .update(codeVerifier, "ascii")
    .digest("base64url");
}

export function verifyCodeChallenge(
  codeVerifier: string,
  expectedChallenge: string,
): boolean {
  if (
    !isValidCodeVerifier(codeVerifier) ||
    !isValidCodeChallenge(expectedChallenge)
  ) {
    return false;
  }
  const actual = Buffer.from(deriveCodeChallenge(codeVerifier), "ascii");
  const expected = Buffer.from(expectedChallenge, "ascii");
  return actual.length === expected.length && timingSafeEqual(actual, expected);
}
