import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  anonymizedDriverName,
  destructiveNameMatches,
  emptyDriverHistoricalDependencies,
  emptyUserHistoricalDependencies,
  hasDependencies,
} from "./driver-lifecycle";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const actions = source("lib/users/actions.ts");
const dependencies = source("lib/users/driver-dependencies.ts");
const dangerZone = source("components/users/DriverDangerZone.tsx");
const userPage = source("app/(protected)/admin/users/[id]/page.tsx");
const driverAdminPage = source("app/(protected)/admin/drivers/page.tsx");
const driverDetailPage = source("app/(protected)/admin/drivers/[id]/page.tsx");
const schema = source("prisma/schema.prisma");
const teamQueries = source("lib/teams/queries.ts");

function actionBlock(name: string, nextName?: string): string {
  const start = actions.indexOf(`export async function ${name}`);
  const end = nextName
    ? actions.indexOf(`export async function ${nextName}`, start)
    : actions.length;
  return actions.slice(start, end);
}

const profileDelete = actionBlock("deleteDriverProfileAction", "deleteUserAndDriverAction");
const fullDelete = actionBlock("deleteUserAndDriverAction", "anonymizeDriverAction");
const anonymize = actionBlock("anonymizeDriverAction");
const profileDeleteCore = actions.slice(
  actions.indexOf("async function performDriverProfileDeletion"),
  actions.indexOf("function driverProfileDeletionError"),
);
const statusCore = actions.slice(
  actions.indexOf("async function performDriverStatusChange"),
  actions.indexOf("async function updateDriverStatus"),
);
const anonymizeCore = actions.slice(
  actions.indexOf("async function performDriverAnonymization"),
  actions.indexOf("function driverAnonymizationError"),
);

test("admin can delete an unused driver profile", () => {
  assert.equal(hasPermission([Role.Admin], Permission.ManageUsers), true);
  assert.equal(hasDependencies(emptyDriverHistoricalDependencies), false);
  assert.match(profileDeleteCore, /transaction\.driver\.delete/);
});

test("normal driver cannot delete a driver profile", () => {
  assert.equal(hasPermission([Role.Driver], Permission.ManageUsers), false);
});

test("steward cannot delete a driver profile", () => {
  assert.equal(hasPermission([Role.Steward], Permission.ManageUsers), false);
});

test("only super admin can delete user and driver", () => {
  assert.match(fullDelete, /actor\.roles\.includes\(Role\.SuperAdmin\)/);
});

test("unused test driver and user are deleted transactionally", () => {
  assert.match(fullDelete, /transaction\.driver\.delete/);
  assert.match(fullDelete, /transaction\.user\.delete/);
});

test("Auth.js sessions are removed by full user deletion", () => {
  assert.match(schema, /model Session[\s\S]*user\s+User\s+@relation\([^\n]*onDelete: Cascade\)/);
});

test("Auth.js accounts are removed by full user deletion", () => {
  assert.match(schema, /model Account[\s\S]*user\s+User\s+@relation\([^\n]*onDelete: Cascade\)/);
});

test("user remains when only the driver profile is deleted", () => {
  assert.doesNotMatch(profileDelete, /transaction\.user\.delete/);
  assert.match(profileDelete, /Benutzerkonto bleibt bestehen/);
});

test("DRIVER role can be removed with the profile", () => {
  assert.match(profileDeleteCore, /role !== Role\.Driver/);
  assert.match(dangerZone, /name="removeDriverRole" defaultChecked/);
});

test("race results block hard driver deletion", () => {
  assert.match(dependencies, /database\.raceResult\.count/);
  assert.equal(hasDependencies({ ...emptyDriverHistoricalDependencies, results: 1 }), true);
});

test("FIA history blocks hard driver deletion", () => {
  assert.match(dependencies, /database\.fiaTicketDriver\.count/);
  assert.equal(hasDependencies({ ...emptyDriverHistoricalDependencies, fiaTickets: 1 }), true);
});

test("attendance blocks hard driver deletion", () => {
  assert.match(dependencies, /database\.raceAttendance\.count/);
  assert.equal(hasDependencies({ ...emptyDriverHistoricalDependencies, attendance: 1 }), true);
});

test("championship data blocks hard driver deletion", () => {
  assert.match(dependencies, /database\.driverStanding\.count/);
  assert.equal(hasDependencies({ ...emptyDriverHistoricalDependencies, standings: 1 }), true);
});

test("used driver can be deactivated", () => {
  assert.match(statusCore, /action: active \? "DRIVER_REACTIVATED" : "DRIVER_DEACTIVATED"/);
  assert.match(actions, /driverSeasonAssignment\.updateMany/);
});

