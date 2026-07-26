import assert from "node:assert/strict";
import test from "node:test";
import {
  PenaltyType,
  ResultGapMode,
  ResultPublicationStatus,
  ResultSession,
  ResultStatus,
} from "@/domain";
import {
  affectsChampionship,
  aggregateFiaPenalties,
  calculateFinalClassification,
  driverBelongsToResultContext,
  fastestLapKeys,
  matchesDriverSearch,
  normalizeGaps,
  parseFastestLapInput,
  parseGapInput,
} from "./result-engine";
import {
  resultDraftSubmissionSchema,
  resultSubmissionSchema,
} from "./schemas";
import {
  calculateResultPoints,
  scoringPositionKey,
} from "./scoring";

test("driver autocomplete searches name, Discord name and number", () => {
  const driver = {
    name: "Max Mustermann",
    discordName: "max_racing",
    number: 27,
  };
  assert.equal(matchesDriverSearch(driver, "muster"), true);
  assert.equal(matchesDriverSearch(driver, "RACING"), true);
  assert.equal(matchesDriverSearch(driver, "27"), true);
  assert.equal(matchesDriverSearch(driver, "44"), false);
});

test("result validation prevents duplicate drivers", () => {
  const row = {
    driverId: 1,
    representedTeamId: 1,
    expectedDriverId: null,
    position: 1,
    startingPosition: null,
    status: ResultStatus.Finished,
    gapInput: "Sieger",
    fastestLapInput: "",
    legacyFastestLap: false,
    polePosition: false,
    lapsCompleted: 50,
    manualOverride: false,
    manualPenaltySeconds: 0,
    manualDisqualified: false,
    manualOverrideReason: null,
    notes: null,
    substitute: false,
  };
  const result = resultSubmissionSchema.safeParse({
    leagueId: 1,
    raceId: 1,
    session: ResultSession.Race,
    gapMode: ResultGapMode.ToLeader,
    intent: "PUBLISH",
    syncFiaPenalties: true,
    allowArchived: false,
    confirmLockedEdit: false,
    results: [row, { ...row, position: 2 }],
  });
  assert.equal(result.success, false);
});

test("gap-to-leader derives previous gaps and rejects regressions", () => {
  const normalized = normalizeGaps(
    [
      parseGapInput("Sieger")!,
      parseGapInput("+4.321")!,
      parseGapInput("+1:12.450")!,
    ],
    ResultGapMode.ToLeader,
  );
  assert.equal(normalized.error, null);
  assert.deepEqual(
    normalized.rows.map((row) => row.gapToPreviousMs),
    [0, 4321, 68129],
  );
  assert.match(
    normalizeGaps(
      [
        parseGapInput("0")!,
        parseGapInput("+5")!,
        parseGapInput("+4")!,
      ],
      ResultGapMode.ToLeader,
    ).error ?? "",
    /nicht kleiner/,
  );
});

test("gap-to-previous accumulates and supports laps behind", () => {
  const normalized = normalizeGaps(
    [
      parseGapInput("0")!,
      parseGapInput("+4.321")!,
      parseGapInput("+2.000")!,
      parseGapInput("+1 Runde")!,
    ],
    ResultGapMode.ToPrevious,
  );
  assert.deepEqual(
    normalized.rows.map((row) => row.gapToLeaderMs),
    [0, 4321, 6321, null],
  );
  assert.equal(normalized.rows[3].lapsBehind, 1);
});

test("fastest-lap parsing normalizes both supported formats", () => {
  assert.equal(parseFastestLapInput("1:21.456"), 81456);
  assert.equal(parseFastestLapInput("81.456"), 81456);
  assert.equal(parseFastestLapInput("1:72.000"), null);
  assert.deepEqual(
    [...fastestLapKeys([
      {
        key: "a",
        fastestLapMs: 81456,
        status: ResultStatus.Finished,
      },
      {
        key: "b",
        fastestLapMs: 82000,
        status: ResultStatus.Finished,
      },
    ])],
    ["a"],
  );
});

test("FIA import de-duplicates decisions", () => {
  const summary = aggregateFiaPenalties([
    {
      decisionId: 10,
      penaltyType: PenaltyType.TimePenalty,
      penaltyValue: 5,
    },
    {
      decisionId: 10,
      penaltyType: PenaltyType.TimePenalty,
      penaltyValue: 5,
    },
    {
      decisionId: 11,
      penaltyType: PenaltyType.Disqualification,
      penaltyValue: null,
    },
  ]);
  assert.deepEqual(summary.decisionIds, [10, 11]);
  assert.equal(summary.penaltyMilliseconds, 5000);
  assert.equal(summary.disqualified, true);
});

