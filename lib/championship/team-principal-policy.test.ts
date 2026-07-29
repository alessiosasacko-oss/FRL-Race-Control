import assert from "node:assert/strict";
import test from "node:test";
import { ResultSession } from "@/domain";
import {
  aggregateGlobalContributions,
  globalWeekendBlockReason,
  rankGlobalStandings,
} from "./team-principal-policy";

const completeWeekend = {
  activeLeagueIds: [1, 2],
  requiredSessions: [ResultSession.Race],
  publishedSessionKeys: new Set([
    `1:${ResultSession.Race}`,
    `2:${ResultSession.Race}`,
  ]),
  openTicketCount: 0,
  unappliedPenaltyCount: 0,
  unmappedTeamIds: [] as number[],
};

test("global weekend requires at least one active league", () => {
  assert.equal(
    globalWeekendBlockReason({
      ...completeWeekend,
      activeLeagueIds: [],
    }),
    "NO_ACTIVE_LEAGUES",
  );
});

test("one missing league result blocks global finalization", () => {
  assert.equal(
    globalWeekendBlockReason({
      ...completeWeekend,
      publishedSessionKeys: new Set([`1:${ResultSession.Race}`]),
    }),
    "RESULTS_INCOMPLETE",
  );
});

test("sprint weekends require sprint and race per league", () => {
  assert.equal(
    globalWeekendBlockReason({
      ...completeWeekend,
      requiredSessions: [ResultSession.Sprint, ResultSession.Race],
    }),
    "RESULTS_INCOMPLETE",
  );
});

test("open FIA tickets block global finalization", () => {
  assert.equal(
    globalWeekendBlockReason({
      ...completeWeekend,
      openTicketCount: 1,
    }),
    "FIA_TICKETS_OPEN",
  );
});

test("unapplied FIA result penalties block global finalization", () => {
  assert.equal(
    globalWeekendBlockReason({
      ...completeWeekend,
      unappliedPenaltyCount: 1,
    }),
    "FIA_PENALTIES_NOT_APPLIED",
  );
});

test("teams without stable organizations block aggregation", () => {
  assert.equal(
    globalWeekendBlockReason({
      ...completeWeekend,
      unmappedTeamIds: [42],
    }),
    "TEAM_ORGANIZATION_MISSING",
  );
});

test("complete league results and FIA state finalize safely", () => {
  assert.equal(globalWeekendBlockReason(completeWeekend), null);
});

test("organization points aggregate across leagues", () => {
  assert.deepEqual(
    aggregateGlobalContributions([
      {
        organizationId: 10,
        leagueId: 1,
        session: ResultSession.Race,
        points: 25,
      },
      {
        organizationId: 10,
        leagueId: 2,
        session: ResultSession.Race,
        points: 18,
      },
    ]),
    [
      {
        organizationId: 10,
        leagueId: 1,
        racePoints: 25,
        sprintPoints: 0,
        points: 25,
      },
      {
        organizationId: 10,
        leagueId: 2,
        racePoints: 18,
        sprintPoints: 0,
        points: 18,
      },
    ],
  );
});

test("sprint and race points remain separately auditable", () => {
  assert.deepEqual(
    aggregateGlobalContributions([
      {
        organizationId: 10,
        leagueId: 1,
        session: ResultSession.Sprint,
        points: 8,
      },
      {
        organizationId: 10,
        leagueId: 1,
        session: ResultSession.Race,
        points: 25,
      },
    ])[0],
    {
      organizationId: 10,
      leagueId: 1,
      racePoints: 25,
      sprintPoints: 8,
      points: 33,
    },
  );
});

test("standings rank deterministically by points and race points", () => {
  const standings = rankGlobalStandings([
    {
      organizationId: 2,
      organizationName: "Beta",
      racePoints: 30,
      sprintPoints: 5,
      points: 35,
      leagueIds: new Set([1]),
      raceIds: new Set([1]),
    },
    {
      organizationId: 1,
      organizationName: "Alpha",
      racePoints: 35,
      sprintPoints: 0,
      points: 35,
      leagueIds: new Set([1]),
      raceIds: new Set([1]),
    },
  ]);
  assert.deepEqual(
    standings.map(({ organizationId, position }) => ({
      organizationId,
      position,
    })),
    [
      { organizationId: 1, position: 1 },
      { organizationId: 2, position: 2 },
    ],
  );
});