test("deactivation never deletes historical results", () => {
  const statusAction = actionBlock("updateDriverStatusAction", "deleteDriverProfileAction");
  assert.doesNotMatch(statusAction, /raceResult\.(delete|deleteMany)/);
  assert.doesNotMatch(statusAction, /driverStanding\.(delete|deleteMany)/);
});

test("deactivated drivers disappear from new active team lineups", () => {
  assert.match(teamQueries, /assignment\.active && assignment\.driver\.active/);
});

test("anonymization retains results and points", () => {
  assert.doesNotMatch(anonymize, /raceResult\.(delete|deleteMany)/);
  assert.doesNotMatch(anonymize, /driverStanding\.(delete|deleteMany)/);
  assert.equal(anonymizedDriverName(123), "Ehemaliger Fahrer #123");
});

test("removing or deactivating a driver frees the team slot", () => {
  assert.match(actions, /driverSeasonAssignment\.(deleteMany|updateMany)/);
  assert.match(teamQueries, /primaryDrivers: drivers\.filter/);
});

test("no other driver is promoted automatically", () => {
  assert.doesNotMatch(profileDelete, /lineupStatus: DriverLineupStatus\.Primary/);
  assert.doesNotMatch(anonymize, /lineupStatus: DriverLineupStatus\.Primary/);
});

test("last super admin cannot be deleted", () => {
  assert.match(fullDelete, /superAdminCount <= 1/);
  assert.match(fullDelete, /LAST_SUPER_ADMIN/);
});

test("signed-in admin cannot delete themself", () => {
  assert.match(fullDelete, /actor\.id === userId/);
});

test("wrong server-side name confirmation blocks deletion", () => {
  assert.equal(destructiveNameMatches("Alessio", "ALESSIO"), true);
  assert.equal(destructiveNameMatches("Alessio", "Alessio"), false);
  assert.match(fullDelete, /destructiveNameMatches/);
});

test("all destructive mutations use serializable transactions", () => {
  assert.match(profileDeleteCore, /isolationLevel: "Serializable"/);
  assert.match(fullDelete, /isolationLevel: "Serializable"/);
  assert.match(anonymizeCore, /isolationLevel: "Serializable"/);
});

test("every lifecycle action writes a safe audit record", () => {
  for (const action of ["DRIVER_DEACTIVATED", "DRIVER_REACTIVATED", "DRIVER_PROFILE_DELETED", "USER_AND_DRIVER_DELETED", "DRIVER_ANONYMIZED"]) {
    assert.match(actions, new RegExp(action));
  }
  assert.equal(hasDependencies(emptyUserHistoricalDependencies), false);
});

test("mobile danger zone is scrollable, contained and touch safe", () => {
  assert.match(userPage, /DriverDangerZone/);
  assert.match(dangerZone, /overflow-y-auto overflow-x-hidden/);
  assert.match(dangerZone, /max-lg:w-full/);
  assert.match(dangerZone, /min-h-11/);
  assert.doesNotMatch(dangerZone, /<table/);
});

test("unlinked drivers use a driverId based deletion snapshot", () => {
  assert.match(dependencies, /getDriverDeletionSnapshotByDriverId/);
  assert.match(dependencies, /userId: true/);
  assert.match(actions, /deleteDriverByIdAction/);
});

test("driver administration exposes edit, status and delete entries", () => {
  assert.match(driverAdminPage, /Bearbeiten/);
  assert.match(driverAdminPage, /Deaktivieren/);
  assert.match(driverAdminPage, /Fahrer löschen/);
});

test("driver detail keeps a linked user account separate", () => {
  assert.match(driverDetailPage, /Benutzerkonto separat verwalten/);
  assert.match(driverDetailPage, /mode="driver"/);
});

test("driver deletion redirects to a visible success notice", () => {
  assert.match(actions, /redirect\("\/admin\/drivers\?notice=deleted"\)/);
  assert.match(driverAdminPage, /notice === "deleted"/);
});

test("driverId lifecycle actions remain server authorized", () => {
  for (const actionName of [
    "updateDriverStatusByIdAction",
    "deleteDriverByIdAction",
    "anonymizeDriverByIdAction",
  ]) {
    assert.match(actions, new RegExp(`export async function ${actionName}`));
  }
  assert.match(actions, /async function updateDriverStatus[\s\S]*Permission\.ManageUsers/);
  assert.match(actionBlock("deleteDriverByIdAction", "deleteDriverProfileAction"), /Permission\.ManageUsers/);
  assert.match(actionBlock("anonymizeDriverByIdAction", "anonymizeDriverAction"), /Permission\.ManageUsers/);
});
