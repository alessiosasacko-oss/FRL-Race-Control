import assert from "node:assert/strict";
import test from "node:test";
import sharp from "sharp";
import { graphicTemplates, type GraphicTemplate } from "./templates/catalog";
import { graphicFixture, raceFixture, sessionFixture } from "./testing/fixtures";
import { prepareSessionGraphic, selectGraphicSession } from "./result-graphic-data";
import { ResultGraphicType, ResultPublicationStatus, ResultSession, ResultStatus } from "@/domain/enums";
import { processDriverImage } from "@/lib/storage/driver-image-storage";
import { hydrateGraphicAssets, safeGraphicAssetDataUrl } from "./result-graphic-storage";
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
    leader: { name: "Alessio Langname der sicher gekürzt wird", number: 16, teamName: "Ferrari", teamColor: "#E80020", teamLogoDataUrl: null, imageDataUrl: null },
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

test("renders a stable fallback when logos or driver images are missing", async () => {
  const data = fixture(1);
  const leader = data.leader;
  assert.ok(leader);
  data.leader = { ...leader, teamLogoDataUrl: null, imageDataUrl: null };
  const png = await renderResultGraphicPng(data);
  assert.ok(png.length > 1_000);
});

test("every studio template renders a sharp, deterministic PNG including transparent driver renders", async () => {
  const asset = await sharp({ create: { width: 200, height: 400, channels: 4, background: { r: 38, g: 230, b: 220, alpha: .5 } } }).png().toBuffer();
  for (const template of Object.keys(graphicTemplates) as GraphicTemplate[]) {
    const data = graphicFixture(24);
    data.template = template;
    data.title = graphicTemplates[template].label;
    data.highlights = data.highlights!.slice(0, template === "PODIUM" ? 3 : template === "FRONT_ROW" ? 2 : 1).map((driver) => ({ ...driver, imageKind: "render", imageDataUrl: `data:image/png;base64,${asset.toString("base64")}`, teamLogoDataUrl: `data:image/png;base64,${asset.toString("base64")}` }));
    data.leader = data.highlights[0];
    const png = await renderResultGraphicPng(data);
    const metadata = await sharp(png).metadata();
    assert.equal(metadata.width, 1920, template);
    assert.ok(metadata.height! >= 1080, template);
    assert.ok(png.length < RESULT_GRAPHIC_MAX_BYTES, template);
    assert.deepEqual(png, await renderResultGraphicPng(data), template);
  }
});

test("large fields retain every row, escape text and reject external SVG image references", () => {
  const data = graphicFixture(60);
  data.rows[59].name = '<script>"&</script>';
  data.leader!.imageDataUrl = 'https://untrusted.example/image.png" onload="alert(1)';
  const svg = resultGraphicSvg(data);
  assert.equal((svg.match(/class="result-row"/g) ?? []).length, 60);
  assert.match(svg, /&lt;script&gt;/);
  assert.doesNotMatch(svg, /<script>|onload=|untrusted\.example/);
  assert.match(svg, /height="2382"/);
});

test("final classification, highlights, grid and fastest lap derive from canonical fields", () => {
  const session = sessionFixture();
  session.results[0].fastestLapMs = 75000;
  const race = prepareSessionGraphic(session, ResultGraphicType.RaceClassification);
  assert.deepEqual(race.rows.map((row) => row.position), [1, 2, 3]);
  assert.equal(race.highlights[0].driverId, 1);
  assert.equal(prepareSessionGraphic(session, "FASTEST_LAP").highlights[0].driverId, 3);
  assert.deepEqual(prepareSessionGraphic(session, "PODIUM").highlights.map((row) => row.driverId), [1, 2, 3]);
  assert.deepEqual(prepareSessionGraphic(session, "GRID").rows.map((row) => row.driverId), [3, 2, 1]);
  session.results[0].status = ResultStatus.Dsq;
  assert.equal(prepareSessionGraphic(session, "FASTEST_LAP").highlights[0].driverId, 1);
  session.results[0].startingPosition = null;
  assert.throws(() => prepareSessionGraphic(session, "GRID"), /GRID_MISSING/);
  session.results.forEach((row) => { row.fastestLapMs = null; });
  assert.throws(() => prepareSessionGraphic(session, "FASTEST_LAP"), /FASTEST_MISSING/);
});

