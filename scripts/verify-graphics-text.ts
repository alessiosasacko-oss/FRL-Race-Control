/** Offline renderer verification: real production data preparation, labelled test inputs. */
import assert from "node:assert/strict";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import sharp from "sharp";
import { ResultGraphicType } from "../domain/enums";
import { preparedTextGraphic } from "../lib/graphics/testing/text-render-fixtures";
import { renderResultGraphicPng, resultGraphicSvg } from "../lib/graphics/result-graphic-renderer";
import { text } from "../lib/graphics/templates/primitives";

const directory = await mkdtemp(path.join(tmpdir(), "frl-text-render-"));
const tiles: Buffer[] = [];
for (const type of [ResultGraphicType.QualifyingClassification, ResultGraphicType.RaceClassification, "POLE", "PODIUM"] as const) {
  const data = await preparedTextGraphic(type);
  data.raceName += " · TEST RENDER";
  const svg = resultGraphicSvg(data);
  assert.doesNotMatch(svg, /<text\b|font-family/);
  const png = await renderResultGraphicPng(data);
  await writeFile(path.join(directory, `${type}.png`), png);
  tiles.push(await sharp(png).resize(960, 540).toBuffer());
}
const glyphs = '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="400"><rect width="1600" height="400" fill="#08090D"/>'
  + ["Patrick Mahomes · AMD Mercedes F1 Team", "1:17.828  +0.201  Season 7  Melbourne Grand Prix", "ä ö ü ß é ø Ä Ö Ü ẞ É Ø  O’Neill O'Neill - – —"].map((line, i) => text(40, 85 + i * 115, line, 58, 1520, "#FFFFFF", [400, 700, 900][i])).join("") + "</svg>";
await sharp(Buffer.from(glyphs)).png().toFile(path.join(directory, "special-characters.png"));
await sharp({ create: { width: 1920, height: 1080, channels: 3, background: "#08090D" } }).composite(tiles.map((input, i) => ({ input, left: i % 2 * 960, top: Math.floor(i / 2) * 540 }))).png().toFile(path.join(directory, "contact-sheet.png"));
console.log(directory);
