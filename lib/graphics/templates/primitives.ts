import { outlineGraphicText } from "../fonts";

export const graphicTheme = {
  background: "#08090D", panel: "#13151C", muted: "#A8ADBC", white: "#F9FAFF",
  pink: "#FF278B", cyan: "#38E8E1", line: "#30333F",
} as const;

export function escapeXml(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}
export function safeColor(value: string) { return /^#[0-9a-f]{6}$/i.test(value) ? value : graphicTheme.cyan; }

// Exact font outlines remove every runtime font dependency from the SVG.
export function text(x: number, y: number, value: string, size: number, width: number, color: string = graphicTheme.white, weight = 700, anchor = "start") {
  if (!value.trim()) return "";
  const outline = outlineGraphicText(value, x, y, size, width, weight, anchor);
  return `<g aria-label="${escapeXml(outline.value)}"><path fill="${color}" d="${outline.path}"/></g>`;
}
export function image(url: string | null | undefined, x: number, y: number, width: number, height: number, fit = "meet") {
  if (!url || !/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(url)) return "";
  return `<image href="${url}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid ${fit}"/>`;
}
export function initials(name: string) { return name.trim().split(/\s+/u).slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("").toUpperCase() || "FRL"; }
