import "server-only";

import { hashOpaqueToken, randomOpaqueToken } from "./secrets";

export type RefreshTokenMaterial = {
  value: string;
  hash: string;
};

export function createRefreshToken(): RefreshTokenMaterial {
  const value = randomOpaqueToken();
  return { value, hash: hashOpaqueToken(value) };
}

export function hashRefreshToken(value: string): string {
  return hashOpaqueToken(value);
}
