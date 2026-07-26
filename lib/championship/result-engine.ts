import {
  PenaltyType,
  ResultGapMode,
  ResultPublicationStatus,
  ResultSession,
  ResultStatus,
} from "@/domain";

export type ParsedTiming = {
  milliseconds: number | null;
  lapsBehind: number;
};

export type NormalizedGapRow = {
  gapToLeaderMs: number | null;
  gapToPreviousMs: number | null;
  lapsBehind: number;
};

export type ResultCalculationInput = {
  key: string;
  order: number;
  status: ResultStatus;
  gapToLeaderMs: number | null;
  lapsBehind: number;
  importedPenaltyMs: number;
  importedDisqualified: boolean;
  hasManualOverride: boolean;
  manualPenaltyMs: number;
  manualDisqualified: boolean;
};

export type ResultCalculation = ResultCalculationInput & {
  effectivePenaltyMs: number;
  effectiveStatus: ResultStatus;
  adjustedTimeMs: number | null;
  finalPosition: number | null;
};

export type FiaPenaltyInput = {
  decisionId: number;
  penaltyType: PenaltyType;
  penaltyValue: number | null;
};

export type FiaPenaltySummary = {
  decisionIds: number[];
  penaltyMilliseconds: number;
  disqualified: boolean;
};

function parseClock(value: string): number | null {
  const normalized = value.trim().replace(/^\+/, "").replace(",", ".");
  const parts = normalized.split(":");
  if (parts.length > 2 || parts.some((part) => part.trim() === "")) {
    return null;
  }

  const minutes = parts.length === 2 ? Number(parts[0]) : 0;
  const seconds = Number(parts.at(-1));
  if (
    !Number.isFinite(minutes) ||
    !Number.isFinite(seconds) ||
    minutes < 0 ||
    seconds < 0 ||
    (parts.length === 2 && seconds >= 60)
  ) {
    return null;
  }

  return Math.round((minutes * 60 + seconds) * 1000);
}

export function parseGapInput(value: string): ParsedTiming | null {
  const normalized = value.trim();
  if (!normalized) return { milliseconds: null, lapsBehind: 0 };
  if (/^(sieger|winner|0(?:[.,]0+)?)$/i.test(normalized)) {
    return { milliseconds: 0, lapsBehind: 0 };
  }

  const lapMatch = normalized.match(
    /^\+?\s*(\d+)\s*(?:lap|laps|runde|runden)$/i,
  );
  if (lapMatch) {
    return {
      milliseconds: null,
      lapsBehind: Number(lapMatch[1]),
    };
  }

  const milliseconds = parseClock(normalized);
  return milliseconds === null
    ? null
    : { milliseconds, lapsBehind: 0 };
}

export function parseFastestLapInput(value: string): number | null {
  if (!value.trim()) return null;
  return parseClock(value);
}

