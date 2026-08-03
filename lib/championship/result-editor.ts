export const DEFAULT_RESULT_ROW_COUNT = 22;

export type ResultEditorDriverOrder = {
  id: number;
  name: string;
  registered: boolean;
  registrationOrder: number | null;
  expectedDriverId: number | null;
};

export type ResultEditorGridRow = {
  driverId: number;
  position: number | null;
  finalPosition: number | null;
};

export type ResultEditorRowContent = {
  driverId: string;
  driverQuery: string;
  representedTeamId: string;
  expectedDriverId: string;
  gapInput: string;
  fastestLapInput: string;
  qualifyingTimeInput?: string;
  qualifyingLaps?: string;
  q1TimeInput?: string;
  q1Laps?: string;
  q2TimeInput?: string;
  q2Laps?: string;
  q3TimeInput?: string;
  q3Laps?: string;
  tireCompound?: string;
  legacyFastestLap: boolean;
  startingPosition: string;
  lapsCompleted: string;
  polePosition: boolean;
  notes: string;
  substitute: boolean;
  manualOverride: boolean;
  manualPenaltySeconds: string;
  manualDisqualified: boolean;
  manualOverrideReason: string;
};

export function withDefaultResultRows<T>(
  rows: readonly T[],
  createEmptyRow: (position: number) => T,
  preserveExisting = false,
): T[] {
  if (preserveExisting) return [...rows];

  const next = [...rows];
  while (next.length < DEFAULT_RESULT_ROW_COUNT) {
    next.push(createEmptyRow(next.length + 1));
  }
  return next;
}

export function orderRegisteredResultDrivers<
  T extends ResultEditorDriverOrder,
>(drivers: readonly T[], startingGrid: readonly ResultEditorGridRow[]): T[] {
  const gridPositionByDriver = new Map(
    startingGrid.map((row, index) => [
      row.driverId,
      row.finalPosition ?? row.position ?? index + 1,
    ]),
  );

  return drivers
    .filter((driver) => driver.registered)
    .sort((left, right) => {
      const leftGridPosition = gridPositionByDriver.get(
        left.expectedDriverId ?? left.id,
      );
      const rightGridPosition = gridPositionByDriver.get(
        right.expectedDriverId ?? right.id,
      );

      if (
        leftGridPosition !== undefined ||
        rightGridPosition !== undefined
      ) {
        if (leftGridPosition === undefined) return 1;
        if (rightGridPosition === undefined) return -1;
        if (leftGridPosition !== rightGridPosition) {
          return leftGridPosition - rightGridPosition;
        }
      }

      const registrationDifference =
        (left.registrationOrder ?? Number.MAX_SAFE_INTEGER) -
        (right.registrationOrder ?? Number.MAX_SAFE_INTEGER);
      return registrationDifference || left.name.localeCompare(right.name);
    });
}

export function moveResultRow<T>(
  rows: readonly T[],
  index: number,
  direction: -1 | 1,
): T[] {
  const target = index + direction;
  if (index < 0 || index >= rows.length || target < 0 || target >= rows.length) {
    return [...rows];
  }

  const next = [...rows];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

export function removeResultRow<T>(
  rows: readonly T[],
  index: number,
): { rows: T[]; removed: T | null } {
  if (index < 0 || index >= rows.length) {
    return { rows: [...rows], removed: null };
  }

  const next = [...rows];
  const [removed] = next.splice(index, 1);
  return { rows: next, removed };
}

export function restoreResultRow<T>(
  rows: readonly T[],
  row: T,
  index: number,
): T[] {
  const next = [...rows];
  next.splice(Math.min(Math.max(index, 0), next.length), 0, row);
  return next;
}

export function isPopulatedResultRow(row: ResultEditorRowContent): boolean {
  return Boolean(
    row.driverId ||
      row.driverQuery.trim() ||
      row.representedTeamId ||
      row.expectedDriverId ||
      (row.gapInput.trim() && row.gapInput.trim() !== "Sieger") ||
      row.fastestLapInput.trim() ||
      row.qualifyingTimeInput?.trim() ||
      (row.qualifyingLaps && row.qualifyingLaps !== "0") ||
      row.q1TimeInput?.trim() ||
      (row.q1Laps && row.q1Laps !== "0") ||
      row.q2TimeInput?.trim() ||
      (row.q2Laps && row.q2Laps !== "0") ||
      row.q3TimeInput?.trim() ||
      (row.q3Laps && row.q3Laps !== "0") ||
      row.tireCompound?.trim() ||
      row.legacyFastestLap ||
      row.startingPosition ||
      (row.lapsCompleted && row.lapsCompleted !== "0") ||
      row.polePosition ||
      row.notes.trim() ||
      row.substitute ||
      row.manualOverride ||
      (row.manualPenaltySeconds && row.manualPenaltySeconds !== "0") ||
      row.manualDisqualified ||
      row.manualOverrideReason.trim(),
  );
}

export function resultRowsForIntent(
  rows: readonly unknown[],
  intent: unknown,
): unknown[] {
  if (intent === "DRAFT") return [...rows];

  return rows.filter((row) => {
    if (
      typeof row !== "object" ||
      row === null ||
      !("driverId" in row) ||
      row.driverId !== null
    ) {
      return true;
    }

    const value = row as Record<string, unknown>;
    return !(
      value.representedTeamId === null &&
      value.expectedDriverId === null &&
      value.startingPosition === null &&
      value.status === "FINISHED" &&
      (value.gapInput === "" || value.gapInput === "Sieger") &&
      value.fastestLapInput === "" &&
      (value.qualifyingTimeInput === "" || value.qualifyingTimeInput === undefined) &&
      (value.qualifyingLaps === 0 || value.qualifyingLaps === undefined) &&
      (value.q1TimeInput === "" || value.q1TimeInput === undefined) &&
      (value.q1Laps === 0 || value.q1Laps === undefined) &&
      (value.q2TimeInput === "" || value.q2TimeInput === undefined) &&
      (value.q2Laps === 0 || value.q2Laps === undefined) &&
      (value.q3TimeInput === "" || value.q3TimeInput === undefined) &&
      (value.q3Laps === 0 || value.q3Laps === undefined) &&
      (value.tireCompound === "" || value.tireCompound === undefined) &&
      value.legacyFastestLap === false &&
      value.polePosition === false &&
      value.lapsCompleted === 0 &&
      value.manualOverride === false &&
      value.manualPenaltySeconds === 0 &&
      value.manualDisqualified === false &&
      value.manualOverrideReason === null &&
      value.notes === null &&
      value.substitute === false
    );
  });
}
