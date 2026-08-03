import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { DiscordChannelPurpose } from "@/domain";
import {
  buildLeagueChannelMatrixRows,
  groupSelectableChannels,
  resultChannelPurposes,
  searchDiscordChannels,
  standingsChannelPurposes,
  suggestLeagueChannel,
  type DiscordChannelOption,
} from "./channel-matrix";

const channels: DiscordChannelOption[] = [
  { id: "11111111111111111", name: "f1-ergebnisse", categoryId: "1", categoryName: "ERGEBNISSE", kind: "TEXT", visible: true, canSend: true, canAttach: true, selectable: true, unavailableReason: null },
  { id: "22222222222222222", name: "f1-tabellen", categoryId: "2", categoryName: "TABELLEN", kind: "ANNOUNCEMENT", visible: true, canSend: true, canAttach: true, selectable: true, unavailableReason: null },
  { id: "33333333333333333", name: "f2-results", categoryId: "1", categoryName: "ERGEBNISSE", kind: "TEXT", visible: true, canSend: true, canAttach: false, selectable: false, unavailableReason: "Anhänge fehlen" },
  { id: "44444444444444444", name: "sprache", categoryId: null, categoryName: "SONSTIGES", kind: "UNSUPPORTED", visible: true, canSend: false, canAttach: false, selectable: false, unavailableReason: "Nicht unterstützt" },
  { id: "55555555555555555", name: "unsichtbar", categoryId: null, categoryName: "SONSTIGES", kind: "TEXT", visible: false, canSend: false, canAttach: false, selectable: false, unavailableReason: "Unsichtbar" },
];

test("result and standings selections expand to exactly five purposes", () => {
  assert.deepEqual(resultChannelPurposes, [DiscordChannelPurpose.QualifyingResults, DiscordChannelPurpose.RaceResults, DiscordChannelPurpose.SprintResults]);
  assert.deepEqual(standingsChannelPurposes, [DiscordChannelPurpose.DriverStandings, DiscordChannelPurpose.TeamStandings]);
});

test("only visible text and announcement channels are grouped as targets", () => {
  const grouped = groupSelectableChannels(channels);
  const ids = grouped.flatMap((group) => group.channels.map((channel) => channel.id));
  assert.deepEqual(ids.sort(), ["11111111111111111", "22222222222222222", "33333333333333333"]);
  assert.ok(!ids.includes("44444444444444444"));
  assert.ok(!ids.includes("55555555555555555"));
});

test("channel search covers name, category and technical id", () => {
  assert.equal(searchDiscordChannels(channels, "tabellen").length, 1);
  assert.equal(searchDiscordChannels(channels, "ERGEBNISSE").length, 2);
  assert.equal(searchDiscordChannels(channels, "222222")[0]?.name, "f1-tabellen");
});

test("existing unified mappings are preselected and cross-league mappings stay isolated", () => {
  const mappings = [
    ...resultChannelPurposes.map((purpose) => ({ leagueId: 1, purpose, channelId: channels[0].id, enabled: true })),
    ...standingsChannelPurposes.map((purpose) => ({ leagueId: 1, purpose, channelId: channels[1].id, enabled: true })),
    ...resultChannelPurposes.map((purpose) => ({ leagueId: 2, purpose, channelId: "99999999999999999", enabled: true })),
  ];
  const rows = buildLeagueChannelMatrixRows([{ id: 1, code: "F1", name: "Formula 1" }, { id: 2, code: "F2", name: "Formula 2" }], mappings, channels);
  assert.equal(rows[0].resultChannelId, channels[0].id);
  assert.equal(rows[0].standingsChannelId, channels[1].id);
  assert.equal(rows[1].resultChannelId, "99999999999999999");
});

test("inconsistent mappings are detected without silently choosing one", () => {
  const rows = buildLeagueChannelMatrixRows([{ id: 1, code: "F1", name: "F1" }], [
    { leagueId: 1, purpose: DiscordChannelPurpose.QualifyingResults, channelId: channels[0].id, enabled: true },
    { leagueId: 1, purpose: DiscordChannelPurpose.RaceResults, channelId: channels[1].id, enabled: true },
  ], channels);
  assert.equal(rows[0].resultChannelId, null);
  assert.equal(rows[0].resultInconsistent, true);
});

test("automatic suggestions are returned separately and never stored", () => {
  assert.equal(suggestLeagueChannel(channels, "F1", "RESULT"), channels[0].id);
  const row = buildLeagueChannelMatrixRows([{ id: 1, code: "F1", name: "F1" }], [], channels)[0];
  assert.equal(row.resultChannelId, null);
  assert.equal(row.suggestedResultChannelId, channels[0].id);
});

test("all six FRL leagues remain visible", () => {
  const leagues = Array.from({ length: 6 }, (_, index) => ({ id: index + 1, code: `F${index + 1}`, name: `Liga F${index + 1}` }));
  assert.equal(buildLeagueChannelMatrixRows(leagues, [], channels).length, 6);
});

test("channel loading and matrix writes remain server-side and permission protected", () => {
  const server = readFileSync("lib/discord/channels.ts", "utf8");
  const actions = readFileSync("lib/automation/actions.ts", "utf8");
  const client = readFileSync("components/automation/DiscordChannelMatrix.tsx", "utf8");
  assert.match(server, /import "server-only"/);
  assert.match(server, /PermissionFlagsBits\.ViewChannel/);
  assert.match(server, /PermissionFlagsBits\.SendMessages/);
  assert.match(server, /PermissionFlagsBits\.AttachFiles/);
  assert.match(actions, /requirePermission\(Permission\.ManageAutomation\)/);
  assert.match(actions, /discordChannelMapping\.upsert/);
  assert.match(actions, /discordChannelMapping\.updateMany/);
  assert.doesNotMatch(actions, /discordChannelMapping\.deleteMany/);
  assert.doesNotMatch(client, /DISCORD_BOT_TOKEN/);
});

test("test messages are isolated from official results and the matrix is mobile-safe", () => {
  const service = readFileSync("lib/discord/channel-test.ts", "utf8");
  const client = readFileSync("components/automation/DiscordChannelMatrix.tsx", "utf8");
  assert.match(service, /TEST ERFOLGREICH/);
  assert.doesNotMatch(service, /createNotifications|resultGraphic|recalculateChampionship/);
  assert.match(client, /lg:hidden/);
  assert.match(client, /hidden lg:block/);
  assert.match(client, /min-h-11/);
  assert.match(client, /beforeunload/);
});
