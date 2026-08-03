import "server-only";

import sharp from "sharp";
import { logger } from "@/lib/observability/logger";
import { getConnectedDiscordClient } from "./client";
import { requireSelectableDiscordChannel } from "./channels";

export type DiscordChannelTestKind = "RESULT" | "STANDINGS";

function escapeXml(value: string): string {
  return value.replace(/[&<>'"]/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&apos;",
    '"': "&quot;",
  })[character] ?? character);
}

export async function renderDiscordChannelTestGraphic(
  leagueCode: string,
  kind: DiscordChannelTestKind,
): Promise<Buffer> {
  const heading = kind === "RESULT" ? "ERGEBNISSE" : "FAHRER-WM & TEAM-WM";
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="540" viewBox="0 0 960 540">
    <defs><linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#07111f"/><stop offset="1" stop-color="#02060b"/></linearGradient><pattern id="p" width="56" height="56" patternUnits="userSpaceOnUse" patternTransform="rotate(25)"><rect width="24" height="56" fill="#ffffff" opacity=".025"/></pattern></defs>
    <rect width="960" height="540" fill="url(#bg)"/><rect width="960" height="540" fill="url(#p)"/>
    <path d="M0 0H18V540H0Z" fill="#12A8FF"/><path d="M620 0H645L590 540H565Z" fill="#12A8FF" opacity=".8"/>
    <text x="70" y="90" font-family="Arial" font-size="30" font-weight="900" fill="#8CCEFF" letter-spacing="5">FRL RACE CONTROL</text>
    <text x="70" y="235" font-family="Arial" font-size="118" font-weight="900" fill="#FFFFFF">${escapeXml(leagueCode)}</text>
    <text x="70" y="310" font-family="Arial" font-size="45" font-weight="900" fill="#12A8FF">${escapeXml(heading)}</text>
    <text x="70" y="410" font-family="Arial" font-size="34" font-weight="700" fill="#D7E4F2">TEST ERFOLGREICH</text>
    <circle cx="780" cy="270" r="104" fill="#0D2136" stroke="#12A8FF" stroke-width="8"/><path d="M730 270L768 308L838 226" fill="none" stroke="#60E6A8" stroke-width="18" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
  return sharp(Buffer.from(svg)).png({ compressionLevel: 9 }).toBuffer();
}

export async function sendDiscordChannelTest(input: {
  guildId: string;
  channelId: string;
  leagueCode: string;
  kind: DiscordChannelTestKind;
}): Promise<{ channelName: string; messageId: string }> {
  const { catalog, channel: option } = await requireSelectableDiscordChannel(
    input.guildId,
    input.channelId,
    { force: true },
  );
  const client = await getConnectedDiscordClient();
  const guild = await client.guilds.fetch(catalog.guildId);
  const channel = await guild.channels.fetch(option.id);
  if (!channel || !("send" in channel)) {
    throw new Error("Der gewählte Kanal ist kein unterstützter Textkanal.");
  }
  const label = input.kind === "RESULT" ? "Ergebnis-Channel" : "Tabellen-Channel";
  try {
    const message = await channel.send({
      content: `FRL Race Control · ${input.leagueCode} ${label} erfolgreich verbunden.`,
      files: [{
        attachment: await renderDiscordChannelTestGraphic(input.leagueCode, input.kind),
        name: `frl-${input.leagueCode.toLowerCase()}-${input.kind.toLowerCase()}-test.png`,
      }],
    });
    return { channelName: option.name, messageId: message.id };
  } catch (error: unknown) {
    logger.error("Discord channel test failed", error, {
      phase: "channel-test",
      leagueCode: input.leagueCode,
      kind: input.kind,
    });
    throw new Error("Die Discord-Testnachricht konnte nicht gesendet werden.");
  }
}
