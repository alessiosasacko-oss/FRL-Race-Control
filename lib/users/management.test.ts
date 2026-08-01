import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DriverLineupStatus, Role } from "@/domain";
import { countryCodeSchema } from "@/domain/common";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  countryCodeToFlagEmoji,
  normalizeCountryCode,
} from "@/lib/countries";
import {
  canPreviewWrite,
  effectiveUserAccess,
} from "./permissions";
import {
  primarySlotAvailable,
  updateAssignmentDimensions,
  validateRoleChange,
} from "./policy";
import { userSportAssignmentSchema } from "./schemas";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const roleContext = {
  actorId: 1,
  targetId: 2,
  currentRoles: [Role.Driver],
  activeSuperAdminCount: 2,
};

test("admin can add DRIVER when a driver profile exists", () => {
  assert.equal(validateRoleChange({ ...roleContext, actorRoles: [Role.Admin], currentRoles: [Role.Steward], nextRoles: [Role.Steward, Role.Driver] }), null);
});

test("admin can add STEWARD independently from the sports assignment", () => {
  assert.equal(validateRoleChange({ ...roleContext, actorRoles: [Role.Admin], nextRoles: [Role.Driver, Role.Steward] }), null);
});

test("admin can add DRIVER without a driver profile", () => {
  assert.equal(validateRoleChange({ ...roleContext, actorRoles: [Role.Admin], currentRoles: [Role.Steward], nextRoles: [Role.Steward, Role.Driver] }), null);
});

test("admin can add TEAM_PRINCIPAL without a team assignment", () => {
  assert.equal(validateRoleChange({ ...roleContext, actorRoles: [Role.Admin], nextRoles: [Role.Driver, Role.TeamPrincipal] }), null);
});

test("driver cannot invoke the role action without ManageUsers", () => {
  assert.equal(hasPermission([Role.Driver], Permission.ManageUsers), false);
  assert.match(source("lib/users/actions.ts"), /requirePermission\(Permission\.ManageUsers\)/);
});

test("normal admin cannot modify a super admin account", () => {
  assert.match(validateRoleChange({ ...roleContext, actorRoles: [Role.Admin], currentRoles: [Role.SuperAdmin], nextRoles: [Role.Admin] }) ?? "", /Super-Admin/);
});

test("last active super admin cannot be removed", () => {
  assert.match(validateRoleChange({ ...roleContext, actorRoles: [Role.SuperAdmin], currentRoles: [Role.SuperAdmin], nextRoles: [Role.Admin], activeSuperAdminCount: 1 }) ?? "", /letzte.*Super-Administrator/i);
});

test("team and league are separate assignment dimensions", () => {
  assert.deepEqual(updateAssignmentDimensions({ leagueId: 3, organizationId: 8 }, {}), { leagueId: 3, organizationId: 8 });
});

test("driver can be assigned to F3 league id", () => {
  const parsed = userSportAssignmentSchema.safeParse({ seasonId: 1, leagueId: 3, organizationId: 8, lineupStatus: "PRIMARY", driverName: "Alessio", number: 16, countryCode: "IT", active: true, confirmed: "on", reason: "" });
  assert.equal(parsed.success, true);
});

test("league change preserves the team organization", () => {
  assert.deepEqual(updateAssignmentDimensions({ leagueId: 3, organizationId: 8 }, { leagueId: 2 }), { leagueId: 2, organizationId: 8 });
});

test("team change preserves the league", () => {
  assert.deepEqual(updateAssignmentDimensions({ leagueId: 3, organizationId: 8 }, { organizationId: 10 }), { leagueId: 3, organizationId: 10 });
});

test("third active primary driver is blocked", () => {
  assert.equal(primarySlotAvailable(2), false);
});

test("substitute status is valid and not counted as a primary slot", () => {
  assert.equal(userSportAssignmentSchema.shape.lineupStatus.safeParse(DriverLineupStatus.Substitute).success, true);
  assert.equal(primarySlotAvailable(1), true);
});

