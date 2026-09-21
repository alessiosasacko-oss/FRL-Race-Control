import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const appShell = source("components/layout/AppShell.tsx");
const publicNavbar = source("components/layout/Navbar.tsx");
const sidebar = source("components/layout/Sidebar.tsx");
const mobileNavigation = source("components/layout/MobileNavigation.tsx");
const dashboard = source("app/(protected)/dashboard/page.tsx");
const personalDashboard = source("components/dashboard/PersonalDashboard.tsx");
const raceWeekend = source("app/(protected)/calendar/[id]/page.tsx");
const resultEditor = source("components/championship/ResultsEditor.tsx");
const resultOverview = source("app/(protected)/results/page.tsx");
const resultView = source("app/(protected)/results/[id]/page.tsx");
const championship = source("app/(protected)/championship/page.tsx");
const automation = source("app/(protected)/admin/automation/page.tsx");
const designEditor = source("components/design/DesignBrandingEditor.tsx");
const globalStyles = source("app/globals.css");

test("desktop sidebar and mobile navigation use the lg boundary", () => {
  assert.match(sidebar, /hidden[^"\n]*lg:flex/);
  assert.match(mobileNavigation, /lg:hidden/);
});

test("public navigation keeps branding and login touch-safe at every width", () => {
  assert.match(publicNavbar, /min-h-11/);
  assert.match(publicNavbar, /aria-label="FRL Race Control Startseite"/);
  assert.match(publicNavbar, /href="\/login"/);
});

test("mobile navigation never renders more than four primary destinations plus More", () => {
  assert.match(mobileNavigation, /\.filter\(\(item\) => hasPermission\(user\.roles, item\.permission\)\)\.slice\(0, 4\)/);
  assert.match(mobileNavigation, />\s*Mehr\s*</);
});

test("the mobile menu is a phone bottom sheet and a tablet drawer", () => {
  assert.match(mobileNavigation, /inset-x-0 bottom-0/);
  assert.match(mobileNavigation, /sm:inset-y-0 sm:left-auto sm:right-0/);
});

test("the app shell reserves the bottom navigation safe area", () => {
  assert.match(appShell, /mobile-safe-bottom/);
  assert.match(globalStyles, /env\(safe-area-inset-bottom\)/);
});

test("the mobile dashboard keeps fixed race context above personal widgets in one contained column", () => {
  assert.match(dashboard, /PersonalDashboard/);
  assert.ok(personalDashboard.indexOf("<NextRaceWidget") < personalDashboard.indexOf("<DashboardEditorGrid"));
  assert.match(personalDashboard, /grid min-w-0 grid-cols-1/);
  assert.match(personalDashboard, /md:grid-cols-2 lg:grid-cols-12/);
});

test("race weekend exposes the viewer league time and collapses secondary schedules", () => {
  assert.match(raceWeekend, /Dein Renntermin/);
  assert.match(raceWeekend, /Alle Liga-Termine/);
  assert.match(raceWeekend, /Weitere Streckendaten/);
});

test("result editing keeps cards below lg and the desktop table at lg", () => {
  assert.match(resultEditor, /shadow-\[var\(--shadow-card\)\] lg:block/);
  assert.match(resultEditor, /space-y-4 lg:hidden/);
  assert.match(resultEditor, /backdrop-blur lg:hidden/);
});

test("published results use an overflow-safe list below lg", () => {
  assert.match(resultOverview, /lg:grid-cols-\[/);
  assert.doesNotMatch(resultOverview, /overflow-x-auto/);
  assert.match(resultView, /overflow-x-auto lg:block/);
  assert.match(resultView, /space-y-3 lg:hidden/);
});

test("championship details stay compact below lg", () => {
  assert.match(championship, /text-slate-500 lg:grid/);
  assert.match(championship, /text-slate-400 lg:block/);
});

test("admin jobs have a mobile card alternative", () => {
  assert.match(automation, /aria-labelledby="mobile-jobs-heading"/);
  assert.match(automation, /hidden overflow-x-auto lg:block/);
});

test("design preview is collapsible on mobile and unchanged from lg", () => {
  assert.match(designEditor, /Mobile Live-Vorschau/);
  assert.match(designEditor, /hidden lg:block 2xl:sticky/);
});

test("global responsive safeguards prevent horizontal page overflow and respect reduced motion", () => {
  assert.match(globalStyles, /@media \(max-width: 1023px\)/);
  assert.match(globalStyles, /overflow-x: clip/);
  assert.match(globalStyles, /@media \(prefers-reduced-motion: reduce\)/);
});
