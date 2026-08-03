import sharp from "sharp";

export const RESULT_GRAPHIC_WIDTH = 1920;
export const RESULT_GRAPHIC_HEIGHT = 1080;
export const RESULT_GRAPHIC_MAX_BYTES = 8 * 1024 * 1024;
export const RESULT_GRAPHIC_RENDERING_VERSION = 1;

export type GraphicDriver = {
  name: string;
  number: number;
  teamName: string;
  teamColor: string;
  teamLogoDataUrl: string | null;
  character: unknown;
};

export type ResultGraphicRenderData = {
  title: string;
  subtitle: string;
  leagueCode: string;
  seasonName: string;
  raceName: string;
  formatLabel?: string | null;
  draft?: boolean;
  frlLogoDataUrl: string | null;
  leaderLabel: "POLE" | "WINNER" | "LEADER" | "LEADERS";
  leader: GraphicDriver | null;
  rows: Array<{
    position: number;
    name: string;
    teamName: string;
    teamColor: string;
    teamLogoDataUrl: string | null;
    primary: string;
    secondary: string;
    status?: string | null;
  }>;
};

function escape(value: string): string {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&apos;" })[character] ?? character);
}

function safeColor(value: string): string {
  return /^#[0-9a-f]{6}$/i.test(value) ? value : "#168BFF";
}

function characterPalette(configuration: unknown) {
  const record = configuration && typeof configuration === "object" ? configuration as Record<string, unknown> : {};
  return {
    skin: typeof record.skinTone === "string" && /^#[0-9a-f]{6}$/i.test(record.skinTone) ? record.skinTone : "#C98F65",
    hair: typeof record.hairColor === "string" && /^#[0-9a-f]{6}$/i.test(record.hairColor) ? record.hairColor : "#201A18",
  };
}

function leaderPortrait(leader: GraphicDriver | null): string {
  if (!leader) return `<g opacity=".55"><circle cx="1560" cy="410" r="120" fill="#253141"/><path d="M1340 870 Q1360 560 1560 560 Q1760 560 1780 870Z" fill="#1C2837"/></g>`;
  const palette = characterPalette(leader.character);
  const color = safeColor(leader.teamColor);
  return `<g>
    <text x="1815" y="360" text-anchor="end" font-family="Arial" font-size="270" font-weight="900" fill="#ffffff0a">${leader.number}</text>
    <ellipse cx="1560" cy="900" rx="235" ry="40" fill="#000" opacity=".5"/>
    <path d="M1325 900 Q1335 590 1445 550 L1675 550 Q1785 590 1795 900Z" fill="${color}"/>
    <path d="M1395 900 L1430 620 L1690 620 L1725 900Z" fill="#081321" opacity=".48"/>
    <circle cx="1560" cy="430" r="126" fill="${palette.skin}"/>
    <path d="M1437 420 Q1445 274 1560 284 Q1685 275 1686 430 Q1620 350 1437 420Z" fill="${palette.hair}"/>
    <path d="M1505 438 Q1530 425 1545 438 M1575 438 Q1600 425 1615 438" stroke="#131313" stroke-width="10" fill="none" stroke-linecap="round"/>
    <path d="M1522 500 Q1560 526 1598 500" stroke="#7b4238" stroke-width="9" fill="none" stroke-linecap="round"/>
    <rect x="1455" y="640" width="210" height="74" rx="18" fill="#07111f" opacity=".75"/>
    ${leader.teamLogoDataUrl ? `<image href="${leader.teamLogoDataUrl}" x="1493" y="650" width="134" height="54" preserveAspectRatio="xMidYMid meet"/>` : `<text x="1560" y="687" text-anchor="middle" font-family="Arial" font-size="30" font-weight="900" fill="#fff">${escape(leader.teamName.slice(0, 3).toUpperCase())}</text>`}
  </g>`;
}