export function formatTiming(milliseconds: number | null): string {
  if (milliseconds === null) return "";
  const totalSeconds = milliseconds / 1000;
  if (totalSeconds < 60) {
    return totalSeconds.toFixed(3);
  }
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${(totalSeconds - minutes * 60)
    .toFixed(3)
    .padStart(6, "0")}`;
}

export function normalizeGaps(
  values: readonly ParsedTiming[],
  mode: ResultGapMode,
): { rows: NormalizedGapRow[]; error: string | null } {
  let cumulative = 0;
  let previousLeaderGap = 0;
  const rows: NormalizedGapRow[] = [];

  for (const [index, value] of values.entries()) {
    if (index === 0) {
      rows.push({
        gapToLeaderMs: 0,
        gapToPreviousMs: 0,
        lapsBehind: value.lapsBehind,
      });
      continue;
    }

    if (value.lapsBehind > 0) {
      rows.push({
        gapToLeaderMs: null,
        gapToPreviousMs: null,
        lapsBehind: value.lapsBehind,
      });
      continue;
    }

    if (value.milliseconds === null) {
      rows.push({
        gapToLeaderMs: null,
        gapToPreviousMs: null,
        lapsBehind: 0,
      });
      continue;
    }

    if (mode === ResultGapMode.ToPrevious) {
      cumulative += value.milliseconds;
      rows.push({
        gapToLeaderMs: cumulative,
        gapToPreviousMs: value.milliseconds,
        lapsBehind: 0,
      });
      previousLeaderGap = cumulative;
      continue;
    }

    if (value.milliseconds < previousLeaderGap) {
      return {
        rows: [],
        error:
          "Der kumulierte Abstand darf innerhalb der Wertung nicht kleiner werden.",
      };
    }
    rows.push({
      gapToLeaderMs: value.milliseconds,
      gapToPreviousMs: value.milliseconds - previousLeaderGap,
      lapsBehind: 0,
    });
    previousLeaderGap = value.milliseconds;
  }

  return { rows, error: null };
}

export function aggregateFiaPenalties(
  penalties: readonly FiaPenaltyInput[],
): FiaPenaltySummary {
  const unique = new Map(
    penalties.map((penalty) => [penalty.decisionId, penalty]),
  );
  let penaltyMilliseconds = 0;
  let disqualified = false;

  for (const penalty of unique.values()) {
    if (penalty.penaltyType === PenaltyType.TimePenalty) {
      penaltyMilliseconds += Math.max(
        0,
        Math.round((penalty.penaltyValue ?? 0) * 1000),
      );
    }
    if (penalty.penaltyType === PenaltyType.Disqualification) {
      disqualified = true;
    }
  }

  return {
    decisionIds: [...unique.keys()].sort((left, right) => left - right),
    penaltyMilliseconds,
    disqualified,
  };
}

function classificationGroup(result: ResultCalculation): number {
  if (result.effectiveStatus === ResultStatus.Dsq) return 3;
  if (result.effectiveStatus === ResultStatus.Dns) return 2;
  if (
    result.effectiveStatus === ResultStatus.Dnf ||
    result.effectiveStatus === ResultStatus.Retired
  ) {
    return 1;
  }
  return 0;
}

export function calculateFinalClassification(
  inputs: readonly ResultCalculationInput[],
): ResultCalculation[] {
  const calculated = inputs.map<ResultCalculation>((input) => {
    const effectivePenaltyMs = input.hasManualOverride
      ? input.manualPenaltyMs
      : input.importedPenaltyMs;
    const disqualified = input.hasManualOverride
      ? input.manualDisqualified
      : input.importedDisqualified;
    const effectiveStatus = disqualified
      ? ResultStatus.Dsq
      : input.status;
    return {
      ...input,
      effectivePenaltyMs,
      effectiveStatus,
      adjustedTimeMs:
        input.gapToLeaderMs === null ||
        effectiveStatus !== ResultStatus.Finished
          ? null
          : input.gapToLeaderMs + effectivePenaltyMs,
      finalPosition: null,
    };
  });

  const sorted = [...calculated].sort((left, right) => {
    const groupDifference =
      classificationGroup(left) - classificationGroup(right);
    if (groupDifference !== 0) return groupDifference;
    if (
      classificationGroup(left) === 0 &&
      left.adjustedTimeMs !== right.adjustedTimeMs
    ) {
      return (
        (left.adjustedTimeMs ?? Number.MAX_SAFE_INTEGER) -
        (right.adjustedTimeMs ?? Number.MAX_SAFE_INTEGER)
      );
    }
    return left.order - right.order;
  });

  let position = 0;
  return sorted.map((result) => {
    const classified =
      result.effectiveStatus !== ResultStatus.Dns &&
      result.effectiveStatus !== ResultStatus.Dsq;
    if (classified) position += 1;
    return {
      ...result,
      finalPosition: classified ? position : null,
    };
  });
}

export function fastestLapKeys(
  rows: readonly {
    key: string;
    fastestLapMs: number | null;
    status: ResultStatus;
  }[],
): Set<string> {
  const eligible = rows.filter(
    (row) =>
      row.fastestLapMs !== null &&
      row.status !== ResultStatus.Dns &&
      row.status !== ResultStatus.Dsq,
  );
  const fastest = Math.min(
    ...eligible.map((row) => row.fastestLapMs ?? Number.MAX_SAFE_INTEGER),
  );
  const winner = eligible.find((row) => row.fastestLapMs === fastest);
  return new Set(winner ? [winner.key] : []);
}

export function matchesDriverSearch(
  driver: {
    name: string;
    discordName: string | null;
    number: number;
  },
  query: string,
): boolean {
  const normalized = query.trim().toLocaleLowerCase("de-DE");
  if (!normalized) return true;
  return [driver.name, driver.discordName, String(driver.number)]
    .filter((value): value is string => Boolean(value))
    .some((value) =>
      value.toLocaleLowerCase("de-DE").includes(normalized),
    );
}

export function driverBelongsToResultContext(input: {
  driverLeagueId: number;
  selectedLeagueId: number;
  substitute: boolean;
  expectedDriverLeagueId: number | null;
}): boolean {
  return input.substitute
    ? input.expectedDriverLeagueId === input.selectedLeagueId
    : input.driverLeagueId === input.selectedLeagueId;
}

export function affectsChampionship(input: {
  publicationStatus: ResultPublicationStatus;
  session: ResultSession;
}): boolean {
  return (
    input.publicationStatus === ResultPublicationStatus.Published &&
    input.session !== ResultSession.Qualifying
  );
}
