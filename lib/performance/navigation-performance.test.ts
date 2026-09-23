import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(path, "utf8");
}

test("protected navigation folds shell data into the joined session read", () => {
  const schema = source("prisma/schema.prisma");
  const adapter = source("lib/auth/adapter.ts");
  const shell = source("components/layout/AppShell.tsx");

  assert.match(schema, /previewFeatures\s*=\s*\["relationJoins"\]/);
  assert.match(adapter, /getSessionAndUser\(sessionToken\)/);
  assert.match(adapter, /relationLoadStrategy:\s*"join"/);
  assert.match(adapter, /settings:\s*\{\s*select:\s*\{\s*theme:\s*true/);
  assert.match(adapter, /notifications:\s*\{[\s\S]*readAt:\s*null[\s\S]*archivedAt:\s*null/);
  assert.doesNotMatch(shell, /getUnreadNotificationCount/);
  assert.doesNotMatch(shell, /getResolvedTheme\(user\.id\)/);
  assert.match(shell, /user\.unreadNotificationCount/);
  assert.match(shell, /getResolvedThemeForPreference\(user\.themePreference\)/);
});

test("dashboard reuses the session notification count", () => {
  const page = source("app/(protected)/dashboard/page.tsx");
  const queries = source("lib/dashboard/queries.ts");

  assert.match(page, /getDashboardData\(user\.id, user\.unreadNotificationCount\)/);
  assert.doesNotMatch(queries, /getUnreadNotificationCount/);
});

test("normal Finance navigation never waits for the Discord API", () => {
  const queries = source("lib/finance/queries.ts");
  const forms = source("components/finance/FinanceAdminForms.tsx");

  assert.match(queries, /query\.loadDiscordChannels\s*\?\s*await getDiscordChannelCatalogState/);
  assert.match(queries, /loadDiscordChannels:\s*enabledFlag\(input\.loadDiscordChannels\)/);
  assert.match(queries, /loadPreviews:\s*enabledFlag\(input\.loadPreviews\)/);
  assert.match(queries, /query\.loadPreviews\s*\?\s*await Promise\.all/);
  assert.match(forms, /loadDiscordChannels=1#discord/);
  assert.match(forms, /Discord-Kanäle laden/);
  assert.match(forms, /Abrechnungsvorschauen laden/);
});

test("Admin Results streams the expensive Finance panel after the editor", () => {
  const page = source("app/(protected)/admin/results/page.tsx");

  assert.match(page, /<Suspense[\s\S]*<ResultFinanceSection/);
  assert.match(page, /async function ResultFinanceSection/);
  assert.match(page, /await getResultFinancePanelData\(raceId, leagueId\)/);
});

test("primary routes retain loading boundaries and Next links", () => {
  const loadingBoundaries = [
    "app/(protected)/dashboard/loading.tsx",
    "app/(protected)/calendar/loading.tsx",
    "app/(protected)/championship/loading.tsx",
    "app/(protected)/results/loading.tsx",
    "app/(protected)/teams/loading.tsx",
    "app/(protected)/drivers/loading.tsx",
    "app/(protected)/finance/loading.tsx",
    "app/(protected)/admin/loading.tsx",
  ];
  for (const path of loadingBoundaries) {
    assert.ok(source(path).length > 0, `${path} must remain a loading boundary`);
  }

  const activeLink = source("components/layout/ActiveNavLink.tsx");
  const mobileNavigation = source("components/layout/MobileNavigation.tsx");
  assert.match(activeLink, /from "next\/link"/);
  assert.match(mobileNavigation, /from "next\/link"/);
  assert.doesNotMatch(activeLink, /window\.location|location\.href/);
  assert.doesNotMatch(mobileNavigation, /window\.location|location\.href/);
});

test("the navigation guard remains cookie-only and live refresh remains deferred", () => {
  const proxy = source("proxy.ts");
  const protectedLayout = source("app/(protected)/layout.tsx");
  const deferredRefresh = source("components/live/DeferredAppAutoRefresh.tsx");

  assert.doesNotMatch(proxy, /getPrismaClient|from "@\/auth"|auth\(\)/);
  assert.match(protectedLayout, /DeferredAppAutoRefresh/);
  assert.match(deferredRefresh, /requestIdleCallback/);
});

test("list routes keep compact characters while detail routes may use full body", () => {
  const drivers = source("app/(protected)/drivers/page.tsx");
  const teams = source("app/(protected)/teams/page.tsx");
  const driverDetail = source("app/(protected)/drivers/[id]/page.tsx");

  assert.match(drivers, /variant="head"/);
  assert.match(teams, /variant="head"/);
  assert.doesNotMatch(drivers, /variant="fullBody"/);
  assert.doesNotMatch(teams, /variant="fullBody"/);
  assert.match(driverDetail, /variant="fullBody"/);
});
