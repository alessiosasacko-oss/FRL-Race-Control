import "server-only";

type LogLevel = "debug" | "info" | "warn" | "error";
type LogContext = Record<string, unknown>;

function serializeError(error: unknown): LogContext {
  if (error instanceof Error) {
    return {
      errorName: error.name,
      errorMessage: error.message,
      stack: error.stack,
    };
  }
  return { error: String(error) };
}

function write(
  level: LogLevel,
  message: string,
  context: LogContext = {},
): void {
  const entry = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    service: "frl-race-control",
    message,
    ...context,
  });

  if (level === "error") {
    console.error(entry);
  } else if (level === "warn") {
    console.warn(entry);
  } else {
    console.info(entry);
  }
}

export const logger = {
  debug(message: string, context?: LogContext) {
    if (process.env.NODE_ENV !== "production") {
      write("debug", message, context);
    }
  },
  info(message: string, context?: LogContext) {
    write("info", message, context);
  },
  warn(message: string, context?: LogContext) {
    write("warn", message, context);
  },
  error(message: string, error?: unknown, context?: LogContext) {
    write("error", message, {
      ...context,
      ...(error === undefined ? {} : serializeError(error)),
    });
  },
};
