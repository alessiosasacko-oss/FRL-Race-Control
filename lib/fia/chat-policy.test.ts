import assert from "node:assert/strict";
import test from "node:test";
import {
  discussionMentionToken,
  extractMentionQuery,
  isChatNearBottom,
  mentionsAreValid,
} from "./chat-policy";

const candidates = [
  { id: 7, displayName: "Anna Steward" },
  { id: 9, displayName: "Max Admin" },
];

test("mention tokens retain a readable display name", () => {
  assert.equal(discussionMentionToken("Anna Steward"), "@Anna Steward");
});

test("stable mention ids must resolve to accessible candidates", () => {
  assert.equal(
    mentionsAreValid("Bitte @Anna Steward prüfen.", [7], candidates),
    true,
  );
  assert.equal(
    mentionsAreValid("Bitte @Unbekannt prüfen.", [99], candidates),
    false,
  );
});

test("hidden mention ids without a visible token are rejected", () => {
  assert.equal(
    mentionsAreValid("Bitte prüfen.", [7], candidates),
    false,
  );
});

test("duplicate mention ids are rejected", () => {
  assert.equal(
    mentionsAreValid("@Anna Steward", [7, 7], candidates),
    false,
  );
});

test("mention autocomplete detects names after whitespace", () => {
  assert.equal(extractMentionQuery("Hallo @Ann"), "Ann");
  assert.equal(extractMentionQuery("@"), "");
});

test("mention autocomplete ignores completed prose", () => {
  assert.equal(extractMentionQuery("Hallo @Anna Steward"), null);
});

test("chat auto-scrolls only near the lower edge", () => {
  assert.equal(isChatNearBottom(1000, 850, 100), true);
  assert.equal(isChatNearBottom(1000, 500, 100), false);
});
