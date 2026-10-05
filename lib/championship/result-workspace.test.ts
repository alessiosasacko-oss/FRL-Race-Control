import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { driverDropdownPosition } from "./driver-dropdown-position";
import {
  ResultPublicationStatus,
  ResultSession,
} from "@/domain";
import {
  resultPublishSummary,
  resultWorkspaceStatus,
  resultWorkspaceStorageKey,
  unsavedResultWarning,
} from "./result-workspace";

const editorSource = readFileSync(
  new URL(
    "../../components/championship/ResultsEditor.tsx",
    import.meta.url,
  ),
  "utf8",
);
const pageSource = readFileSync(
  new URL(
    "../../app/(protected)/admin/results/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const contextSource = readFileSync(
  new URL(
    "../../components/championship/ResultsContextHeader.tsx",
    import.meta.url,
  ),
  "utf8",
);

test("a missing result session is not started", () => {
  assert.equal(
    resultWorkspaceStatus([], ResultSession.Race),
    "NOT_STARTED",
  );
});

test("a draft result session is labelled as draft", () => {
  assert.equal(
    resultWorkspaceStatus(
      [
        {
          session: ResultSession.Race,
          publicationStatus: ResultPublicationStatus.Draft,
        },
      ],
      ResultSession.Race,
    ),
    "DRAFT",
  );
});

test("a published result session is labelled as published", () => {
  assert.equal(
    resultWorkspaceStatus(
      [
        {
          session: ResultSession.Race,
          publicationStatus: ResultPublicationStatus.Published,
        },
      ],
      ResultSession.Race,
    ),
    "PUBLISHED",
  );
});

test("weekend status is scoped to the selected session", () => {
  assert.equal(
    resultWorkspaceStatus(
      [
        {
          session: ResultSession.Qualifying,
          publicationStatus: ResultPublicationStatus.Published,
        },
      ],
      ResultSession.Race,
    ),
    "NOT_STARTED",
  );
});

test("local drafts are scoped to the race", () => {
  assert.match(
    resultWorkspaceStorageKey(12, 3, ResultSession.Race),
    /:12:/,
  );
});

test("local drafts are scoped to the league", () => {
  assert.match(
    resultWorkspaceStorageKey(12, 3, ResultSession.Race),
    /:3:/,
  );
});

test("local drafts are scoped to the session", () => {
  assert.match(
    resultWorkspaceStorageKey(12, 3, ResultSession.Sprint),
    /:SPRINT$/,
  );
});

test("unsaved-change warning identifies the league", () => {
  assert.equal(
    unsavedResultWarning("F3"),
    "Du hast ungespeicherte Änderungen im F3-Ergebnis. Möchtest du die Seite wirklich verlassen?",
  );
});

test("publish summary counts drivers without duplicates", () => {
  assert.equal(
    resultPublishSummary({
      driverIds: ["1", "2", "2", ""],
      fastestDriverNames: [],
    }).driverCount,
    2,
  );
});

test("publish summary keeps unique fastest-lap drivers", () => {
  assert.deepEqual(
    resultPublishSummary({
      driverIds: [],
      fastestDriverNames: ["Alex", "Alex", "Sam"],
    }).fastestDriverNames,
    ["Alex", "Sam"],
  );
});

test("publish summary supports no fastest lap", () => {
  assert.deepEqual(
    resultPublishSummary({
      driverIds: [],
      fastestDriverNames: [],
    }).fastestDriverNames,
    [],
  );
});

test("the removed live preview does not return", () => {
  assert.equal(editorSource.includes("Live-Vorschau"), false);
});

test("the editor retains a mobile-only action bar", () => {
  assert.match(
    editorSource,
    /backdrop-blur lg:hidden/,
  );
});

test("publication confirmation names league and race", () => {
  assert.match(
    editorSource,
    /Du veröffentlichst das Ergebnis für/,
  );
  assert.match(editorSource, /race\.season\.league\.code/);
  assert.match(editorSource, /race\.name/);
});

test("the overview groups league states by race weekend", () => {
  assert.match(pageSource, /Gemeinsames Rennwochenende/);
  assert.match(pageSource, /weekendLeagueResults/);
});

test("the result context stays in normal document flow while making league, round, track and session explicit", () => {
  assert.doesNotMatch(contextSource, /\bsticky\b|\bfixed\b|\btop-/);
  assert.match(contextSource, /FRL \{race\.season\.league\.code\}/);
  assert.match(contextSource, /ROUND \{round\}/);
  assert.match(contextSource, /race\.circuit/);
  assert.match(contextSource, /resultSessionLabels\[session\]/);
});

test("result context uses the shared country flag and protects mystery metadata", () => {
  assert.match(contextSource, /CountryFlag/);
  assert.match(contextSource, /race\.revealMystery/);
  assert.match(contextSource, /Strecke bis zum Reveal geschützt/);
  assert.match(contextSource, /Geschütztes Mystery Race/);
});

test("the simplified editor keeps a single responsive save action set", () => {
  assert.doesNotMatch(editorSource, /ResultsSaveContext/);
  assert.match(editorSource, /Entwurf speichern/);
  assert.match(editorSource, /Veröffentlichen/);
  assert.match(editorSource, /erfolgreich gespeichert/);
  assert.match(editorSource, /erfolgreich veröffentlicht/);
});

test("session-specific primary fields keep race data out of qualifying", () => {
  assert.match(editorSource, /session === ResultSession\.Qualifying/);
  assert.match(editorSource, /qualifyingTimeInput/);
  assert.match(editorSource, /session !== ResultSession\.Qualifying/);
  assert.match(editorSource, /fastestLapInput/);
  assert.match(editorSource, /Zusatzdaten/);
});

test("result entry uses mobile cards below lg and a compact desktop table", () => {
  assert.match(editorSource, /lg:hidden/);
  assert.match(editorSource, /className="hidden[^"]*lg:block"/);
  assert.match(editorSource, /min-w-\[980px\]/);
  assert.doesNotMatch(editorSource, /min-w-\[1[5-9]\d{2}px\]/);
});

test("admin selectors expose professional league, race and session labels", () => {
  assert.match(pageSource, /FRL \{league\.code\}/);
  assert.match(pageSource, /ROUND \{String\(race\.round\)\.padStart/);
  assert.match(pageSource, /Session wählen/);
  assert.match(pageSource, /CountryFlag/);
});

test("driver dropdown escapes table and mobile clipping through a body portal", () => {
  const picker = readFileSync(new URL("../../components/championship/DriverSearchCombobox.tsx", import.meta.url), "utf8");
  assert.match(picker, /createPortal\(/);
  assert.match(picker, /document\.body/);
  assert.match(picker, /fixed z-\[100\]/);
  assert.match(picker, /overflow-y-auto overscroll-contain/);
  assert.match(picker, /role="combobox"/);
  assert.match(picker, /aria-activedescendant/);
  for (const key of ["ArrowDown", "ArrowUp", "Enter", "Escape", "Tab"]) assert.ok(picker.includes(`"${key}"`));
  assert.match(picker, /event\.stopPropagation\(\)/);
  assert.match(picker, /addEventListener\("pointerdown", dismissOutside/);
  assert.match(picker, /addEventListener\("scroll", schedulePosition, true\)/);
  assert.match(picker, /visualViewport/);
  assert.match(editorSource, /max-h-\[68vh\] overflow-auto/);
  assert.doesNotMatch(editorSource, /\.slice\(0, 8\)/);
});

test("driver dropdown stays within mobile and desktop viewports", () => {
  for (const width of [360, 390, 430, 768, 1024, 1440, 1920]) {
    const anchor = { left: width - 170, right: width - 10, top: 100, bottom: 144, width: 160 };
    const menu = driverDropdownPosition(anchor, { left: 0, top: 0, width, height: 900 }, width < 1024);
    assert.ok(menu.left >= 8);
    assert.ok(menu.left + menu.width <= width - 8);
    assert.equal(menu.top, 148);
    assert.equal(menu.maxHeight, 288);
    assert.equal(menu.upwards, false);
  }
});

test("driver dropdown flips at the bottom and respects the mobile keyboard viewport", () => {
  const menu = driverDropdownPosition({ left: 30, right: 340, top: 360, bottom: 404, width: 310 }, { left: 0, top: 80, width: 390, height: 350 }, true);
  assert.equal(menu.upwards, true);
  assert.equal(menu.top, 356);
  assert.equal(menu.maxHeight, 268);
});

test("driver dropdown handles horizontal visual viewport offsets and narrow screens", () => {
  const menu = driverDropdownPosition({ left: 350, right: 590, top: 50, bottom: 94, width: 240 }, { left: 100, top: 0, width: 240, height: 300 }, false);
  assert.equal(menu.width, 224);
  assert.equal(menu.left, 108);
  assert.equal(menu.maxHeight, 194);
});