test("manual override wins without mutating imported FIA values", () => {
  const [result] = calculateFinalClassification([
    {
      key: "driver",
      order: 0,
      status: ResultStatus.Finished,
      gapToLeaderMs: 0,
      lapsBehind: 0,
      importedPenaltyMs: 10000,
      importedDisqualified: true,
      hasManualOverride: true,
      manualPenaltyMs: 5000,
      manualDisqualified: false,
    },
  ]);
  assert.equal(result.importedPenaltyMs, 10000);
  assert.equal(result.importedDisqualified, true);
  assert.equal(result.effectivePenaltyMs, 5000);
  assert.equal(result.effectiveStatus, ResultStatus.Finished);
});

test("time penalties reorder classification and DSQ receives no place", () => {
  const results = calculateFinalClassification([
    {
      key: "leader",
      order: 0,
      status: ResultStatus.Finished,
      gapToLeaderMs: 0,
      lapsBehind: 0,
      importedPenaltyMs: 10000,
      importedDisqualified: false,
      hasManualOverride: false,
      manualPenaltyMs: 0,
      manualDisqualified: false,
    },
    {
      key: "second",
      order: 1,
      status: ResultStatus.Finished,
      gapToLeaderMs: 4000,
      lapsBehind: 0,
      importedPenaltyMs: 0,
      importedDisqualified: false,
      hasManualOverride: false,
      manualPenaltyMs: 0,
      manualDisqualified: false,
    },
    {
      key: "dsq",
      order: 2,
      status: ResultStatus.Finished,
      gapToLeaderMs: 6000,
      lapsBehind: 0,
      importedPenaltyMs: 0,
      importedDisqualified: true,
      hasManualOverride: false,
      manualPenaltyMs: 0,
      manualDisqualified: false,
    },
  ]);
  assert.equal(results[0].key, "second");
  assert.equal(results[0].finalPosition, 1);
  assert.equal(results[1].key, "leader");
  assert.equal(results[2].effectiveStatus, ResultStatus.Dsq);
  assert.equal(results[2].finalPosition, null);
});

test("points calculation respects fastest-lap eligibility and substitutes", () => {
  const points = calculateResultPoints(
    {
      position: 2,
      status: ResultStatus.Finished,
      fastestLap: true,
      polePosition: false,
      classifiedPercentage: 100,
      substitute: true,
    },
    ResultSession.Race,
    {
      fastestLapPoint: 1,
      fastestLapRequiresTopPosition: 10,
      polePositionPoint: 0,
      dnfScoresPoints: false,
      retiredScoresPoints: false,
      minimumClassifiedPercentage: 90,
      teamPointsEnabled: true,
      substituteDriverPointsEnabled: false,
    },
    new Map([[scoringPositionKey(ResultSession.Race, 2), 18]]),
    false,
  );
  assert.equal(points.driverBase, 0);
  assert.equal(points.driverBonus, 0);
  assert.equal(points.teamBase, 18);
  assert.equal(points.teamBonus, 1);
});

test("league separation permits cross-league replacements only with an expected driver", () => {
  assert.equal(
    driverBelongsToResultContext({
      driverLeagueId: 2,
      selectedLeagueId: 1,
      substitute: false,
      expectedDriverLeagueId: null,
    }),
    false,
  );
  assert.equal(
    driverBelongsToResultContext({
      driverLeagueId: 2,
      selectedLeagueId: 1,
      substitute: true,
      expectedDriverLeagueId: 1,
    }),
    true,
  );
});

test("only published race and sprint results affect standings", () => {
  assert.equal(
    affectsChampionship({
      publicationStatus: ResultPublicationStatus.Draft,
      session: ResultSession.Race,
    }),
    false,
  );
  assert.equal(
    affectsChampionship({
      publicationStatus: ResultPublicationStatus.Published,
      session: ResultSession.Qualifying,
    }),
    false,
  );
  assert.equal(
    affectsChampionship({
      publicationStatus: ResultPublicationStatus.Published,
      session: ResultSession.Race,
    }),
    true,
  );
});

test("drafts preserve incomplete rows while publication rejects them", () => {
  const incompleteSubmission = {
    leagueId: 1,
    raceId: 1,
    session: ResultSession.Race,
    gapMode: ResultGapMode.ToLeader,
    intent: "DRAFT" as const,
    syncFiaPenalties: false,
    allowArchived: false,
    confirmLockedEdit: false,
    results: [
      {
        driverId: null,
        representedTeamId: null,
        expectedDriverId: null,
        position: 1,
        startingPosition: null,
        status: ResultStatus.Finished,
        gapInput: "",
        fastestLapInput: "",
        legacyFastestLap: false,
        polePosition: false,
        lapsCompleted: 0,
        manualOverride: false,
        manualPenaltySeconds: 0,
        manualDisqualified: false,
        manualOverrideReason: null,
        notes: null,
        substitute: false,
      },
    ],
  };

  assert.equal(
    resultDraftSubmissionSchema.safeParse(incompleteSubmission)
      .success,
    true,
  );
  assert.equal(
    resultSubmissionSchema.safeParse({
      ...incompleteSubmission,
      intent: "PUBLISH",
    }).success,
    false,
  );
});
