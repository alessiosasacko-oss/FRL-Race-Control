import { Role } from "@/domain";

export enum Permission {
  ViewRaceControl = "VIEW_RACE_CONTROL",
  ManageTeam = "MANAGE_TEAM",
  ManageUsers = "MANAGE_USERS",
  ManageAdministration = "MANAGE_ADMINISTRATION",
  ViewMasterData = "VIEW_MASTER_DATA",
  ManageMasterData = "MANAGE_MASTER_DATA",
  ViewChampionship = "VIEW_CHAMPIONSHIP",
  ManageResults = "MANAGE_RESULTS",
  ManageScoring = "MANAGE_SCORING",
  ManageChampionshipAdjustments = "MANAGE_CHAMPIONSHIP_ADJUSTMENTS",
  ManageAutomation = "MANAGE_AUTOMATION",
  ManageBranding = "MANAGE_BRANDING",
}

const allPermissions = Object.values(Permission);

export const rolePermissions: Record<Role, readonly Permission[]> = {
  [Role.SuperAdmin]: allPermissions,
  [Role.Admin]: [
    Permission.ViewRaceControl,
    Permission.ManageUsers,
    Permission.ManageAdministration,
    Permission.ViewMasterData,
    Permission.ManageMasterData,
    Permission.ViewChampionship,
    Permission.ManageResults,
    Permission.ManageScoring,
    Permission.ManageChampionshipAdjustments,
    Permission.ManageAutomation,
    Permission.ManageBranding,
  ],
  [Role.FiaPresident]: [
    Permission.ViewRaceControl,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
  ],
  [Role.Steward]: [
    Permission.ViewRaceControl,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
  ],
  [Role.TeamPrincipal]: [
    Permission.ViewRaceControl,
    Permission.ManageTeam,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
  ],
  [Role.Driver]: [
    Permission.ViewRaceControl,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
  ],
};

export function hasRole(
  roles: readonly Role[],
  requiredRole: Role,
): boolean {
  return roles.includes(requiredRole);
}

export function hasAnyRole(
  roles: readonly Role[],
  requiredRoles: readonly Role[],
): boolean {
  return requiredRoles.some((role) => hasRole(roles, role));
}

export function hasPermission(
  roles: readonly Role[],
  permission: Permission,
): boolean {
  return roles.some((role) => rolePermissions[role].includes(permission));
}
