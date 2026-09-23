import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { FinanceTransactionType, ResultStatus, Role } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { renderFinanceTemplate } from "./discord";
import {
  DEFAULT_FINANCE_RULES,
  amountForPoints,
  damageFees,
  reconciliationDelta,
  resultStatusFee,
  rewardForPosition,
  roundBasisPoints,
} from "./rules";
import { financePublishSettingSchema, manualFinanceTransactionSchema } from "./schemas";

const source = (name: string) => readFileSync(new URL(name, import.meta.url), "utf8");

test("default start balance is 100 million euro", () => {
  assert.equal(DEFAULT_FINANCE_RULES.defaultStartBalanceEuro, BigInt(100_000_000));
});

test("P1 through P12 race rewards match the FRL schedule", () => {
  assert.deepEqual(DEFAULT_FINANCE_RULES.positionRewards.map((entry) => Number(entry.amountEuro)), [4_500_000, 4_000_000, 3_750_000, 3_250_000, 2_750_000, 2_500_000, 2_250_000, 2_000_000, 1_750_000, 1_500_000, 1_000_000, 850_000]);
});

test("positions outside P12 receive no reward", () => {
  assert.equal(rewardForPosition(13, DEFAULT_FINANCE_RULES.positionRewards), BigInt(0));
  assert.equal(rewardForPosition(null, DEFAULT_FINANCE_RULES.positionRewards), BigInt(0));
});

test("pole and fastest lap defaults are configured centrally", () => {
  assert.equal(DEFAULT_FINANCE_RULES.poleRewardEuro, BigInt(2_000_000));
  assert.equal(DEFAULT_FINANCE_RULES.fastestLapRewardEuro, BigInt(500_000));
});

test("fastest lap requires top 12 in reconciliation", () => {
  const reconciliation = source("./reconciliation.ts");
  assert.match(reconciliation, /result\.fastestLap && result\.finalPosition && result\.finalPosition <= 12/);
});

test("DNF, DSQ, and pit retirement are mutually selected status fees", () => {
  assert.equal(resultStatusFee(ResultStatus.Dnf, DEFAULT_FINANCE_RULES)?.amountEuro, BigInt(3_000_000));
  assert.equal(resultStatusFee(ResultStatus.Dsq, DEFAULT_FINANCE_RULES)?.amountEuro, BigInt(5_000_000));
  assert.equal(resultStatusFee(ResultStatus.Retired, DEFAULT_FINANCE_RULES)?.amountEuro, BigInt(6_000_000));
  assert.equal(resultStatusFee(ResultStatus.Finished, DEFAULT_FINANCE_RULES), null);
});

test("each physical damage has the requested default", () => {
  const fees = damageFees({ frontWingDamage: true, underfloorDamage: true, sidepodDamage: true, rearWingDamage: true }, DEFAULT_FINANCE_RULES);
  assert.deepEqual(fees.map((fee) => Number(fee.amountEuro)), [500_000, 1_000_000, 1_000_000, 1_000_000]);
});

test("multiple physical damages add up", () => {
  const total = damageFees({ frontWingDamage: true, underfloorDamage: true, sidepodDamage: false, rearWingDamage: false }, DEFAULT_FINANCE_RULES).reduce((sum, fee) => sum + fee.amountEuro, BigInt(0));
  assert.equal(total, BigInt(1_500_000));
});

test("participation fee rounds mathematically to full euro", () => {
  assert.equal(roundBasisPoints(BigInt(100_000_000), 150), BigInt(1_500_000));
  assert.equal(roundBasisPoints(BigInt(101), 150), BigInt(2));
});

test("two participants use the same opening balance basis", () => {
  const perDriver = roundBasisPoints(BigInt(100_000_000), 150);
  assert.equal(perDriver * BigInt(2), BigInt(3_000_000));
  assert.match(source("./reconciliation.ts"), /openingBalances\.get\(resultTeam\.organization\.id\)/);
});

test("negative opening balance produces no percentage participation fee", () => {
  assert.equal(roundBasisPoints(BigInt(-5_000_000), 150), BigInt(0));
});

