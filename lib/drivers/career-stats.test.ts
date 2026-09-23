import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { ResultSession, ResultStatus } from "@/generated/prisma/client";
import { calculateAutomaticCareerStats, type CareerResultInput } from "./career-stats-calculation";
import { careerStatsView } from "./career-stats";

function result(overrides: Partial<CareerResultInput> = {}): CareerResultInput {
  return {
    position: 1,
    finalPosition: 1,
    baseStatus: ResultStatus.FINISHED,
    fastestLap: false,
    racePoints: 25,
    bonusPoints: 0,
    representedTeam: { name: "Legacy Slot", organization: { id: 1, name: "Team Alpha" } },
    resultSession: { session: ResultSession.RACE, race: { seasonId: 2, round: 1, name: "Monza", season: { name: "Season 2" } } },
    ...overrides,
  };
}

test("career totals count published session facts and exclude DNS starts", () => {
  const stats = calculateAutomaticCareerStats({
    results: [
      result({ fastestLap: true }),
      result({ position: 2, finalPosition: 2, baseStatus: ResultStatus.DNS, racePoints: 0 }),
      result({ position: 1, finalPosition: 1, racePoints: 0, resultSession: { session: ResultSession.QUALIFYING, race: { seasonId: 2, round: 1, name: "Monza", season: { name: "Season 2" } } } }),
      result({ position: 3, finalPosition: 3, racePoints: 6, resultSession: { session: ResultSession.SPRINT, race: { seasonId: 2, round: 1, name: "Monza", season: { name: "Season 2" } } } }),
    ],
    standings: [{ seasonId: 1, points: 42 }, { seasonId: 2, points: 999 }],
    assignments: [{ active: false, organization: { id: 3, name: "Team Beta" } }],
    currentOrganizationId: 1,
    currentTeamName: "Team Alpha",
  });
  assert.deepEqual(stats, {
    autoRaceStarts: 1,
    autoWins: 1,
    autoPodiums: 1,
    autoPoles: 1,
    autoFastestLaps: 1,
    autoPoints: 73,
    autoFirstGrandPrix: "Season 2 R1 Monza",
    autoPastTeams: ["Team Beta"],
  });
});

test("DNF and DSQ starts count while sprint wins do not become race wins", () => {
  const dnf = result({ position: 8, finalPosition: 8, baseStatus: ResultStatus.DNF, racePoints: 0 });
  const dsq = result({ position: 2, finalPosition: null, baseStatus: ResultStatus.DSQ, racePoints: 0 });
  const sprintWin = result({ resultSession: { session: ResultSession.SPRINT, race: { seasonId: 2, round: 1, name: "Monza", season: { name: "Season 2" } } } });
  const stats = calculateAutomaticCareerStats({
    results: [dnf, dsq, sprintWin],
    standings: [], assignments: [], currentOrganizationId: null, currentTeamName: null,
  });
  assert.equal(stats.autoRaceStarts, 2);
  assert.equal(stats.autoWins, 0);
  assert.equal(stats.autoPodiums, 0);
  assert.equal(stats.autoPoints, 25);
});

test("results suppress standings fallback only for the matching season", () => {
  const stats = calculateAutomaticCareerStats({
    results: [result({ racePoints: 10 })],
    standings: [{ seasonId: 1, points: 20 }, { seasonId: 2, points: 100 }],
    assignments: [], currentOrganizationId: null, currentTeamName: null,
  });
  assert.equal(stats.autoPoints, 30);
});

test("career reconciliation preserves every manual adjustment during its upsert", () => {
  const source = readFileSync(new URL("./career-stats.ts", import.meta.url), "utf8");
  assert.match(source, /update: automatic/);
  assert.doesNotMatch(source, /update:\s*\{[\s\S]*manualWinsAdjustment/);
});

test("career actions enforce ownership and admin-only resync or reset", () => {
  const source = readFileSync(new URL("./career-actions.ts", import.meta.url), "utf8");
  assert.match(source, /driver\.userId !== actor\.id && !admin/);
  assert.match(source, /authorized\(driverId, true\)/);
  assert.match(source, /formData\.get\("confirmation"\) !== "RESET"/);
  assert.match(source, /driverCareerStatsAudit\.create/g);
});

test("manual adjustments are additive, preserved separately and never expose negative totals", () => {
  const view = careerStatsView({
    autoRaceStarts: 3, autoWins: 1, autoPodiums: 2, autoPoles: 0, autoFastestLaps: 1, autoPoints: 50,
    manualRaceStartsAdjustment: -9, manualWinsAdjustment: 2, manualPodiumsAdjustment: 0,
    manualPolesAdjustment: 1, manualFastestLapsAdjustment: 0, manualPointsAdjustment: 5,
    autoFirstGrandPrix: "Season 2 R1 Monza", manualFirstGrandPrix: "Legacy GP",
    autoPastTeams: ["Team Beta"], manualPastTeams: ["Team Gamma", "Team Beta"], reconciledAt: null,
  });
  assert.equal(view.raceStarts, 0);
  assert.equal(view.wins, 3);
  assert.equal(view.points, 55);
  assert.equal(view.firstGrandPrix, "Season 2 R1 Monza");
  assert.deepEqual(view.pastTeams, ["Team Beta", "Team Gamma"]);
  assert.equal(view.adjustments.raceStarts, -9);
});
