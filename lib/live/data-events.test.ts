import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import {
  APP_DATA_CHANNEL,
  APP_DATA_STORAGE_KEY,
  appDataScopes,
  createAppDataChangedEvent,
  isAppDataChangedEvent,
  scopesForPathname,
} from "./data-events";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const provider = source("components/live/AppAutoRefresh.tsx");
const hook = source("components/live/useLiveActionState.ts");
const protectedLayout = source("app/(protected)/layout.tsx");
const loginPage = source("app/login/page.tsx");
const driverForm = source("components/master-data/DriverForm.tsx");
const userForms = source("components/users/UserAdminForms.tsx");
const teamForm = source("components/master-data/TeamOrganizationForm.tsx");

test("successful driver actions request a live refresh", () => {
  assert.match(driverForm, /useLiveActionState as useActionState/);
  assert.deepEqual(scopesForPathname("/admin/drivers/15"), ["drivers", "teams", "attendance", "championship"]);
});

test("successful role changes request a live refresh", () => {
  assert.match(userForms, /useLiveActionState as useActionState/);
  assert.deepEqual(scopesForPathname("/admin/users/7"), ["users", "drivers"]);
});

test("successful team changes request a live refresh", () => {
  assert.match(teamForm, /useLiveActionState as useActionState/);
  assert.ok(scopesForPathname("/admin/teams").includes("teams"));
});

test("BroadcastChannel propagates valid scope-only events", () => {
  assert.equal(APP_DATA_CHANNEL, "frl-data-updates");
  assert.match(provider, /new BroadcastChannel\(APP_DATA_CHANNEL\)/);
});

test("localStorage is the cross-tab fallback", () => {
  assert.equal(APP_DATA_STORAGE_KEY, "frl-data-update");
  assert.match(source("lib/live/data-events.ts"), /localStorage\.setItem/);
  assert.match(provider, /addEventListener\("storage"/);
});

test("window focus queues a refresh", () => {
  assert.match(provider, /addEventListener\("focus", backgroundRefresh\)/);
});

test("returning to a visible tab queues a refresh", () => {
  assert.match(provider, /visibilityState === "visible"/);
  assert.match(provider, /addEventListener\("visibilitychange"/);
});

test("returning online queues a refresh", () => {
  assert.match(provider, /addEventListener\("online", onlineRefresh\)/);
});

test("the interval pauses while the tab is hidden", () => {
  assert.match(provider, /document\.visibilityState === "visible" && navigator\.onLine/);
});

test("the visible online interval runs every 15 seconds", () => {
  assert.match(provider, /REFRESH_INTERVAL_MS = 15_000/);
  assert.match(provider, /window\.setInterval/);
});

test("rapid data events are debounced", () => {
  assert.match(provider, /EVENT_DEBOUNCE_MS = 500/);
  assert.match(provider, /clearTimeout\(debounceTimer\.current\)/);
});

test("only one refresh runs at a time and refreshes stay five seconds apart", () => {
  assert.match(provider, /refreshInFlight\.current \|\| isPending/);
  assert.match(provider, /MIN_REFRESH_GAP_MS = 5_000/);
});

test("dirty forms defer background refreshes", () => {
  assert.match(provider, /dirtyForms\.current\.size > 0/);
  assert.match(provider, /Neue Daten verfügbar/);
});

test("a successful own form action refreshes despite dirty state", () => {
  assert.match(hook, /status === "success"/);
  assert.match(provider, /queueEventRefresh\(true\)/);
});

test("login and OAuth pages do not mount the refresh interval", () => {
  assert.match(protectedLayout, /AppAutoRefresh/);
  assert.doesNotMatch(loginPage, /AppAutoRefresh/);
});

test("the mobile live indicator is contained and touch safe", () => {
  assert.match(provider, /max-w-\[calc\(100vw-1\.5rem\)\]/);
  assert.match(provider, /min-h-11/);
  assert.doesNotMatch(provider, /min-w-\[/);
});

test("the live refresh never performs a full browser reload", () => {
  const liveSource = source("lib/live/data-events.ts") + provider + hook;
  assert.doesNotMatch(liveSource, /window\.location\.reload|location\.reload/);
  assert.match(provider, /router\.refresh\(\)/);
});

test("events contain no personal data", () => {
  const event = createAppDataChangedEvent(["drivers", "teams"], 123);
  assert.equal(isAppDataChangedEvent(event), true);
  assert.deepEqual(Object.keys(event).sort(), ["eventId", "scopes", "timestamp", "type"]);
  assert.equal(appDataScopes.length, 12);
  assert.equal(isAppDataChangedEvent({ ...event, scopes: ["email"] }), false);
});
