import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { primarySlotAvailable } from "@/lib/users/policy";
import {
  canPermanentlyDeleteTeam,
  emptyTeamDependencyCounts,
  internalTeamSlotKey,
  teamArchiveRequiresDriverResolution,
  teamDeleteConfirmationMatches,
} from "./team-lifecycle";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const actions = source("lib/master-data/actions.ts");
const usersActions = source("lib/users/actions.ts");
const queries = source("lib/master-data/queries.ts");
const teamQueries = source("lib/teams/queries.ts");
const internalSlots = source("lib/master-data/internal-team-slots.ts");
const adminPage = source("app/(protected)/admin/teams/page.tsx");
const teamForm = source("components/master-data/TeamOrganizationForm.tsx");
const lifecycleUi = source("components/master-data/TeamLifecycleActions.tsx");
const championshipQueries = source("lib/championship/queries.ts");
const migration = source("prisma/migrations/20260801170000_global_team_identity/migration.sql");

test("Ferrari can be created exactly once as a global team", () => {
  assert.match(actions, /activeOrganizationIdentityExists/);
  assert.match(source("prisma/schema.prisma"), /@@unique\(\[name\]\)/);
});

test("team creation has no league selector", () => {
  assert.doesNotMatch(teamForm, /name="leagueId"/);
  assert.doesNotMatch(adminPage, /<TeamForm/);
});

test("team creation has no season selector", () => {
  assert.doesNotMatch(teamForm, /name="seasonId"/);
});

test("admin cannot manually create Ferrari F1", () => {
  assert.match(actions, /manualTeamCrudDisabled\(\)/);
  assert.match(actions, /Technische Saison-\/Liga-Slots werden ausschließlich automatisch verwaltet/);
});

test("admin cannot manually create Ferrari F2 through manipulated dimensions", () => {
  assert.match(actions, /hasForbiddenManualTeamDimensions/);
  assert.match(actions, /\["leagueId", "seasonId", "organizationId", "driverIds"\]/);
});

test("one current team principal is stored for the global team", () => {
  assert.match(actions, /teamOrganizationSeason\.findUnique/);
  assert.match(actions, /organizationId_seasonId/);
  assert.doesNotMatch(teamForm, /Team Principal pro Liga/);
});

test("driver can be assigned to Ferrari and F1", () => {
  assert.match(usersActions, /organizationId: organization\?\.id \?\? null/);
  assert.match(usersActions, /leagueId: league\.id/);
});

test("another driver can use the same Ferrari identity in F2", () => {
  assert.match(usersActions, /ensureInternalTeamSlot\(transaction/);
  assert.match(usersActions, /organizationId: organization\.id/);
});

test("all division assignments use the same organizationId", () => {
  assert.match(source("prisma/schema.prisma"), /organizationId Int\?/);
  assert.match(source("prisma/schema.prisma"), /organization\s+TeamOrganization\?/);
});

test("only two active primary drivers fit into a team division", () => {
  assert.equal(primarySlotAvailable(0), true);
  assert.equal(primarySlotAvailable(1), true);
  assert.equal(primarySlotAvailable(2), false);
  assert.match(usersActions, /throw new Error\("PRIMARY_SLOT_FULL"\)/);
});

test("substitutes do not count against the primary limit", () => {
  assert.match(usersActions, /lineupStatus: DriverLineupStatus\.Primary/);
  assert.doesNotMatch(usersActions, /lineupStatus: DriverLineupStatus\.Substitute,[\s\S]{0,80}primaryCount/);
});

test("admin and public overviews show each organization only once", () => {
  assert.match(queries, /teamOrganization\.findMany/);
  assert.match(teamQueries, /teamOrganization\.findMany/);
  assert.doesNotMatch(adminPage, /getTeamItems/);
});

test("team detail renders F1 through F6 without a wide mobile table", () => {
  assert.match(teamQueries, /const leagueCodes = \["F1", "F2", "F3", "F4", "F5", "F6"\]/);
  assert.doesNotMatch(adminPage, /<table/);
  assert.match(adminPage, /sm:grid-cols-2 lg:grid-cols-3/);
});

test("F3 team standings display the organization name", () => {
  assert.match(championshipQueries, /standing\.team\.organization \?\? standing\.team/);
});

test("global team-principal standings aggregate by organizationId", () => {
  const policy = source("lib/championship/team-principal-policy.ts");
  assert.match(policy, /organizationId/);
  assert.match(policy, /const key = `\$\{row\.organizationId\}:\$\{row\.leagueId\}`/);
});

test("internal team slots are automatic and idempotent", () => {
  assert.equal(
    internalTeamSlotKey({ organizationId: 3, seasonId: 2, leagueId: 1 }),
    "organization:3:season:2:league:1",
  );
  assert.match(internalSlots, /team\.findUnique/);
  assert.match(internalSlots, /team\.findFirst/);
  assert.match(internalSlots, /team\.create/);
});

test("internal slots do not appear in the admin UI", () => {
  assert.doesNotMatch(adminPage, /TeamForm/);
  assert.doesNotMatch(adminPage, /Saisonbezogene Teams/);
});

test("internal slots cannot be archived separately", () => {
  assert.match(actions, /transaction\.teamOrganization\.update/);
  assert.match(actions, /transaction\.team\.updateMany/);
});

test("global archiving covers every slot and requires driver resolution", () => {
  assert.equal(teamArchiveRequiresDriverResolution([]), false);
  assert.equal(teamArchiveRequiresDriverResolution([{ id: 1, name: "A", leagueCode: "F1" }]), true);
  assert.match(actions, /where: \{ organizationId: snapshot\.organization\.id \}/);
  assert.match(lifecycleUi, /Aktive Fahrer ausdrücklich auf „Ohne Team“ setzen/);
});

test("historical results are preserved by the additive migration", () => {
  assert.doesNotMatch(migration, /DELETE FROM "RaceResult"/);
  assert.doesNotMatch(migration, /DELETE FROM "TeamStanding"/);
  assert.match(migration, /Legacy Team rows[\s\S]*remain intact/);
});

test("team lifecycle remains restricted to administrators", () => {
  assert.equal(hasPermission([Role.Admin], Permission.ManageMasterData), true);
  assert.equal(hasPermission([Role.Driver], Permission.ManageMasterData), false);
  assert.equal(hasPermission([Role.Steward], Permission.ManageMasterData), false);
});

test("unused global teams can be deleted with server-side name confirmation", () => {
  assert.equal(canPermanentlyDeleteTeam(emptyTeamDependencyCounts), true);
  assert.equal(teamDeleteConfirmationMatches("Ferrari", "FERRARI"), true);
  assert.equal(teamDeleteConfirmationMatches("Ferrari", "Ferrari"), false);
  assert.match(actions, /transaction\.team\.deleteMany/);
  assert.match(actions, /transaction\.teamOrganization\.delete/);
});
