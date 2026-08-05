import { unauthorized } from "./errors";

const BEARER_PATTERN = /^Bearer ([A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)$/;

export function readBearerToken(request: Request): string {
  const authorization = request.headers.get("authorization");
  const match = authorization?.match(BEARER_PATTERN);
  if (!match?.[1]) {
    throw unauthorized("BEARER_TOKEN_REQUIRED", "Ein Bearer Token ist erforderlich.");
  }
  return match[1];
}
