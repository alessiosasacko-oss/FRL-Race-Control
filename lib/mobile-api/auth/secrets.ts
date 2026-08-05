import "server-only";

import { createHash, randomBytes } from "node:crypto";

export function randomOpaqueToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function hashOpaqueToken(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function getMobileAuthSecret(override?: string): Buffer {
  const value = override ?? process.env.MOBILE_AUTH_SECRET;
  if (!value || Buffer.byteLength(value, "utf8") < 32) {
    throw new Error("MOBILE_AUTH_SECRET_INVALID");
  }
  if (
    process.env.NODE_ENV === "production" &&
    value === "replace-with-at-least-32-random-bytes"
  ) {
    throw new Error("MOBILE_AUTH_SECRET_INVALID");
  }
  return Buffer.from(value, "utf8");
}

export function anonymizeMobileIdentifier(value: string): string {
  return hashOpaqueToken(value).slice(0, 16);
}