test("team overview queries global organizations once", () => {
  const teamQuery = source("lib/teams/queries.ts");
  assert.match(teamQuery, /teamOrganization\.findMany/);
  assert.match(teamQuery, /organizations: organizations\.map/);
});

test("team detail groups all FRL leagues F1 through F6", () => {
  assert.match(source("lib/teams/queries.ts"), /\["F1", "F2", "F3", "F4", "F5", "F6"\]/);
});

test("team principal permission can manage own team attendance", () => {
  assert.equal(hasPermission([Role.TeamPrincipal], Permission.ManageTeamAttendance), true);
});

test("effective permissions show role-derived steward actions", () => {
  const access = effectiveUserAccess({ roles: [Role.Steward], hasDriverProfile: false });
  assert.equal(access.actions.find((item) => item.id === "vote")?.status, "ALLOWED");
  assert.match(access.actions.find((item) => item.id === "vote")?.reason ?? "", /Steward/i);
});

test("driver role without a profile keeps attendance context restricted", () => {
  const access = effectiveUserAccess({ roles: [Role.Driver], hasDriverProfile: false });
  assert.equal(access.actions.find((item) => item.id === "own-attendance")?.status, "RESTRICTED");
});

test("team principal role without a team keeps team actions restricted", () => {
  const access = effectiveUserAccess({ roles: [Role.TeamPrincipal], teamName: null });
  assert.equal(access.actions.find((item) => item.id === "team-attendance")?.status, "RESTRICTED");
});

test("permission preview can never write", () => {
  assert.equal(canPreviewWrite(), false);
});

test("navigation items carry permissions and are filtered for the user", () => {
  assert.match(source("components/layout/navigation.ts"), /permission: Permission\./);
  assert.match(source("components/layout/Sidebar.tsx"), /hasPermission\(user\.roles, item\.permission\)/);
});

test("direct user administration URL requires ManageUsers", () => {
  assert.match(source("app/(protected)/admin/users/page.tsx"), /requirePermission\(Permission\.ManageUsers\)/);
  assert.match(source("app/(protected)/admin/users/\[id\]/page.tsx"), /requirePermission\(Permission\.ManageUsers\)/);
});

test("IT renders as the Italian flag", () => {
  assert.equal(countryCodeToFlagEmoji("IT"), "🇮🇹");
});

test("DE renders as the German flag", () => {
  assert.equal(countryCodeToFlagEmoji("DE"), "🇩🇪");
});

test("lowercase country code is normalized", () => {
  assert.equal(normalizeCountryCode(" it "), "IT");
});

test("null and invalid country values are safe", () => {
  assert.equal(normalizeCountryCode(null), null);
  assert.equal(countryCodeToFlagEmoji(undefined), null);
});

test("invalid country code uses the central visual fallback", () => {
  assert.equal(countryCodeToFlagEmoji("Italy"), null);
  assert.match(source("components/ui/CountryFlag.tsx"), /Globe2/);
});

test("country selection persists a normalized ISO code", () => {
  assert.equal(countryCodeSchema.parse(" it "), "IT");
  assert.match(source("components/ui/CountrySelect.tsx"), /value=\{country\.code\}/);
});

test("result editor uses the central CountryFlag", () => {
  assert.match(source("components/championship/ResultsEditor.tsx"), /<CountryFlag/);
});

test("attendance roster uses the central CountryFlag", () => {
  assert.match(source("components/championship/AttendanceRoster.tsx"), /<CountryFlag/);
});

test("team overview uses the central CountryFlag", () => {
  assert.match(source("app/(protected)/teams/page.tsx"), /<CountryFlag/);
});

test("mobile user management uses cards and contains desktop table below lg", () => {
  const usersPage = source("app/(protected)/admin/users/page.tsx");
  assert.match(usersPage, /hidden overflow-hidden[^\n]+lg:block/);
  assert.match(usersPage, /space-y-3 lg:hidden/);
  assert.doesNotMatch(usersPage, /overflow-x-auto/);
});
