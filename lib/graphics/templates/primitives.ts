export const graphicTheme = {
  background: "#08090D", panel: "#13151C", muted: "#A8ADBC", white: "#F9FAFF",
  pink: "#FF278B", cyan: "#38E8E1", line: "#30333F", font: "DejaVu Sans, Arial, sans-serif",
} as const;

export function escapeXml(value: string): string {
  return value.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[c]!);
}
export function safeColor(value: string) { return /^#[0-9a-f]{6}$/i.test(value) ? value : graphicTheme.cyan; }

// Conservative glyph widths keep user-provided names inside their own column.
export function text(x: number, y: number, value: string, size: number, width: number, color: string = graphicTheme.white, weight = 700, anchor = "start") {
  const units = Array.from(value).reduce((sum, c) => sum + (/[MW@%]/.test(c) ? 1 : /[ilI .,:;'!]/.test(c) ? .34 : .7), 0);
  const fitted = Math.min(size, width / Math.max(units, 1));
  return `<text x="${x}" y="${y}" font-family="${graphicTheme.font}" font-size="${fitted}" font-weight="${weight}" fill="${color}" text-anchor="${anchor}">${escapeXml(value)}</text>`;
}
export function image(url: string | null | undefined, x: number, y: number, width: number, height: number, fit = "meet") {
  if (!url || !/^data:image\/(png|webp|jpeg);base64,[A-Za-z0-9+/=]+$/.test(url)) return "";
  return `<image href="${url}" x="${x}" y="${y}" width="${width}" height="${height}" preserveAspectRatio="xMidYMid ${fit}"/>`;
}
export function initials(name: string) { return name.trim().split(/\s+/u).slice(0, 2).map((word) => Array.from(word)[0] ?? "").join("").toUpperCase() || "FRL"; }
