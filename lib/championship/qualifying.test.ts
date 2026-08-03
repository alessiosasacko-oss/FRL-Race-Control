import assert from "node:assert/strict";
import test from "node:test";
import { QualifyingFormat, ResultSession } from "@/domain";
import {
  hasAdvancedQualifyingData,
  qualifyingEliminationSection,
  qualifyingFormatRecommendation,
} from "./qualifying";

test("Qualifying and race remain separate canonical sessions", () => {
  assert.notEqual(ResultSession.Qualifying, ResultSession.Race);
});

test("under 17 participants recommends SHORT without enforcing it", () => {
  assert.equal(qualifyingFormatRecommendation(16).format, QualifyingFormat.Short);
  const manualSelection = QualifyingFormat.Full;
  assert.equal(manualSelection, QualifyingFormat.Full);
});

test("17 or more participants recommends FULL without enforcing it", () => {
  assert.equal(qualifyingFormatRecommendation(17).format, QualifyingFormat.Full);
  const manualSelection = QualifyingFormat.Short;
  assert.equal(manualSelection, QualifyingFormat.Short);
});

test("FULL to SHORT detects Q2 and Q3 values before hiding them", () => {
  assert.equal(hasAdvancedQualifyingData([{ q2TimeInput: "1:21.100" }]), true);
  assert.equal(hasAdvancedQualifyingData([{ q3Laps: "4" }]), true);
  assert.equal(hasAdvancedQualifyingData([{ q2TimeInput: "", q3Laps: 0 }]), false);
});

test("elimination sections derive from available session times without fixed field size", () => {
  assert.equal(qualifyingEliminationSection({ q2TimeMs: 81_000, q3TimeMs: 80_000 }), "Q3");
  assert.equal(qualifyingEliminationSection({ q2TimeMs: 81_000, q3TimeMs: null }), "Q2_EXIT");
  assert.equal(qualifyingEliminationSection({ q2TimeMs: null, q3TimeMs: null }), "Q1_EXIT");
});