test("super license uses exact point rate and fractional points", () => {
  assert.equal(amountForPoints(25, DEFAULT_FINANCE_RULES.superLicensePerPointEuro), BigInt(750_000));
  assert.equal(amountForPoints(0.5, DEFAULT_FINANCE_RULES.superLicensePerPointEuro), BigInt(15_000));
});

test("super license applies only to PRIMARY lineup status", () => {
  assert.match(source("./reconciliation.ts"), /lineupStatus === DriverLineupStatus\.Primary/);
});

test("penalty point thresholds are 8 and 20 and use global logical keys", () => {
  assert.deepEqual(DEFAULT_FINANCE_RULES.penaltyPointThresholds.map((entry) => [entry.points, Number(entry.amountEuro)]), [[8, 1_000_000], [20, 10_000_000]]);
  assert.match(source("./reconciliation.ts"), /pp:season:/);
});

test("manual positive and negative adjustments are accepted", () => {
  for (const amountEuro of [5_000_000, -2_000_000]) {
    assert.equal(manualFinanceTransactionSchema.safeParse({ leagueId: 1, seasonId: 1, organizationId: 1, amountEuro, type: FinanceTransactionType.ManualAdjustment, description: "Sponsor oder Korrektur", raceId: null, driverId: null }).success, true);
  }
});

test("rule violation and transfer are forced to expenses", () => {
  const mutations = source("./mutations.ts");
  assert.match(mutations, /RULE_VIOLATION_FINE \|\| input\.type === FinanceTransactionType\.DRIVER_TRANSFER/);
  assert.match(mutations, /-abs\(input\.marketValueEuro\)/);
});

test("team championship P1 through P11 defaults match the FRL schedule", () => {
  assert.deepEqual(DEFAULT_FINANCE_RULES.teamChampionshipRewards.map((entry) => Number(entry.amountEuro)), [30_000_000, 27_000_000, 24_000_000, 21_000_000, 18_000_000, 16_000_000, 14_000_000, 13_000_000, 12_000_000, 11_000_000, 10_000_000]);
});

test("negative balances remain possible", () => {
  assert.equal(BigInt(1_000_000) + BigInt(-2_000_000), BigInt(-1_000_000));
  assert.doesNotMatch(source("./ledger.ts"), /Math\.max/);
});

test("result correction writes only the difference", () => {
  assert.equal(reconciliationDelta([BigInt(4_500_000)], BigInt(4_000_000)), BigInt(-500_000));
});

test("repeating the same reconciliation creates no delta", () => {
  assert.equal(reconciliationDelta([BigInt(4_500_000)], BigInt(4_500_000)), BigInt(0));
});

test("correction history can reconcile multiple prior revisions", () => {
  assert.equal(reconciliationDelta([BigInt(4_500_000), BigInt(-500_000)], BigInt(3_750_000)), BigInt(-250_000));
});

test("parallel reconciliation uses serializable transactions and unique source keys", () => {
  assert.match(source("./ledger.ts"), /isolationLevel: "Serializable"/);
  const schema = source("../../prisma/schema.prisma");
  assert.match(schema, /sourceKey\s+String\s+@unique/);
});

test("rule sets are versioned and settlements retain their rule set", () => {
  assert.match(source("./mutations.ts"), /version: \(previous\?\.version \?\? 0\) \+ 1/);
  assert.match(source("./reconciliation.ts"), /!options\.useCurrentRules && settlement \? settlement\.ruleSet/);
});

test("only admins can manage finance and team principals can read", () => {
  assert.equal(hasPermission([Role.Admin], Permission.ManageFinance), true);
  assert.equal(hasPermission([Role.SuperAdmin], Permission.ManageFinance), true);
  assert.equal(hasPermission([Role.TeamPrincipal], Permission.ManageFinance), false);
  assert.equal(hasPermission([Role.TeamPrincipal], Permission.ViewFinance), true);
  assert.equal(hasPermission([Role.Driver], Permission.ViewFinance), false);
});

