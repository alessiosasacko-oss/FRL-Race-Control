import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";
import opentype, { type Font } from "opentype.js";

const fonts = new Map<string, Font>();

/** Bundled OFL fonts, never OS fonts, fontconfig, CSS or a runtime HTTP request. */
function loadFont(filename: string): Font {
  let font = fonts.get(filename);
  if (!font) {
    const bytes = readFileSync(path.join(process.cwd(), "assets", "graphics", "fonts", filename));
    font = opentype.parse(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength));
    fonts.set(filename, font);
  }
  return font;
}

export function graphicsFont(weight: number, value = ""): Font {
  const primary = loadFont(weight >= 800 ? "Barlow-Black.ttf" : weight >= 600 ? "Barlow-Bold.ttf" : "Barlow-Regular.ttf");
  // Keep each run in one font so kerning and baselines remain consistent.
  return [...value].every((character) => primary.charToGlyphIndex(character))
    ? primary : loadFont(weight >= 600 ? "NotoSans-Bold.ttf" : "NotoSans-Regular.ttf");
}

export function outlineGraphicText(value: string, x: number, y: number, size: number, width: number, weight: number, anchor: string) {
  const normalized = value.normalize("NFC").replace(/[\u0000-\u001F\u007F]/g, " ");
  const font = graphicsFont(weight, normalized);
  for (const character of normalized) {
    if (!font.charToGlyphIndex(character)) throw new Error("RESULT_GRAPHIC_UNSUPPORTED_GLYPH");
  }
  const bounds = font.getPath(normalized, 0, 0, 1, { kerning: true }).getBoundingBox();
  const fittedSize = Math.min(size, width / Math.max(bounds.x2 - bounds.x1, .001));
  const origin = anchor === "end" ? x - bounds.x2 * fittedSize
    : anchor === "middle" ? x - (bounds.x1 + bounds.x2) * fittedSize / 2 : x - bounds.x1 * fittedSize;
  const outline = font.getPath(normalized, origin, y, fittedSize, { kerning: true });
  return { path: outline.toPathData(2), bounds: outline.getBoundingBox(), size: fittedSize, value: normalized };
}
