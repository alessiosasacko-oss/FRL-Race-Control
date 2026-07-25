import "server-only";
import { EmbedBuilder, type HexColorString } from "discord.js";
import type { DiscordMessagePayload } from "./types";

function absoluteUrl(href: string): string {
  return new URL(
    href,
    process.env.AUTH_URL ?? "http://localhost:3000",
  ).toString();
}

export function buildDiscordEmbed(payload: DiscordMessagePayload) {
  const embed = new EmbedBuilder()
    .setAuthor({
      name: "FRL Race Control",
      iconURL: absoluteUrl("/images/frl-logo.png"),
    })
    .setTitle(payload.title)
    .setDescription(payload.description)
    .setColor((payload.color ?? "#2563EB") as HexColorString)
    .setTimestamp()
    .setFooter({ text: "FRL Race Control" });

  if (payload.href) embed.setURL(absoluteUrl(payload.href));
  if (payload.iconUrl) embed.setThumbnail(payload.iconUrl);

  const contextFields = [
    payload.league
      ? { name: "Liga", value: payload.league, inline: true }
      : null,
    payload.season
      ? { name: "Saison", value: payload.season, inline: true }
      : null,
    payload.race
      ? { name: "Rennen", value: payload.race, inline: true }
      : null,
    payload.track
      ? { name: "Strecke", value: payload.track, inline: true }
      : null,
  ].filter((field) => field !== null);

  embed.addFields(...contextFields, ...(payload.fields ?? []));
  return embed;
}
