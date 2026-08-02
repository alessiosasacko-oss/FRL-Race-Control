import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const form = source("components/master-data/DriverForm.tsx");
const actions = source("lib/master-data/actions.ts");
const queries = source("lib/master-data/queries.ts");
const schema = source("lib/master-data/schemas.ts");
const page = source("app/(protected)/admin/drivers/page.tsx");

test("1. driver form renders Ferrari once from global organizations", () => {
  assert.match(form, /options\.organizations\.map/);
  assert.match(queries, /prisma\.teamOrganization\.findMany/);
});

test("2. team options contain no league prefix", () => {
  assert.doesNotMatch(form, /options\.leagues\.find[\s\S]*team\.leagueId/);
});

test("3. team options contain no season name", () => {
  assert.doesNotMatch(form, /team\.seasonId|team\.season\.name/);
});

test("4. Ferrari can be assigned in F1", () => {
  assert.match(actions, /leagueId: league\.id/);
  assert.match(actions, /organizationId: organization\?\.id \?\? null/);
});

test("5. Ferrari can be assigned in F5 through the same canonical path", () => {
  assert.match(actions, /ensureInternalTeamSlot\(transaction/);
  assert.match(actions, /seasonId: season\.id,[\s\S]*leagueId: league\.id/);
});

test("6. global teams remain independent from F1 through F6", () => {
  assert.match(queries, /code: \{ in: \["F1", "F2", "F3", "F4", "F5", "F6"\] \}/);
  assert.doesNotMatch(form, /organizations\.filter/);
});

test("7. F5 selection is persisted on DriverSeasonAssignment", () => {
  assert.match(actions, /driverSeasonAssignment\.upsert/);
  assert.match(actions, /leagueId: league\.id/);
});

test("8. assignment stores the Ferrari organization id", () => {
  assert.match(actions, /organizationId: organization\?\.id \?\? null/);
  assert.match(schema, /organizationId: optionalId/);
});

test("9. the matching technical slot is ensured automatically", () => {
  assert.match(actions, /ensureInternalTeamSlot\(transaction, \{/);
  assert.match(actions, /organizationId: organization\.id/);
});

test("10. an F1 slot cannot be reused for an F5 assignment", () => {
  assert.match(actions, /leagueId: league\.id,[\s\S]*internalTeamSlot/);
  assert.match(actions, /teamId: internalTeamSlot\?\.id \?\? null/);
});

test("11. technical slots never appear in the dropdown", () => {
  assert.doesNotMatch(form, /options\.teams|name="teamId"/);
  assert.doesNotMatch(queries, /systemManaged: true,[\s\S]*getDriverFormOptions/);
});

test("12. editing uses the canonical organization", () => {
  assert.match(form, /assignment\?\.organization\?\.id/);
  assert.match(queries, /source: "CANONICAL"/);
});

test("13. two active Ferrari F5 primary drivers are allowed", () => {
  assert.match(actions, /if \(primaryCount >= 2\)/);
});

test("14. a third active Ferrari F5 primary driver is blocked", () => {
  assert.match(actions, /PRIMARY_SLOT_FULL/);
  assert.match(actions, /bereits zwei aktive Stammfahrer/);
});

test("15. substitutes do not count against the primary limit", () => {
  assert.match(actions, /input\.lineupStatus === DriverLineupStatus\.Primary/);
  assert.match(form, /DriverLineupStatus\.Substitute}>Ersatzfahrer/);
});

test("16. a driver without a team remains valid", () => {
  assert.match(form, /<option value="">Kein Team<\/option>/);
  assert.match(actions, /teamId: internalTeamSlot\?\.id \?\? null/);
});

test("17. archived teams cannot receive new assignments", () => {
  assert.match(queries, /where: \{ active: true, archivedAt: null \}/);
  assert.match(actions, /TEAM_ARCHIVED/);
});

test("18. contradictory legacy league and slot data is diagnosed", () => {
  assert.match(queries, /Legacy-Widerspruch/);
  assert.match(page, /Zuordnungsdiagnose/);
});

test("19. driver assignment updates do not mutate historical results", () => {
  const driverBlock = actions.slice(
    actions.indexOf("function driverPayload"),
    actions.indexOf("function teamPayload"),
  );
  assert.doesNotMatch(driverBlock, /raceResult\.(?:delete|deleteMany|update|updateMany)/);
});

test("20. number conflicts receive a division-specific message", () => {
  assert.match(actions, /Die Startnummer \$\{input\.number\} ist in \$\{leagueCode\} bereits vergeben/);
});

test("21. the 390px form remains contained and touch safe", () => {
  assert.match(form, /overflow-x-hidden/);
  assert.match(form, /min-h-11 w-full sm:w-auto/);
  assert.doesNotMatch(form, /min-w-\[/);
});
