import assert from "node:assert/strict";
import test from "node:test";
import {
  changedRevisionScopes,
  nextRevisionBackoff,
  parseRevisionSnapshot,
} from "./revision-client";
import {
  canClaimPollingLeadership,
  createPollingLeaderLease,
  parsePollingLeaderLease,
} from "./leader-lease";

test("an initial revision snapshot does not refresh", () => {
  assert.deepEqual(changedRevisionScopes(null, { users: "1" }), []);
});

test("only changed revision scopes refresh", () => {
  assert.deepEqual(changedRevisionScopes({ users: "1", teams: "2" }, { users: "1", teams: "3" }), ["teams"]);
});

test("revision payloads contain only known scopes and string revisions", () => {
  assert.deepEqual(parseRevisionSnapshot({ revisions: [{ scope: "users", revision: "2" }] }), { users: "2" });
  assert.equal(parseRevisionSnapshot({ revisions: [{ scope: "users", revision: 2 }] }), null);
});

test("revision error backoff is bounded", () => {
  assert.equal(nextRevisionBackoff(45_000, 45_000), 90_000);
  assert.equal(nextRevisionBackoff(180_000, 45_000), 180_000);
});

test("only an owner or an expired lease can claim leadership", () => {
  const lease = createPollingLeaderLease("tab-a", 1_000, 70_000);
  assert.equal(canClaimPollingLeadership(lease, "tab-b", 2_000), false);
  assert.equal(canClaimPollingLeadership(lease, "tab-a", 2_000), true);
  assert.equal(canClaimPollingLeadership(lease, "tab-b", 71_000), true);
  assert.deepEqual(parsePollingLeaderLease(JSON.stringify(lease)), lease);
});
