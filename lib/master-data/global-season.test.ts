import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = (path: string) => readFileSync(path, "utf8");

test("season administration exposes one global season and one current switch", () => {
  const form = source("components/master-data/SeasonForm.tsx");
  const leagueForm = source("components/master-data/LeagueForm.tsx");
  assert.doesNotMatch(form, /name="leagueId"/);
  assert.match(form, /name="isCurrent"/);
  assert.doesNotMatch(leagueForm, /name="currentSeasonId"/);
});

test("global season creation connects every active FRL league and synchronizes current season", () => {
  const actions = source("lib/master-data/actions.ts");
  assert.match(actions, /code: \{ in: \["F1", "F2", "F3", "F4", "F5", "F6"\] \}/);
  assert.match(actions, /participatingLeagues:\s*\{\s*connect: leagues/);
  assert.match(actions, /currentSeasonId: season\.id/);
});

test("migration merges only compatible exact duplicates and records ambiguous groups", () => {
  const migration = source("prisma/migrations/20260923120000_simplify_results_driver_profiles/migration.sql");
  assert.match(migration, /SeasonGlobalizationReview/);
  assert.match(migration, /_season_merge_map/);
  assert.match(migration, /mehrdeutiger oder kollidierender Abhängigkeiten ausgelassen/);
  assert.match(migration, /lower\(trim\(season\."name"\)\)/);
});
