/** Local design diagnostics, using explicitly labelled synthetic data. No DB/storage access. */
import { mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { renderResultGraphicPng } from "../lib/graphics/result-graphic-renderer";
import { graphicTemplates, type GraphicTemplate } from "../lib/graphics/templates/catalog";
import { graphicFixture } from "../lib/graphics/testing/fixtures";

const directory = await mkdtemp(path.join(tmpdir(), "frl-graphics-review-"));
const logo = `data:image/png;base64,${(await readFile("public/images/frl-logo.png")).toString("base64")}`;
const tiles: Buffer[] = [];
for (const template of Object.keys(graphicTemplates) as GraphicTemplate[]) {
  const data = graphicFixture(20);
  data.template = template;
  data.title = graphicTemplates[template].label;
  data.frlLogoDataUrl = logo;
  data.highlights = data.highlights!.slice(0, template === "PODIUM" ? 3 : template === "FRONT_ROW" ? 2 : 1);
  data.leaderLabel = template === "FASTEST_LAP" ? "FASTEST LAP" : ["POLE", "FRONT_ROW", "QUALIFYING_CLASSIFICATION"].includes(template) ? "POLE" : "WINNER";
  const png = await renderResultGraphicPng(data);
  await writeFile(path.join(directory, `${template}.png`), png);
  tiles.push(await sharp(png).resize({ width: 640, height: 380, fit: "contain", background: "#08090d" }).png().toBuffer());
}
await sharp({ create: { width: 1280, height: Math.ceil(tiles.length / 2) * 380, channels: 3, background: "#08090d" } }).composite(tiles.map((input, index) => ({ input, left: index % 2 * 640, top: Math.floor(index / 2) * 380 }))).png().toFile(path.join(directory, "contact-sheet.png"));
console.log(directory);
