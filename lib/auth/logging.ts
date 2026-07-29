import "server-only";
import { logger } from "@/lib/observability/logger";
import { safeAuthErrorDetails } from "@/lib/auth/logging-details";

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 80 &&
    /^[A-Za-z0-9_-]+$/.test(value)
    ? value
    : undefined;
}

export const authLogger = {
  error(error: Error): void {
    logger.error(
      "Auth.js request failed",
      undefined,
      safeAuthErrorDetails(error),
    );
  },
  warn(code: string): void {
    logger.warn("Auth.js warning", {
      code: safeIdentifier(code) ?? "unknown",
    });
  },
};
