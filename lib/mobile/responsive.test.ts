import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function source(path: string): string {
  return readFileSync(new URL(`../../${path}`, import.meta.url), "utf8");
}

const appLayout = source("components/layout/AppLayout.tsx");
const publicNavbar = source("components/layout/Navbar.tsx");
const sidebar = source("components/layout/Sidebar.tsx");
const mobileNavigation = source("components/layout/MobileNavigation.tsx");
const dashboard = source("app/(protected)/dashboard/page.tsx");
const raceWeekend = source("app/(protected)/calendar/[id]/page.tsx");
const attendance = source("components/championship/AttendanceRoster.tsx");
const resultEditor = source("components/championship/ResultsEditor.tsx");
const resultView = source("app/(protected)/results/[id]/page.tsx");
const championship = source("app/(protected)/championship/page.tsx");
const fiaDetail = source("app/(protected)/fia/[id]/page.tsx");
const discussion = source("components/fia/DiscussionCard.tsx");
const evidence = source("components/fia/EvidenceCard.tsx");
const automation = source("app/(protected)/admin/automation/page.tsx");
const designEditor = source("components/design/DesignBrandingEditor.tsx");
const globalStyles = source("app/globals.css");

test("desktop sidebar and mobile navigation use the lg boundary", () => {
  assert.match(sidebar, /hidden[^"\n]*lg:flex/);
  assert.match(mobileNavigation, /lg:hidden/);
});

test("public navigation has a touch-safe mobile menu and preserves desktop links", () => {
  assert.match(publicNavbar, /aria-label="Navigation öffnen"/);
  assert.match(publicNavbar, /mobile-touch-target/);
  assert.match(publicNavbar, /hidden items-center gap-8 lg:flex/);
});

test("mobile navigation never renders more than four primary destinations plus More", () => {
  assert.match(mobileNavigation, /mobileItems\s*\.slice\(0, 4\)/);
  assert.match(mobileNavigation, />\s*Mehr\s*</);
});

test("the mobile menu is a phone bottom sheet and a tablet drawer", () => {
  assert.match(mobileNavigation, /inset-x-0 bottom-0/);
  assert.match(mobileNavigation, /sm:inset-y-0 sm:left-auto sm:right-0/);
});

test("the app shell reserves the bottom navigation safe area", () => {
  assert.match(appLayout, /mobile-safe-bottom/);
  assert.match(globalStyles, /env\(safe-area-inset-bottom\)/);
});

test("the mobile dashboard shows race operations before its compact status area", () => {
  const operations = dashboard.indexOf('aria-label="Race Operations"');
  const status = dashboard.indexOf('aria-labelledby="status-heading"');
  assert.ok(operations > -1 && operations < status);
  assert.match(dashboard, /grid grid-cols-2 gap-3/);
});

test("race weekend exposes the viewer league time and collapses secondary schedules", () => {
  assert.match(raceWeekend, /Dein Renntermin/);
  assert.match(raceWeekend, /Alle Liga-Termine/);
  assert.match(raceWeekend, /Weitere Streckendaten/);
});

test("attendance uses tabs below lg and three columns at lg", () => {
  assert.match(attendance, /grid grid-cols-3 gap-2 lg:hidden/);
  assert.match(attendance, /hidden gap-4 lg:grid lg:grid-cols-3/);
});

test("result editing keeps cards below lg and the desktop table at lg", () => {
  assert.match(resultEditor, /shadow-\[var\(--shadow-card\)\] lg:block/);
  assert.match(resultEditor, /space-y-4 lg:hidden/);
  assert.match(resultEditor, /backdrop-blur lg:hidden/);
});

test("published results use cards below lg", () => {
  assert.match(resultView, /overflow-x-auto lg:block/);
  assert.match(resultView, /space-y-3 lg:hidden/);
});

test("championship details stay compact below lg", () => {
  assert.match(championship, /text-slate-500 lg:grid/);
  assert.match(championship, /text-slate-400 lg:block/);
});

test("FIA detail preserves the mobile information, chat, evidence, decision and history order", () => {
  const status = fiaDetail.indexOf("<StatusCard");
  const discussionIndex = fiaDetail.indexOf("<DiscussionCard");
  const evidenceIndex = fiaDetail.indexOf("<EvidenceCard");
  const decision = fiaDetail.indexOf("<DecisionCard");
  const history = fiaDetail.indexOf("<HistoryCard");
  assert.ok(status < discussionIndex && discussionIndex < evidenceIndex);
  assert.ok(evidenceIndex < decision && decision < history);
});

test("FIA chat and evidence keep mobile touch controls and contained video", () => {
  assert.match(discussion, /min-h-12 min-w-12/);
  assert.match(discussion, /fixed inset-x-0 bottom-0/);
  assert.match(evidence, /aspect-video w-full/);
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
