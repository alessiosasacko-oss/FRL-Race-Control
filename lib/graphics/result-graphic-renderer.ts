import sharp from "sharp";
import { graphicTemplates } from "./templates/catalog";
import { classificationLayout, gridLayout, highlightLayout } from "./templates/layouts";
import { graphicTheme as t, text, image } from "./templates/primitives";
import type { ResultGraphicRenderData } from "./templates/types";
export type { GraphicDriver, ResultGraphicRenderData } from "./templates/types";

export const RESULT_GRAPHIC_WIDTH = 1920;
export const RESULT_GRAPHIC_HEIGHT = 1080;
export const RESULT_GRAPHIC_MAX_BYTES = 8 * 1024 * 1024;
export const RESULT_GRAPHIC_RENDERING_VERSION = 3;

export function resultGraphicDimensions(data: ResultGraphicRenderData) {
  const grid = data.template === "GRID";
  const highlight = data.template && graphicTemplates[data.template].layout !== "classification" && !grid;
  const height = grid
    ? Math.max(1080, 340 + Math.ceil(data.rows.length / 4) * 152)
    : highlight ? 1080 : Math.max(1080, 342 + data.rows.length * 34);
  if (height > 8192) throw new Error("RESULT_GRAPHIC_TOO_MANY_ROWS");
  return { width: RESULT_GRAPHIC_WIDTH, height };
}

export function resultGraphicSvg(data: ResultGraphicRenderData): string {
  const { width, height } = resultGraphicDimensions(data);
  const layout = data.template ? graphicTemplates[data.template].layout : "classification";
  const context = [data.leagueCode, data.seasonName, data.round ? `ROUND ${String(data.round).padStart(2, "0")}` : null, data.raceName, data.circuit && data.circuit !== data.raceName ? data.circuit : null, data.sessionLabel, data.formatLabel].filter(Boolean).join("  /  ");
  const content = layout === "classification" ? classificationLayout(data, height)
    : layout === "grid" ? gridLayout(data) : highlightLayout(data);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <defs><linearGradient id="glow" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#301024"/><stop offset=".5" stop-color="#08090D"/><stop offset="1" stop-color="#0B3335"/></linearGradient></defs>
    <rect width="${width}" height="${height}" fill="${t.background}"/>
    <rect width="${width}" height="${height}" fill="url(#glow)"/>
    <path d="M1490 0H1710L1240 ${height}H1020Z" fill="#fff" opacity=".022"/>
    <rect width="1250" height="8" fill="${t.pink}"/><rect x="1250" width="670" height="8" fill="${t.cyan}"/>
    ${image(data.frlLogoDataUrl, 60, 35, 116, 54)}
    ${text(data.frlLogoDataUrl ? 198 : 60, 73, "FRL RACE CONTROL", 23, 650, t.cyan, 900)}
    ${text(1860, 73, data.draft ? "ENTWURF" : "OFFICIAL RESULTS", 20, 450, t.muted, 700, "end")}
    ${text(60, 164, data.title.toUpperCase(), 70, 1800, t.white, 900)}
    ${text(60, 207, context, 24, 1800, t.muted, 500)}
    ${content}
    <rect x="60" y="${height - 54}" width="1800" height="1" fill="${t.line}"/>
    ${text(60, height - 23, "F1 REALISTIC LEAGUE", 16, 700, t.muted)}
    ${text(1860, height - 23, data.raceName.toUpperCase(), 16, 1000, t.cyan, 700, "end")}
    ${data.draft ? `<g opacity=".25" transform="rotate(-18 960 540)">${text(960, 590, "ENTWURF", 170, 1700, t.white, 900, "middle")}</g>` : ""}
  </svg>`;
}

export async function renderResultGraphicPng(data: ResultGraphicRenderData): Promise<Buffer> {
  const png = await sharp(Buffer.from(resultGraphicSvg(data)))
    .png({ compressionLevel: 9, adaptiveFiltering: true })
    .toBuffer();
  if (png.length > RESULT_GRAPHIC_MAX_BYTES) throw new Error("RESULT_GRAPHIC_TOO_LARGE");
  return png;
}
