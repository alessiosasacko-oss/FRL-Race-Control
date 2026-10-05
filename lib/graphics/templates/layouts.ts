import { graphicTheme as t, text, image, initials, safeColor } from "./primitives";
import type { GraphicDriver, ResultGraphicRenderData } from "./types";

function portrait(driver: GraphicDriver | null, x: number, y: number, w: number, h: number, id: string) {
  const color = safeColor(driver?.teamColor ?? t.cyan);
  return `<defs><clipPath id="${id}"><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="4"/></clipPath></defs>
    <rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.panel}"/>
    <path d="M${x + w * .6} ${y}H${x + w}V${y + h}H${x + w * .15}Z" fill="${color}" opacity=".25"/>
    ${text(x + w - 20, y + 145, String(driver?.number ?? "FRL"), 145, w - 40, color, 900, "end")}
    <g clip-path="url(#${id})">${driver?.imageDataUrl
      ? image(driver.imageDataUrl, x, y + 15, w, h - 15, driver.imageKind === "render" ? "meet" : "slice")
      : `<circle cx="${x + w / 2}" cy="${y + h * .40}" r="${Math.min(w, h) * .17}" fill="#353A4A"/><path d="M${x + w * .1} ${y + h}Q${x + w * .12} ${y + h * .54} ${x + w / 2} ${y + h * .54}Q${x + w * .88} ${y + h * .54} ${x + w * .9} ${y + h}Z" fill="#252A38"/>${text(x + w / 2, y + h * .43, initials(driver?.name ?? "FRL"), 52, w * .5, t.white, 900, "middle")}`}</g>
    <rect x="${x}" y="${y + h - 5}" width="${w}" height="5" fill="${color}"/>`;
}

function driverCaption(driver: GraphicDriver, x: number, y: number, w: number) {
  return `${image(driver.teamLogoDataUrl, x, y, 64, 46)}
    ${text(x + (driver.teamLogoDataUrl ? 78 : 0), y + 32, driver.teamName.toUpperCase(), 23, w - 78, t.muted)}
    ${text(x, y + 88, driver.name.toUpperCase(), 46, w, t.white, 900)}
    ${text(x, y + 130, driver.primary ?? "", 28, w, t.cyan, 800)}`;
}

export function classificationLayout(data: ResultGraphicRenderData, height: number) {
  const rowH = data.rows.length > 22 ? 34 : Math.min(62, Math.floor(724 / Math.max(1, data.rows.length)));
  const firstY = 262;
  const headers = data.columnLabels ?? ["TIME / GAP", "POINTS"];
  const race = data.template === "RACE_CLASSIFICATION";
  const rows = data.rows.map((row, i) => {
    const y = firstY + i * rowH, baseline = y + rowH * .71, fs = Math.min(25, rowH * .59);
    const status = row.status && !["FINISHED", "CLASSIFIED"].includes(row.status) ? row.status : null;
    return `<g class="result-row"><rect x="60" y="${y}" width="1190" height="${rowH - 2}" fill="${i === 0 ? "#262035" : i % 2 ? "#101219" : "#171922"}"/>
      <rect x="60" y="${y}" width="5" height="${rowH - 2}" fill="${safeColor(row.teamColor)}"/>
      ${text(80, baseline, String(row.position).padStart(2, "0"), fs, 55, i === 0 ? t.pink : t.cyan, 900)}
      ${image(row.teamLogoDataUrl, 137, y + 4, 40, rowH - 8)}
      ${text(190, baseline, row.name, fs, race ? 250 : 367)}
      ${text(race ? 455 : 585, baseline, row.teamName, fs - 3, race ? 245 : 230, t.muted, 500)}
      ${race ? `${text(755, baseline, row.grid ?? "—", fs - 2, 40, t.muted, 700, "end")}${text(910, baseline, row.bestLap ?? "—", fs - 2, 135, t.muted, 700, "end")}` : ""}
      ${text(race ? 1085 : 1030, baseline, status ?? row.primary, fs, race ? 155 : 195, status ? t.pink : t.white, 700, "end")}
      ${text(1225, baseline, row.secondary, fs - 2, race ? 120 : 172, t.cyan, 700, "end")}</g>`;
  }).join("");
  const leader = data.leader;
  return `${text(80, 240, "POS", 17, 55, t.muted)}${text(190, 240, "DRIVER", 17, 200, t.muted)}${text(race ? 455 : 585, 240, "TEAM", 17, 230, t.muted)}${race ? `${text(755, 240, "GRID", 17, 40, t.muted, 700, "end")}${text(910, 240, "BEST LAP", 17, 135, t.muted, 700, "end")}` : ""}${text(race ? 1085 : 1030, 240, headers[0], 17, race ? 155 : 195, t.muted, 700, "end")}${text(1225, 240, headers[1], 17, race ? 120 : 172, t.muted, 700, "end")}
    ${rows}
    ${text(1310, 246, data.leaderLabel, 38, 545, t.pink, 900)}
    ${portrait(leader, 1310, 278, 550, Math.min(520, height - 510), "classification-portrait")}
    ${leader ? driverCaption(leader, 1310, Math.min(820, height - 212), 550) : ""}`;
}

