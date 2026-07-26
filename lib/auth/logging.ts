import "server-only";
import { logger } from "@/lib/observability/logger";

type AuthErrorDetails = Error & {
  type?: string;
  cause?: Record<string, unknown> & { err?: unknown };
};

function safeIdentifier(value: unknown): string | undefined {
  return typeof value === "string" &&
    value.length <= 80 &&
    /^[A-Za-z0-9_-]+$/.test(value)
    ? value
    : undefined;
}

function errorDetails(error: unknown): Record<string, unknown> {
  if (!(error instanceof Error)) {
    return {};
  }

  const authError = error as AuthErrorDetails;
  const cause = authError.cause;
  const nestedError = cause?.err;
  const prismaError =
    nestedError instanceof Error
      ? (nestedError as Error & {
          code?: unknown;
          meta?: { modelName?: unknown };
        })
      : undefined;

  return {
    authErrorType: safeIdentifier(authError.type) ?? authError.name,
    causeErrorName: prismaError?.name,
    errorCode:
      safeIdentifier(prismaError?.code) ??
      safeIdentifier(
        prismaError?.cause &&
          typeof prismaError.cause === "object" &&
          "code" in prismaError.cause
          ? prismaError.cause.code
          : undefined,
      ),
    modelName: safeIdentifier(prismaError?.meta?.modelName),
    provider: safeIdentifier(cause?.provider),
  };
}

export const authLogger = {
  error(error: Error): void {
    logger.error("Auth.js request failed", undefined, errorDetails(error));
  },
  warn(code: string): void {
    logger.warn("Auth.js warning", {
      code: safeIdentifier(code) ?? "unknown",
    });
  },
};