test("qualifying gaps compare only matching stages and missing timing stays missing", () => {
  const session = sessionFixture();
  session.session = ResultSession.Qualifying;
  session.results[0].q3TimeMs = null;
  session.results[0].q2TimeMs = 70000;
  const data = prepareSessionGraphic(session, ResultGraphicType.QualifyingClassification);
  assert.equal(data.rows[0].primary, "1:17.100");
  assert.match(data.rows[0].secondary, /Q3 · \+0.000/);
  assert.match(data.rows[2].secondary, /Q2 · \+0.000/);
  assert.deepEqual(prepareSessionGraphic(session, "FRONT_ROW").highlights.map((row) => row.driverId), [1, 2]);
});

test("drafts and mismatched sessions cannot be exported as published graphics", () => {
  const race = raceFixture();
  assert.throws(() => selectGraphicSession(race, "POLE", 1), /SESSION_NOT_FOUND/);
  assert.throws(() => selectGraphicSession(race, "WINNER", 999), /SESSION_NOT_FOUND/);
  race.sessions[0].publicationStatus = ResultPublicationStatus.Draft;
  assert.throws(() => selectGraphicSession(race, "WINNER", 1), /NOT_PUBLISHED/);
  assert.throws(() => prepareSessionGraphic(race.sessions[0], "WINNER"), /NOT_PUBLISHED/);
});

test("dedicated driver images preserve aspect ratio and transparency", async () => {
  const input = await sharp({ create: { width: 400, height: 1200, channels: 4, background: { r: 255, g: 0, b: 120, alpha: .5 } } }).png().toBuffer();
  const file = new File([new Uint8Array(input)], "render.png", { type: "image/png" });
  const processed = await processDriverImage(file, "result");
  const metadata = await sharp(processed.original).metadata();
  assert.equal(metadata.width, 400);
  assert.equal(metadata.height, 1200);
  assert.equal(metadata.hasAlpha, true);
});

test("render image wins over profile; unavailable render falls back to profile then placeholder", async () => {
  const rows = [
    { teamLogoUrl: "logo", imageUrl: "profile", renderImageUrl: "render" },
    { teamLogoUrl: "logo", imageUrl: "profile", renderImageUrl: "unavailable" },
    { teamLogoUrl: null, imageUrl: null, renderImageUrl: "unavailable" },
  ];
  const calls: string[] = [];
  const hydrated = await hydrateGraphicAssets(rows, async (url) => { calls.push(url); if (url === "unavailable") throw new Error("offline"); return url; });
  assert.deepEqual(hydrated.map((row) => row.imageDataUrl), ["render", "profile", null]);
  assert.deepEqual(hydrated.map((row) => row.imageKind), ["render", "profile", "profile"]);
  assert.equal(calls.filter((url) => url === "logo").length, 1);
});

test("asset loading accepts configured driver storage and blocks foreign origins and oversized streams", async (context) => {
  const oldUrl = process.env.SUPABASE_URL, oldBucket = process.env.SUPABASE_DRIVER_IMAGE_BUCKET;
  process.env.SUPABASE_URL = "https://graphics-test.supabase.co";
  process.env.SUPABASE_DRIVER_IMAGE_BUCKET = "drivers-test";
  const png = await sharp({ create: { width: 8, height: 12, channels: 4, background: "#ff278b" } }).png().toBuffer();
  const fetchMock = context.mock.method(globalThis, "fetch", async () => new Response(new Uint8Array(png), { headers: { "content-type": "image/png" } }));
  try {
    assert.equal(await safeGraphicAssetDataUrl("https://other.example/a.png"), null);
    assert.equal(fetchMock.mock.callCount(), 0);
    assert.match((await safeGraphicAssetDataUrl("https://graphics-test.supabase.co/storage/v1/object/public/drivers-test/drivers/1/result/test.webp"))!, /^data:image\/png;base64,/);
    fetchMock.mock.mockImplementation(async () => new Response(new Uint8Array(4 * 1024 * 1024 + 1), { headers: { "content-type": "image/png" } }));
    assert.equal(await safeGraphicAssetDataUrl("https://graphics-test.supabase.co/storage/v1/object/public/drivers-test/large.png"), null);
  } finally {
    if (oldUrl === undefined) delete process.env.SUPABASE_URL; else process.env.SUPABASE_URL = oldUrl;
    if (oldBucket === undefined) delete process.env.SUPABASE_DRIVER_IMAGE_BUCKET; else process.env.SUPABASE_DRIVER_IMAGE_BUCKET = oldBucket;
  }
});
