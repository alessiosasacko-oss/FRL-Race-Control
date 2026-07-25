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
  ViewChampionship = "VIEW_CHAMPIONSHIP",
  ManageOwnAttendance = "MANAGE_OWN_ATTENDANCE",
  ManageTeamAttendance = "MANAGE_TEAM_ATTENDANCE",
  ManageAttendance = "MANAGE_ATTENDANCE",
  ManageResults = "MANAGE_RESULTS",
  ManageScoring = "MANAGE_SCORING",
  ManageChampionshipAdjustments = "MANAGE_CHAMPIONSHIP_ADJUSTMENTS",
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
    Permission.ViewChampionship,
    Permission.ManageOwnAttendance,
    Permission.ManageAttendance,
    Permission.ManageResults,
    Permission.ManageScoring,
    Permission.ManageChampionshipAdjustments,
  ],
  [Role.FiaPresident]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ReviewFiaTicket,
    Permission.DecideFiaTicket,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
  ],
  [Role.Steward]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ReviewFiaTicket,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
  ],
  [Role.TeamPrincipal]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ManageTeam,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
    Permission.ManageOwnAttendance,
    Permission.ManageTeamAttendance,
  ],
  [Role.Driver]: [
    Permission.ViewRaceControl,
    Permission.SubmitFiaTicket,
    Permission.ViewMasterData,
    Permission.ViewChampionship,
    Permission.ManageOwnAttendance,
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
