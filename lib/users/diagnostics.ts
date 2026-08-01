type ErrorWithCode = Error & { code?: unknown };

type RoleAdministrationEvent = {
  phase:
    | "action-start"
    | "policy-result"
    | "transaction-start"
    | "transaction-result"
    | "revalidation-result";
  actorId: number;
  targetId: number;
  previousRoles?: readonly string[];
  nextRoles?: readonly string[];
  result?:
    | "allowed"
    | "rejected"
    | "started"
    | "committed"
    | "completed"
    | "failed";
};

export function logUserRoleAdministrationEvent(
  event: RoleAdministrationEvent,
): void {
  console.info("[user-administration] Role update.", event);
}

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
