import { Role } from "@/domain";

export enum Permission {
  ViewRaceControl = "VIEW_RACE_CONTROL",
  SubmitFiaTicket = "SUBMIT_FIA_TICKET",
  ReviewFiaTicket = "REVIEW_FIA_TICKET",
  DecideFiaTicket = "DECIDE_FIA_TICKET",
  ManageTeam = "MANAGE_TEAM",
  ManageUsers = "MANAGE_USERS",
  ManageAdministration = "MANAGE_ADMINISTRATION",
  ViewMasterData = "VIEW_MASTER_DATA",
  ManageMasterData = "MANAGE_MASTER_DATA",
}

const allPermissions = Object.values(Permission);

export const rolePermissions: Record<Role, readonly Permission[]> = {
  [Role.SuperAdmin]: allPermissions,
  [Role.Admin]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ReviewFiaTicket,
    Permission.DecideFiaTicket,
    Permission.ManageUsers,
    Permission.ManageAdministration,
    Permission.ViewMasterData,
    Permission.ManageMasterData,
  ],
  [Role.FiaPresident]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ReviewFiaTicket,
    Permission.DecideFiaTicket,
    Permission.ViewMasterData,
  ],
  [Role.Steward]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ReviewFiaTicket,
    Permission.ViewMasterData,
  ],
  [Role.TeamPrincipal]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ManageTeam,
    Permission.ViewMasterData,
  ],
  [Role.Driver]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ViewMasterData,
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
