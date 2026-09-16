import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
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

test("the sticky result context makes league, round, track and session explicit", () => {
  assert.match(contextSource, /sticky top-/);
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

test("save area repeats the complete result context", () => {
  assert.match(contextSource, /Du speicherst/);
  assert.match(editorSource, /ResultsSaveContext/);
  assert.match(editorSource, /erfolgreich gespeichert/);
  assert.match(editorSource, /erfolgreich veröffentlicht/);
});

test("admin selectors expose professional league, race and session labels", () => {
  assert.match(pageSource, /FRL \{league\.code\}/);
  assert.match(pageSource, /ROUND \{String\(race\.round\)\.padStart/);
  assert.match(pageSource, /Session wählen/);
  assert.match(pageSource, /CountryFlag/);
});
