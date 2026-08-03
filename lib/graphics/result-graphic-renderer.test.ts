import assert from "node:assert/strict";
import test from "node:test";
import { renderResultGraphicPng, resultGraphicSvg, RESULT_GRAPHIC_MAX_BYTES, type ResultGraphicRenderData } from "./result-graphic-renderer";

function fixture(count = 22): ResultGraphicRenderData {
  return {
    title: "RACE CLASSIFICATION",
    subtitle: "",
    leagueCode: "F3",
    seasonName: "Season 6",
    raceName: "Monaco",
    frlLogoDataUrl: null,
    leaderLabel: "WINNER" as const,
    leader: { name: "Alessio Langname der sicher gekürzt wird", number: 16, teamName: "Ferrari", teamColor: "#E80020", teamLogoDataUrl: null, character: { skinTone: "#C98F65", hairColor: "#201A18" } },
    rows: Array.from({ length: count }, (_, index) => ({ position: index + 1, name: `Fahrer mit einem sehr langen Namen ${index + 1}`, teamName: index % 2 ? "Mercedes" : "Ferrari", teamColor: index % 2 ? "#00A19C" : "#E80020", teamLogoDataUrl: null, primary: index === 0 ? "SIEGER" : `+${index}.000`, secondary: `${25 - index} PTS`, status: index === 20 ? "DNF" : index === 21 ? "DSQ" : "FINISHED" })),
  };
}

test("renders the shared FRL motorsport design with 22 rows and leader", () => {
  const svg = resultGraphicSvg(fixture());
  assert.match(svg, /RACE CLASSIFICATION/);
  assert.match(svg, /WINNER/);
  assert.match(svg, /FRL RACE CONTROL/);
  assert.match(svg, /DSQ/);
  assert.equal((svg.match(/class="result-row"/g) ?? []).length, 22);
  assert.match(svg, /Fahrer mit einem sehr langen/);
});

test("creates a valid optimized PNG below the Discord size ceiling", async () => {
  const png = await renderResultGraphicPng({ ...fixture(), draft: true });
  assert.deepEqual([...png.subarray(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.ok(png.length < RESULT_GRAPHIC_MAX_BYTES);
});

test("renders a stable fallback when logos or characters are missing", async () => {
  const data = fixture(1);
  const leader = data.leader;
  assert.ok(leader);
  data.leader = { ...leader, teamLogoDataUrl: null, character: null };
  const png = await renderResultGraphicPng(data);
  assert.ok(png.length > 1_000);
});