test("all finance mutation actions enforce server-side permissions", () => {
  const actions = source("./actions.ts");
  assert.match(actions, /requirePermission\(Permission\.ManageFinance\)/);
  assert.match(actions, /requirePermission\(Permission\.ManageResults\)/);
});

test("team finance query scopes team principals to owned organizations", () => {
  assert.match(source("./queries.ts"), /principalUserId: user\.id/);
  assert.match(source("./queries.ts"), /teamOrganization\.findMany/);
  assert.match(source("./queries.ts"), /financeAccount: \{ isNot: null \}/);
});

test("Ferrari F1 debit and F2 credit share one global organization balance", () => {
  const start = BigInt(100_000_000);
  const entries = [
    { league: "F1", amountEuro: BigInt(-10_000_000) },
    { league: "F2", amountEuro: BigInt(4_000_000) },
  ];
  assert.equal(entries.reduce((balance, entry) => balance + entry.amountEuro, start), BigInt(94_000_000));
  assert.match(source("./ledger.ts"), /findUnique\(\{ where: \{ organizationId: team\.organization\.id \} \}\)/);
  assert.match(source("../../prisma/schema.prisma"), /organizationId\s+Int\s+@unique/);
});

test("league ledger filter never changes the global balance", () => {
  const entries = [
    { leagueId: 1, amountEuro: BigInt(-10_000_000) },
    { leagueId: 2, amountEuro: BigInt(4_000_000) },
  ];
  const globalBalance = entries.reduce((balance, entry) => balance + entry.amountEuro, BigInt(100_000_000));
  const f1Ledger = entries.filter((entry) => entry.leagueId === 1);
  assert.equal(globalBalance, BigInt(94_000_000));
  assert.deepEqual(f1Ledger.map((entry) => entry.amountEuro), [BigInt(-10_000_000)]);
  assert.match(source("./queries.ts"), /where: \{ accountId: selectedOrganization\.financeAccount\.id, leagueId \}/);
});

test("dashboard team-principal widget reads the organization finance account", () => {
  const dashboardQuery = source("../dashboard/queries.ts");
  const dashboardWidget = source("../../components/dashboard/DashboardWidgetContent.tsx");
  assert.match(dashboardQuery, /teamOrganization\.findFirst/);
  assert.match(dashboardQuery, /financeAccount: \{ select: \{ balanceEuro: true \} \}/);
  assert.match(dashboardWidget, /Globales Teamkonto/);
});