export function resultGraphicSvg(data: ResultGraphicRenderData): string {
  const rowCount = Math.max(1, data.rows.length);
  const rowHeight = Math.max(23, Math.min(38, Math.floor(790 / rowCount)));
  const fontSize = Math.max(17, Math.min(25, rowHeight - 9));
  const rows = data.rows.map((row, index) => {
    const y = 226 + index * rowHeight;
    const color = safeColor(row.teamColor);
    const statusColor = row.status === "DSQ" ? "#F87171" : row.status === "DNF" || row.status === "DNS" ? "#FB923C" : "#DDE7F3";
    const primary = row.status && row.status !== "FINISHED" ? row.status : row.primary;
    return `<g class="result-row">
      <rect x="74" y="${y}" width="1110" height="${rowHeight - 2}" rx="6" fill="${index % 2 ? "#0d141d" : "#111b27"}"/>
      <rect x="74" y="${y}" width="5" height="${rowHeight - 2}" fill="${color}"/>
      <text x="104" y="${y + rowHeight * .7}" font-family="Arial" font-size="${fontSize}" font-weight="900" fill="${row.position === 1 ? "#F5C451" : "#79BFFF"}">${row.position.toString().padStart(2, "0")}</text>
      ${row.teamLogoDataUrl ? `<image href="${row.teamLogoDataUrl}" x="154" y="${y + 3}" width="${rowHeight - 8}" height="${rowHeight - 8}" preserveAspectRatio="xMidYMid meet"/>` : `<circle cx="${170 + rowHeight / 2}" cy="${y + rowHeight / 2}" r="${Math.max(7, rowHeight / 4)}" fill="${color}"/>`}
      <text x="210" y="${y + rowHeight * .68}" font-family="Arial" font-size="${fontSize}" font-weight="800" fill="#F7FAFC">${escape(row.name.slice(0, 30))}</text>
      <text x="590" y="${y + rowHeight * .68}" font-family="Arial" font-size="${fontSize - 2}" fill="#91A0B3">${escape(row.teamName.slice(0, 22))}</text>
      <text x="935" y="${y + rowHeight * .68}" text-anchor="end" font-family="Arial" font-size="${fontSize}" font-weight="800" fill="${statusColor}">${escape(primary)}</text>
      <text x="1150" y="${y + rowHeight * .68}" text-anchor="end" font-family="Arial" font-size="${fontSize - 2}" fill="#7F91A8">${escape(row.secondary)}</text>
    </g>`;
  }).join("");
  const leader = data.leader;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${RESULT_GRAPHIC_WIDTH}" height="${RESULT_GRAPHIC_HEIGHT}" viewBox="0 0 ${RESULT_GRAPHIC_WIDTH} ${RESULT_GRAPHIC_HEIGHT}">
    <defs><pattern id="diag" width="90" height="90" patternUnits="userSpaceOnUse" patternTransform="rotate(28)"><rect width="44" height="90" fill="#ffffff" opacity=".018"/></pattern><linearGradient id="leaderBg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#142238"/><stop offset="1" stop-color="#070b11"/></linearGradient></defs>
    <rect width="1920" height="1080" fill="#05080d"/><rect width="1920" height="1080" fill="url(#diag)"/>
    <path d="M1210 0H1920V1080H1120Z" fill="url(#leaderBg)"/><path d="M1198 0H1222L1132 1080H1108Z" fill="#10A8FF"/>
    ${data.frlLogoDataUrl ? `<image href="${data.frlLogoDataUrl}" x="70" y="42" width="120" height="62" preserveAspectRatio="xMidYMid meet"/>` : ""}
    <text x="215" y="72" font-family="Arial" font-size="24" font-weight="900" fill="#8CCEFF" letter-spacing="4">FRL RACE CONTROL</text>
    <text x="72" y="144" font-family="Arial" font-size="58" font-weight="900" fill="#FFF">${escape(data.title)}</text>
    <text x="74" y="184" font-family="Arial" font-size="23" font-weight="700" fill="#8292A6">${escape(`${data.leagueCode} · ${data.seasonName} · ${data.raceName}${data.formatLabel ? ` · ${data.formatLabel}` : ""}`)}</text>
    <rect x="74" y="202" width="1110" height="4" fill="#10A8FF"/>
    ${rows}
    <text x="1560" y="110" text-anchor="middle" font-family="Arial" font-size="27" font-weight="900" fill="#10A8FF" letter-spacing="5">${data.leaderLabel}</text>
    ${leaderPortrait(leader)}
    <text x="1560" y="958" text-anchor="middle" font-family="Arial" font-size="44" font-weight="900" fill="#FFF">${escape(leader?.name ?? "FRL")}</text>
    <text x="1560" y="1000" text-anchor="middle" font-family="Arial" font-size="24" font-weight="700" fill="${safeColor(leader?.teamColor ?? "#168BFF")}">${escape(leader?.teamName ?? "Race Control")}</text>
    <text x="74" y="1040" font-family="Arial" font-size="18" fill="#536176">OFFICIAL FRL DATA · RENDERING v${RESULT_GRAPHIC_RENDERING_VERSION}</text>
    ${data.draft ? `<g transform="rotate(-18 960 540)"><text x="960" y="570" text-anchor="middle" font-family="Arial" font-size="180" font-weight="900" fill="#ffffff18">ENTWURF</text></g>` : ""}
  </svg>`;
}

export async function renderResultGraphicPng(data: ResultGraphicRenderData): Promise<Buffer> {
  const png = await sharp(Buffer.from(resultGraphicSvg(data)))
    .png({ compressionLevel: 9, adaptiveFiltering: true, palette: true, quality: 92 })
    .toBuffer();
  if (png.length > RESULT_GRAPHIC_MAX_BYTES) throw new Error("RESULT_GRAPHIC_TOO_LARGE");
  return png;
}
