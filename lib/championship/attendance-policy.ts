import {
  AttendanceChangeSource,
  AttendanceStatus,
  Role,
} from "@/domain";

export type AttendanceActorContext = {
  userId: number;
  roles: readonly Role[];
};

export type AttendanceTargetContext = {
  driverUserId: number | null;
  driverLeagueId: number;
  teamId: number | null;
  teamPrincipalUserId: number | null;
};

export type AttendanceAuthorization = {
  allowed: boolean;
  source: AttendanceChangeSource | null;
  actorRole: Role | null;
  reasonRequired: boolean;
  deadlineOverride: boolean;
};

export function authorizeAttendanceChange(
  actor: AttendanceActorContext,
  target: AttendanceTargetContext,
  mode: "SELF" | "MANAGEMENT" = "SELF",
): AttendanceAuthorization {
  if (
    mode === "SELF" &&
    actor.roles.includes(Role.Driver) &&
    target.driverUserId === actor.userId
  ) {
    return {
      allowed: true,
      source: AttendanceChangeSource.Driver,
      actorRole: Role.Driver,
      reasonRequired: false,
      deadlineOverride: false,
    };
  }

  const isAdmin =
    actor.roles.includes(Role.SuperAdmin) ||
    actor.roles.includes(Role.Admin);
  if (isAdmin) {
    return {
      allowed: true,
      source: AttendanceChangeSource.Admin,
      actorRole: actor.roles.includes(Role.SuperAdmin)
        ? Role.SuperAdmin
        : Role.Admin,
      reasonRequired: true,
      deadlineOverride: true,
    };
  }

  if (
    actor.roles.includes(Role.TeamPrincipal) &&
    target.teamId !== null &&
    target.teamPrincipalUserId === actor.userId
  ) {
    return {
      allowed: true,
      source: AttendanceChangeSource.TeamPrincipal,
      actorRole: Role.TeamPrincipal,
      reasonRequired: true,
      deadlineOverride: false,
    };
  }

  if (
    actor.roles.includes(Role.Driver) &&
    target.driverUserId === actor.userId
  ) {
    return {
      allowed: true,
      source: AttendanceChangeSource.Driver,
      actorRole: Role.Driver,
      reasonRequired: false,
      deadlineOverride: false,
    };
  }

  return {
    allowed: false,
    source: null,
    actorRole: null,
    reasonRequired: false,
    deadlineOverride: false,
  };
}

export function attendanceChangeIsAllowed(
  authorization: AttendanceAuthorization,
  deadline: Date | null,
  reason: string | null,
  now = new Date(),
): boolean {
  if (!authorization.allowed) return false;
  if (
    deadline &&
    deadline <= now &&
    !authorization.deadlineOverride
  ) {
    return false;
  }
  return !authorization.reasonRequired || Boolean(reason?.trim());
}

export function shouldPersistAttendanceChange(
  previousStatus: AttendanceStatus,
  nextStatus: AttendanceStatus,
): boolean {
  return previousStatus !== nextStatus;
}

export function attendanceCounts(
  statuses: readonly AttendanceStatus[],
): Record<AttendanceStatus, number> {
  return statuses.reduce<Record<AttendanceStatus, number>>(
    (counts, status) => ({
      ...counts,
      [status]: counts[status] + 1,
    }),
    {
      [AttendanceStatus.Registered]: 0,
      [AttendanceStatus.Declined]: 0,
      [AttendanceStatus.NoResponse]: 0,
    },
  );
}

export function filterAttendanceDriversByLeague<
  T extends { leagueId: number },
>(drivers: readonly T[], leagueId: number): T[] {
  return drivers.filter((driver) => driver.leagueId === leagueId);
}

export function attendanceNotificationRecipients({
  source,
  actorUserId,
  driverUserId,
  teamPrincipalUserId,
}: {
  source: AttendanceChangeSource;
  actorUserId: number;
  driverUserId: number | null;
  teamPrincipalUserId: number | null;
}): { driver: number[]; teamPrincipal: number[] } {
  return {
    driver:
      source !== AttendanceChangeSource.Driver &&
      driverUserId !== null &&
      driverUserId !== actorUserId
        ? [driverUserId]
        : [],
    teamPrincipal:
      source === AttendanceChangeSource.Driver &&
      teamPrincipalUserId !== null &&
      teamPrincipalUserId !== actorUserId
        ? [teamPrincipalUserId]
        : [],
  };
}
