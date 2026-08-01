import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import {
  canPermanentlyDeleteTeam,
  emptyTeamDependencyCounts,
  teamArchiveRequiresDriverResolution,
  teamDeleteConfirmationMatches,
} from "./team-lifecycle";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const actions = source("lib/master-data/actions.ts");
const queries = source("lib/master-data/queries.ts");
const teamQueries = source("lib/teams/queries.ts");
const lifecycleUi = source("components/master-data/TeamLifecycleActions.tsx");
const migration = source("prisma/migrations/20260801150000_add_team_archiving/migration.sql");

test("admin can permanently delete an unused team", () => {
  assert.equal(hasPermission([Role.Admin], Permission.ManageMasterData), true);
  assert.equal(canPermanentlyDeleteTeam(emptyTeamDependencyCounts), true);
});

test("driver cannot delete a team", () => {
  assert.equal(hasPermission([Role.Driver], Permission.ManageMasterData), false);
});

test("steward cannot delete a team", () => {
  assert.equal(hasPermission([Role.Steward], Permission.ManageMasterData), false);
});

test("driver assignments block permanent deletion", () => {
  assert.equal(canPermanentlyDeleteTeam({ ...emptyTeamDependencyCounts, drivers: 1 }), false);
});

test("race results block permanent deletion", () => {
  assert.equal(canPermanentlyDeleteTeam({ ...emptyTeamDependencyCounts, results: 1 }), false);
});

test("used teams have an archive action", () => {
  assert.match(actions, /export async function archiveTeamAction/);
  assert.match(actions, /data: \{ active: false, archivedAt \}/);
});

test("archived teams stay available to historical result relations", () => {
  assert.doesNotMatch(migration, /DELETE FROM "Team"/);
  assert.match(source("prisma/schema.prisma"), /representedResults\s+RaceResult\[\]/);
});

test("archived teams are excluded from new selection options", () => {
  assert.match(queries, /where: \{ active: true, archivedAt: null \}/);
  assert.match(teamQueries, /archivedAt: input\.includeArchived \? undefined : null/);
});

test("archived teams can be restored", () => {
  assert.match(actions, /export async function restoreTeamAction/);
  assert.match(actions, /data: \{ active: true, archivedAt: null \}/);
});

test("active drivers require an explicit archive resolution", () => {
  assert.equal(teamArchiveRequiresDriverResolution([]), false);
  assert.equal(teamArchiveRequiresDriverResolution([{ id: 1, name: "Fahrer A", leagueCode: "F1" }]), true);
  assert.match(lifecycleUi, /Dieses Team besitzt noch aktive Fahrerzuordnungen/);
});

test("archiving never silently redistributes drivers", () => {
  assert.match(actions, /parsed\.data\.detachActiveDrivers/);
  assert.doesNotMatch(actions, /data: \{ teamId: [1-9]/);
});

test("team name confirmation is checked server-side", () => {
  assert.equal(teamDeleteConfirmationMatches("Ferrari", "FERRARI"), true);
  assert.equal(teamDeleteConfirmationMatches("Ferrari", "Ferrari"), false);
  assert.match(actions, /teamDeleteConfirmationMatches/);
});

test("archive writes an audit log", () => {
  assert.match(actions, /action: "TEAM_ARCHIVED"/);
});

test("restore writes an audit log", () => {
  assert.match(actions, /action: "TEAM_RESTORED"/);
});

test("permanent deletion writes an audit log", () => {
  assert.match(actions, /action: "TEAM_PERMANENTLY_DELETED"/);
});

test("archiving retains the team logo", () => {
  assert.match(actions, /logoRetained: Boolean\(snapshot\.team\.logoUrl\)/);
  assert.doesNotMatch(actions, /storage\.(remove|delete)/);
});

test("shared assets are never deleted by the team action", () => {
  assert.match(actions, /logoDisposition: "no-owned-storage-asset"/);
  assert.doesNotMatch(actions, /supabase/);
});

test("mobile team actions are touch-safe and do not use a wide table", () => {
  assert.match(lifecycleUi, /min-h-11/);
  assert.match(lifecycleUi, /max-lg:w-full/);
  assert.doesNotMatch(lifecycleUi, /<table/);
});
