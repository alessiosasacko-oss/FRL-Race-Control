import { Role } from "@/domain";

export function validateRoleChange(input: {
  actorRoles: readonly Role[];
  actorId: number;
  targetId: number;
  currentRoles: readonly Role[];
  nextRoles: readonly Role[];
  activeSuperAdminCount: number;
  hasDriverProfile: boolean;
  hasTeamAssignment: boolean;
}): string | null {
  const actorIsSuperAdmin = input.actorRoles.includes(Role.SuperAdmin);
  const currentIsSuperAdmin = input.currentRoles.includes(Role.SuperAdmin);
  const nextIsSuperAdmin = input.nextRoles.includes(Role.SuperAdmin);

  if (!actorIsSuperAdmin && (currentIsSuperAdmin || nextIsSuperAdmin)) {
    return "Nur Super-Administratoren dürfen Super-Admin-Konten bearbeiten.";
  }
  if (
    currentIsSuperAdmin &&
    !nextIsSuperAdmin &&
    input.activeSuperAdminCount <= 1
  ) {
    return "Der letzte aktive Super-Administrator kann nicht entfernt werden.";
  }
  if (
    input.actorId === input.targetId &&
    currentIsSuperAdmin &&
    !nextIsSuperAdmin &&
    input.activeSuperAdminCount <= 1
  ) {
    return "Du kannst dir nicht selbst den letzten Super-Admin-Zugang entziehen.";
  }
  if (input.nextRoles.includes(Role.TeamPrincipal) && !input.hasTeamAssignment) {
    return "Die Teamchefrolle benötigt eine gültige Teamzuordnung.";
  }
  if (input.nextRoles.includes(Role.Driver) && !input.hasDriverProfile) {
    return "Die Fahrerrolle benötigt für ein aktives Konto ein Fahrerprofil.";
  }
  return null;
}

export function primarySlotAvailable(existingOtherPrimaryDrivers: number): boolean {
  return existingOtherPrimaryDrivers < 2;
}

export function updateAssignmentDimensions(
  current: { leagueId: number; organizationId: number | null },
  update: Partial<{ leagueId: number; organizationId: number | null }>,
) {
  return {
    leagueId: update.leagueId ?? current.leagueId,
    organizationId:
      update.organizationId === undefined
        ? current.organizationId
        : update.organizationId,
  };
}