test("Discord publishes the global ranking while retaining trigger metadata", () => {
  const discord = source("./discord.ts");
  assert.match(discord, /teamFinanceAccount\.findMany\(\{\s*orderBy:/);
  assert.doesNotMatch(discord, /teamFinanceAccount\.findMany\(\{\s*where: \{ leagueId/);
  assert.match(discord, /title: "FRL · Globale Teamfinanzen"/);
  assert.match(discord, /renderFinanceTemplate\(setting\.messageTemplate/);
});

test("migration merges accounts without adding duplicate start balances or deleting ledger history", () => {
  const migration = source("../../prisma/migrations/20260922120000_global_team_finance_accounts/migration.sql");
  assert.match(migration, /_GlobalFinanceAccountMap/);
  assert.match(migration, /neutralized-duplicate-start-balance/);
  assert.match(migration, /UPDATE "TeamFinanceTransaction" AS entry[\s\S]+"amountEuro" = 0/);
  assert.doesNotMatch(migration, /DELETE FROM "TeamFinanceTransaction"/);
  assert.match(migration, /CREATE UNIQUE INDEX "TeamFinanceAccount_organizationId_key"/);
});

test("parallel F1 and F2 settlements retry conflicts against the unique global account", () => {
  const ledger = source("./ledger.ts");
  assert.match(ledger, /isolationLevel: "Serializable"/);
  assert.match(ledger, /error\.code === "P2034" \|\| error\.code === "P2002"/);
  assert.match(source("../../prisma/schema.prisma"), /organizationId\s+Int\s+@unique/);
});

test("race and season settlements both resolve the same organization account", () => {
  const raceSettlement = source("./reconciliation.ts");
  const seasonSettlement = source("./season-settlement.ts");
  assert.match(raceSettlement, /accountByOrganization\.get\(team\.organization\.id\)/);
  assert.match(seasonSettlement, /accountByOrganization\.get\(team\.organization\.id\)/);
  assert.doesNotMatch(seasonSettlement, /teamFinanceAccount\.findMany\(\{ where: \{ teamId/);
});

test("finance template replaces only supported placeholders", () => {
  assert.equal(renderFinanceTemplate("{league} · {season} · {race} · {round} · {date} · {unsafe}", { league: "F2", season: "S1", race: "Monza", round: 8, date: "21.09.2026" }), "F2 · S1 · Monza · 8 · 21.09.2026 · {unsafe}");
});

test("Discord settings reject direct mentions and accept no role", () => {
  const base = { leagueId: 1, guildSettingsId: 1, enabled: true, autoReconcile: true, autoPublish: true, channelId: "12345678901234567", pingRoleId: null, messageTemplate: "Stand nach {race}", showBalances: true, showDelta: true };
  assert.equal(financePublishSettingSchema.safeParse(base).success, true);
  assert.equal(financePublishSettingSchema.safeParse({ ...base, messageTemplate: "@everyone Stand" }).success, false);
});

test("Discord publish validates channel and configured role", () => {
  const mutations = source("./mutations.ts");
  assert.match(mutations, /candidate\.id === input\.channelId && candidate\.selectable/);
  assert.match(mutations, /DISCORD_ROLE_INVALID/);
});

test("Discord publication uses revision dedupe and supports correction revisions", () => {
  const discord = source("./discord.ts");
  assert.match(discord, /finance:\$\{preview\.settlementId\}:revision:\$\{preview\.revision\}/);
  assert.match(discord, /findUnique\(\{ where: \{ dedupeKey \}/);
});

test("manual and automatic finance publishing both use the outbox", () => {
  const actions = source("./actions.ts");
  assert.match(actions, /queueFinanceDiscordPublication/);
  assert.match(actions, /queueAutomaticFinancePublication/);
  assert.match(source("./discord.ts"), /discordDelivery\.upsert/);
});

test("Discord failure cannot roll back the completed finance transaction", () => {
  const actions = source("./actions.ts");
  assert.match(actions, /const result = await reconcileRaceFinances[\s\S]+await queueAutomaticFinancePublication/);
  assert.doesNotMatch(source("./reconciliation.ts"), /getConnectedDiscordClient/);
});

test("Mystery race names are sanitized before Discord and team ledger output", () => {
  assert.match(source("./discord.ts"), /publicRaceTrack\(settlement\.race\)/);
  assert.match(source("./queries.ts"), /publicRaceTrack\(race\)\.name/);
});

test("finance error logging never references Discord token values", () => {
  const discord = source("./discord.ts");
  assert.doesNotMatch(discord, /DISCORD_BOT_TOKEN|process\.env/);
});

for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
  test(`finance UI remains responsive at ${width}px`, () => {
    const ledger = source("../../components/finance/FinanceLedger.tsx");
    const forms = source("../../components/finance/FinanceAdminForms.tsx");
    const adminPage = source("../../app/(protected)/admin/finance/page.tsx");
    const teamPage = source("../../app/(protected)/finance/page.tsx");
    assert.match(ledger, /lg:hidden/);
    assert.match(ledger, /hidden overflow-x-auto[\s\S]+lg:block/);
    assert.match(forms, /min-h-11/);
    assert.match(forms, /min-w-0/);
    assert.match(adminPage, /sm:grid-cols-2 xl:grid-cols-4/);
    assert.match(teamPage, /min-w-0/);
    assert.match(teamPage, /sm:grid-cols-2/);
    assert.match(teamPage, /Der Kontostand bleibt unabhängig vom Journalfilter immer global/);
    assert.doesNotMatch(ledger, /block[^"\n]*lg:hidden[^\n]*<table/);
  });
}
