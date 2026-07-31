type ErrorWithCode = Error & { code?: unknown };

export function logUserAdministrationFailure(
  phase: string,
  error: unknown,
): void {
  const typedError = error instanceof Error ? error as ErrorWithCode : null;
  console.error("[user-administration] Request failed.", {
    phase,
    errorClass: typedError?.name ?? "UnknownError",
    prismaCode:
      typeof typedError?.code === "string" ? typedError.code : undefined,
    file: phase.startsWith("role-update")
      ? "lib/users/actions.ts"
      : "lib/users/queries.ts",
  });
}
