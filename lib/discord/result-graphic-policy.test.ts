import assert from "node:assert/strict";
import test from "node:test";
import { DiscordChannelPurpose, ResultGraphicType } from "@/domain";
import { purposeForResultGraphic, RESULT_GRAPHIC_DISCORD_MAX_ATTEMPTS, resultGraphicDedupeKey, resultGraphicScopeKeys } from "./result-graphic-policy";

test("each graphic uses its dedicated Discord purpose", () => {
  assert.equal(purposeForResultGraphic(ResultGraphicType.QualifyingClassification), DiscordChannelPurpose.QualifyingResults);
  assert.equal(purposeForResultGraphic(ResultGraphicType.RaceClassification), DiscordChannelPurpose.RaceResults);
  assert.equal(purposeForResultGraphic(ResultGraphicType.DriverChampionship), DiscordChannelPurpose.DriverStandings);
  assert.equal(purposeForResultGraphic(ResultGraphicType.ConstructorChampionship), DiscordChannelPurpose.TeamStandings);
});

test("result graphics never fall back to a global or wrong league channel", () => {
  assert.deepEqual(resultGraphicScopeKeys(3), ["LEAGUE:3"]);
  assert.ok(!resultGraphicScopeKeys(3).includes("LEAGUE:2"));
  assert.ok(!resultGraphicScopeKeys(3).includes("GLOBAL"));
});

test("render versions are idempotent and retries are capped at three", () => {
  const first = resultGraphicDedupeKey({ id: 9, version: 2, renderingVersion: 1 });
  assert.equal(first, resultGraphicDedupeKey({ id: 9, version: 2, renderingVersion: 1 }));
  assert.notEqual(first, resultGraphicDedupeKey({ id: 9, version: 3, renderingVersion: 1 }));
  assert.equal(RESULT_GRAPHIC_DISCORD_MAX_ATTEMPTS, 3);
});