export function highlightLayout(data: ResultGraphicRenderData) {
  const drivers = data.highlights ?? (data.leader ? [data.leader] : []);
  if (drivers.length === 1) {
    const driver = drivers[0];
    return `${text(64, 340, data.leaderLabel, 70, 750, t.pink, 900)}
      ${text(64, 490, driver.name.toUpperCase(), 90, 790, t.white, 900)}
      <rect x="64" y="537" width="100" height="6" fill="${safeColor(driver.teamColor)}"/>
      ${image(driver.teamLogoDataUrl, 64, 580, 100, 80)}
      ${text(184, 630, driver.teamName.toUpperCase(), 36, 635, t.muted)}
      ${text(64, 817, driver.primary ?? "", 94, 790, t.cyan, 900)}
      ${text(64, 890, data.subtitle, 24, 780, t.muted)}
      ${portrait(driver, 930, 225, 930, 785, "solo")}`;
  }
  const podium = data.template === "PODIUM";
  const ordered = podium && drivers.length === 3 ? [drivers[1], drivers[0], drivers[2]] : drivers;
  const gap = 28, width = (1800 - gap * (ordered.length - 1)) / Math.max(1, ordered.length);
  return ordered.map((driver, i) => {
    const x = 60 + i * (width + gap), y = podium && driver.position !== 1 ? 310 : 252;
    return `${portrait(driver, x, y, width, 750 - y, `multi-${i}`)}
      <rect x="${x + 20}" y="${y + 20}" width="86" height="68" fill="${driver.position === 1 ? t.pink : t.cyan}"/>
      ${text(x + 63, y + 68, `P${driver.position ?? i + 1}`, 36, 74, t.background, 900, "middle")}
      ${driverCaption(driver, x, 775, width)}`;
  }).join("");
}

export function gridLayout(data: ResultGraphicRenderData) {
  const columns = 4, w = 429, h = 136, gap = 28;
  return data.rows.map((row, index) => {
    const col = index % columns, line = Math.floor(index / columns), x = 60 + col * (w + gap), y = 238 + line * (h + 16) + (col % 2 ? 18 : 0);
    return `<g class="result-row"><rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${t.panel}"/>
      <rect x="${x}" y="${y}" width="5" height="${h}" fill="${safeColor(row.teamColor)}"/>
      ${row.imageDataUrl ? image(row.imageDataUrl, x + 312, y + 5, 112, 126) : text(x + 368, y + 85, initials(row.name), 34, 102, t.muted, 900, "middle")}
      ${text(x + 20, y + 40, String(row.position).padStart(2, "0"), 34, 70, t.pink, 900)}
      ${image(row.teamLogoDataUrl, x + 243, y + 12, 44, 30)}
      ${text(x + 20, y + 78, row.name, 24, 276, t.white, 900)}
      ${text(x + 20, y + 108, row.teamName, 17, 276, t.muted, 500)}</g>`;
  }).join("");
}
