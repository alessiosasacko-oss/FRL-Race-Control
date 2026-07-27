"use client";

import Link from "next/link";
import {
  useActionState,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  GripVertical,
  Plus,
  Search,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  RaceSession,
  ResultGapMode,
  ResultPenaltySource,
  ResultPublicationStatus,
  ResultSession,
  ResultStatus,
  resultGapModeLabels,
  resultStatusLabels,
} from "@/domain";
import { deleteResultsAction } from "@/lib/championship/actions";
import { saveResultsAction } from "@/lib/championship/result-actions";
import {
  isPopulatedResultRow,
  moveResultRow,
  orderRegisteredResultDrivers,
  removeResultRow,
  restoreResultRow,
  withDefaultResultRows,
} from "@/lib/championship/result-editor";
import {
  aggregateFiaPenalties,
  calculateFinalClassification,
  fastestLapKeys,
  formatTiming,
  matchesDriverSearch,
  normalizeGaps,
  parseFastestLapInput,
  parseGapInput,
} from "@/lib/championship/result-engine";
import {
  calculateResultPoints,
  scoringPositionKey,
} from "@/lib/championship/scoring";
import {
  initialSportsActionState,
  type ResultAdminData,
} from "@/lib/championship/types";
import ActionMessage from "./ActionMessage";

type ResultsEditorProps = {
  data: ResultAdminData;
  session: ResultSession;
};

type RowState = {
  key: string;
  driverId: string;
  driverQuery: string;
  representedTeamId: string;
  expectedDriverId: string;
  status: ResultStatus;
  gapInput: string;
  fastestLapInput: string;
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

function sessionForFia(session: ResultSession): RaceSession {
  if (session === ResultSession.Qualifying) return RaceSession.Qualifying;
  if (session === ResultSession.Sprint) return RaceSession.Sprint;
  return RaceSession.Race;
}

function displayGap(
  gapMode: ResultGapMode,
  result: {
    gapToWinnerMs: number | null;
    gapToPreviousMs: number | null;
    lapsBehind: number;
    position: number | null;
  },
): string {
  if (result.position === 1) return "Sieger";
  if (result.lapsBehind > 0) {
    return `+${result.lapsBehind} ${
      result.lapsBehind === 1 ? "Runde" : "Runden"
    }`;
  }
  return `+${formatTiming(
    gapMode === ResultGapMode.ToLeader
      ? result.gapToWinnerMs
      : result.gapToPreviousMs,
  )}`;
}

function emptyRow(position: number): RowState {
  return {
    key: `empty-${position}`,
    driverId: "",
    driverQuery: "",
    representedTeamId: "",
    expectedDriverId: "",
    status: ResultStatus.Finished,
    gapInput: position === 1 ? "Sieger" : "",
    fastestLapInput: "",
    legacyFastestLap: false,
    startingPosition: "",
    lapsCompleted: "0",
    polePosition: false,
    notes: "",
    substitute: false,
    manualOverride: false,
    manualPenaltySeconds: "0",
    manualDisqualified: false,
    manualOverrideReason: "",
  };
}

function initialRows(
  data: ResultAdminData,
  session: ResultSession,
): RowState[] {
  const existing = data.selected?.sessions.find(
    (item) => item.session === session,
  );
  if (
    existing?.publicationStatus ===
      ResultPublicationStatus.Draft &&
    existing.draftPayload
  ) {
    return existing.draftPayload.results.map((result, index) => {
      const driver = result.driverId
        ? data.drivers.find(
            (candidate) => candidate.id === result.driverId,
          )
        : null;
      return {
        key: `draft-${index}-${result.driverId ?? "empty"}`,
        driverId: result.driverId ? String(result.driverId) : "",
        driverQuery: driver
          ? `${driver.name} · #${driver.number}`
          : "",
        representedTeamId: result.representedTeamId
          ? String(result.representedTeamId)
          : "",
        expectedDriverId: result.expectedDriverId
          ? String(result.expectedDriverId)
          : "",
        status: result.status,
        gapInput: result.gapInput,
        fastestLapInput: result.fastestLapInput,
        legacyFastestLap: result.legacyFastestLap,
        startingPosition: result.startingPosition
          ? String(result.startingPosition)
          : "",
        lapsCompleted: String(result.lapsCompleted),
        polePosition: result.polePosition,
        notes: result.notes ?? "",
        substitute: result.substitute,
        manualOverride: result.manualOverride,
        manualPenaltySeconds: String(
          result.manualPenaltySeconds,
        ),
        manualDisqualified: result.manualDisqualified,
        manualOverrideReason:
          result.manualOverrideReason ?? "",
      };
    });
  }
  if (existing?.results.length) {
    return existing.results.map((result) => {
      const manual = result.penaltyApplications.find(
        (application) =>
          application.source === ResultPenaltySource.Manual &&
          application.active,
      );
      return {
        key: `result-${result.id}`,
        driverId: String(result.driverId),
        driverQuery: `${result.driver.name} · #${result.driver.number}`,
        representedTeamId: String(result.representedTeamId),
        expectedDriverId: result.expectedDriverId
          ? String(result.expectedDriverId)
          : "",
        status: result.baseStatus,
        gapInput: displayGap(existing.gapMode, result),
        fastestLapInput: formatTiming(result.fastestLapMs),
        legacyFastestLap: result.fastestLap,
        startingPosition: result.startingPosition
          ? String(result.startingPosition)
          : "",
        lapsCompleted: String(result.lapsCompleted),
        polePosition: result.polePosition,
        notes: result.notes ?? "",
        substitute: result.substitute,
        manualOverride: Boolean(manual),
        manualPenaltySeconds: manual
          ? String(manual.penaltyMilliseconds / 1000)
          : "0",
        manualDisqualified: manual?.disqualified ?? false,
        manualOverrideReason: manual?.reason ?? "",
      };
    });
  }

  const startingGrid =
    session === ResultSession.Qualifying
      ? []
      : (data.selected?.sessions.find(
          (item) => item.session === ResultSession.Qualifying,
        )?.results ?? []);
  const gridPositionByDriver = new Map(
    startingGrid.map((result, index) => [
      result.driverId,
      result.finalPosition ?? result.position ?? index + 1,
    ]),
  );
  const registered = orderRegisteredResultDrivers(
    data.drivers,
    startingGrid,
  );
  const registeredRows = registered.map((driver, index) => {
    const row = emptyRow(index + 1);
    const expectedDriver = driver.expectedDriverId
      ? data.drivers.find(
          (candidate) => candidate.id === driver.expectedDriverId,
        )
      : null;
    return {
      ...row,
      key: `driver-${driver.id}`,
      driverId: String(driver.id),
      driverQuery: `${driver.name} · #${driver.number}`,
      representedTeamId: String(
        driver.replacement
          ? expectedDriver?.teamId ?? ""
          : driver.teamId ?? "",
      ),
      expectedDriverId: driver.expectedDriverId
        ? String(driver.expectedDriverId)
        : "",
      startingPosition: gridPositionByDriver.has(
        driver.expectedDriverId ?? driver.id,
      )
        ? String(
            gridPositionByDriver.get(
              driver.expectedDriverId ?? driver.id,
            ),
          )
        : "",
      substitute: driver.replacement,
    };
  });
  return withDefaultResultRows(registeredRows, emptyRow);
}

export default function ResultsEditor({
  data,
  session,
}: ResultsEditorProps) {
  const existingSession = data.selected?.sessions.find(
    (item) => item.session === session,
  );
  const storageKey = data.selected
    ? `frl-result-draft:${data.selected.race.id}:${data.selected.race.season.league.id}:${session}`
    : "";
  const [rows, setRows] = useState<RowState[]>(() =>
    initialRows(data, session),
  );
  const [gapMode, setGapMode] = useState<ResultGapMode>(
    existingSession?.draftPayload?.gapMode ??
      existingSession?.gapMode ??
      ResultGapMode.ToLeader,
  );
  const [allowArchived, setAllowArchived] = useState(false);
  const [confirmLockedEdit, setConfirmLockedEdit] = useState(false);
  const [syncFiaPenalties, setSyncFiaPenalties] = useState(
    !existingSession || existingSession.fiaPenaltyVersion === null,
  );
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [removedRow, setRemovedRow] = useState<{
    row: RowState;
    index: number;
  } | null>(null);
  const [state, action, pending] = useActionState(
    saveResultsAction,
    initialSportsActionState,
  );

  useEffect(() => {
    if (!storageKey) return;
    const stored = window.sessionStorage.getItem(storageKey);
    if (!stored) return;
    try {
      const parsed = JSON.parse(stored) as {
        rows?: RowState[];
        gapMode?: ResultGapMode;
      };
      const restoreTimer = window.setTimeout(() => {
        if (parsed.rows?.length) setRows(parsed.rows);
        if (parsed.gapMode) setGapMode(parsed.gapMode);
      }, 0);
      return () => window.clearTimeout(restoreTimer);
    } catch {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!storageKey) return;
    window.sessionStorage.setItem(
      storageKey,
      JSON.stringify({ rows, gapMode }),
    );
  }, [gapMode, rows, storageKey]);

  useEffect(() => {
    if (state.status === "success" && storageKey) {
      window.sessionStorage.removeItem(storageKey);
    }
  }, [state.status, storageKey]);

  const selectedDriverIds = useMemo(
    () => rows.map((row) => row.driverId).filter(Boolean),
    [rows],
  );
  const hasDuplicateDriver =
    new Set(selectedDriverIds).size !== selectedDriverIds.length;
  const hasIncompleteDriverRow = rows.some(
    (row) => !row.driverId && isPopulatedResultRow(row),
  );
  const parsedGaps = rows.map(
    (row) => parseGapInput(row.gapInput) ?? {
      milliseconds: null,
      lapsBehind: 0,
    },
  );
  const normalizedGaps = normalizeGaps(parsedGaps, gapMode);
  const currentFiaPenalties = data.fiaPenalties.filter(
    (penalty) => penalty.session === sessionForFia(session),
  );

  function storedFiaSummary(driverId: number) {
    const result = existingSession?.results.find(
      (candidate) => candidate.driverId === driverId,
    );
    const applications =
      result?.penaltyApplications.filter(
        (application) =>
          application.source === ResultPenaltySource.Fia &&
          application.active,
      ) ?? [];
    return {
      decisionIds: applications.flatMap((application) =>
        application.decisionId ? [application.decisionId] : [],
      ),
      penaltyMilliseconds: applications.reduce(
        (sum, application) =>
          sum + application.penaltyMilliseconds,
        0,
      ),
      disqualified: applications.some(
        (application) => application.disqualified,
      ),
    };
  }

  function importedFiaSummary(row: RowState) {
    const driverId = Number(row.driverId);
    if (
      existingSession &&
      !syncFiaPenalties &&
      existingSession.results.some(
        (result) => result.driverId === driverId,
      )
    ) {
      return storedFiaSummary(driverId);
    }
    return aggregateFiaPenalties(
      currentFiaPenalties
        .filter((penalty) => penalty.driverId === driverId)
        .map((penalty) => ({
          decisionId: penalty.decisionId,
          penaltyType: penalty.penaltyType,
          penaltyValue: penalty.penaltyValue,
        })),
    );
  }

  const calculated = calculateFinalClassification(
    rows.map((row, index) => {
      const imported = importedFiaSummary(row);
      return {
        key: row.key,
        order: index,
        status: row.status,
        gapToLeaderMs:
          normalizedGaps.rows[index]?.gapToLeaderMs ?? null,
        lapsBehind:
          normalizedGaps.rows[index]?.lapsBehind ?? 0,
        importedPenaltyMs: imported.penaltyMilliseconds,
        importedDisqualified: imported.disqualified,
        hasManualOverride: row.manualOverride,
        manualPenaltyMs: Math.max(
          0,
          Math.round(Number(row.manualPenaltySeconds || 0) * 1000),
        ),
        manualDisqualified: row.manualDisqualified,
      };
    }),
  );
  const calculationByKey = new Map(
    calculated.map((result) => [result.key, result]),
  );
  const fastestDrivers = fastestLapKeys(
    rows.map((row) => ({
      key: row.key,
      fastestLapMs: parseFastestLapInput(row.fastestLapInput),
      status:
        calculationByKey.get(row.key)?.effectiveStatus ?? row.status,
    })),
  );
  const positionPoints = new Map(
    data.scoring.positions.map((position) => [
      scoringPositionKey(position.session, position.position),
      position.points,
    ]),
  );
  const preview = calculated.map((result) => {
    const row = rows.find((candidate) => candidate.key === result.key);
    const points =
      session === ResultSession.Qualifying
        ? {
            driverBase: 0,
            driverBonus: 0,
            teamBase: 0,
            teamBonus: 0,
          }
        : calculateResultPoints(
            {
              position: result.finalPosition,
              status: result.effectiveStatus,
              fastestLap: fastestDrivers.has(result.key),
              polePosition: row?.polePosition ?? false,
              classifiedPercentage: null,
              substitute: row?.substitute ?? false,
            },
            session,
            data.scoring,
            positionPoints,
            data.selected?.race.doublePoints ?? false,
          );
    return { result, row, points };
  });
  const teamPoints = new Map<number, number>();
  preview.forEach(({ row, points }) => {
    const teamId = Number(row?.representedTeamId);
    if (teamId) {
      teamPoints.set(
        teamId,
        (teamPoints.get(teamId) ?? 0) +
          points.teamBase +
          points.teamBonus,
      );
    }
  });

  function updateRow(index: number, patch: Partial<RowState>): void {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function selectDriver(index: number, driverId: number): void {
    const driver = data.drivers.find((item) => item.id === driverId);
    if (!driver) return;
    const expectedDriver = driver.expectedDriverId
      ? data.drivers.find(
          (candidate) => candidate.id === driver.expectedDriverId,
        )
      : null;
    updateRow(index, {
      driverId: String(driver.id),
      driverQuery: `${driver.name} · #${driver.number}`,
      representedTeamId: String(
        driver.replacement
          ? expectedDriver?.teamId ?? ""
          : driver.teamId ?? "",
      ),
      expectedDriverId: driver.expectedDriverId
        ? String(driver.expectedDriverId)
        : "",
      substitute: driver.replacement,
    });
  }

  function moveRow(index: number, direction: -1 | 1): void {
    setRows((current) => moveResultRow(current, index, direction));
  }

  function dropRow(targetIndex: number): void {
    if (draggedIndex === null || draggedIndex === targetIndex) return;
    setRows((current) => {
      const next = [...current];
      const [dragged] = next.splice(draggedIndex, 1);
      next.splice(targetIndex, 0, dragged);
      return next;
    });
    setDraggedIndex(null);
  }

  function addRow(): void {
    setRows((current) => [
      ...current,
      {
        ...emptyRow(current.length + 1),
        key: crypto.randomUUID(),
      },
    ]);
  }

  function removeRow(index: number): void {
    const row = rows[index];
    if (!row || rows.length === 1) return;
    if (
      isPopulatedResultRow(row) &&
      !window.confirm(
        `Die ausgefüllte Fahrerzeile auf Position ${index + 1} wirklich entfernen?`,
      )
    ) {
      return;
    }

    const result = removeResultRow(rows, index);
    if (!result.removed) return;
    setRows(result.rows);
    setRemovedRow({ row: result.removed, index });
  }

  function undoRemove(): void {
    if (!removedRow) return;
    setRows((current) =>
      restoreResultRow(current, removedRow.row, removedRow.index),
    );
    setRemovedRow(null);
  }

  function handleTableKeyDown(
    event: React.KeyboardEvent<HTMLDivElement>,
  ): void {
    if (
      event.key !== "Enter" ||
      event.shiftKey ||
      event.currentTarget !== event.target &&
        (event.target as HTMLElement).tagName === "TEXTAREA"
    ) {
      return;
    }
    const cells = Array.from(
      event.currentTarget.querySelectorAll<HTMLElement>(
        "[data-result-cell]:not([disabled])",
      ),
    );
    const index = cells.indexOf(event.target as HTMLElement);
    if (index >= 0 && index < cells.length - 1) {
      event.preventDefault();
      cells[index + 1].focus();
    }
  }

  if (!data.selected) return null;

  const submission = {
    leagueId: data.selected.race.season.league.id,
    raceId: data.selected.race.id,
    session,
    gapMode,
    intent: "DRAFT",
    syncFiaPenalties,
    allowArchived,
    confirmLockedEdit,
    lockAfterSave: false,
    results: rows.map((row, index) => ({
        driverId: row.driverId ? Number(row.driverId) : null,
        representedTeamId: row.representedTeamId
          ? Number(row.representedTeamId)
          : null,
        expectedDriverId: row.expectedDriverId
          ? Number(row.expectedDriverId)
          : null,
        position: index + 1,
        startingPosition: row.startingPosition
          ? Number(row.startingPosition)
          : null,
        status: row.status,
        gapInput: row.gapInput,
        fastestLapInput: row.fastestLapInput,
        legacyFastestLap: row.legacyFastestLap,
        gapToWinnerSeconds: null,
        gapToPreviousSeconds: null,
        totalTimeSeconds: null,
        fastestLap: row.legacyFastestLap,
        polePosition: row.polePosition,
        lapsCompleted: Number(row.lapsCompleted || 0),
        manualOverride: row.manualOverride,
        manualPenaltySeconds: Number(
          row.manualPenaltySeconds || 0,
        ),
        penaltySeconds: 0,
        manualDisqualified: row.manualDisqualified,
        manualOverrideReason: row.manualOverrideReason || null,
        notes: row.notes || null,
        substitute: row.substitute,
      })),
  };
  const published =
    existingSession?.publicationStatus ===
    ResultPublicationStatus.Published;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 rounded-2xl border border-slate-800 bg-slate-950/40 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] ${
                published
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-200"
              }`}
            >
              {published ? "Veröffentlicht" : "Entwurf"}
            </span>
            <span className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-3 py-1 text-xs font-semibold text-cyan-200">
              {rows.length} Fahrerzeilen
            </span>
          </div>
          <p className="mt-3 text-sm font-semibold text-white">
            Race-Control-Arbeitsfläche
          </p>
          <p className="mt-1 text-xs text-slate-400">
            Abstände werden intern immer auf Millisekunden normalisiert.
          </p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {Object.values(ResultGapMode).map((mode) => (
            <button
              key={mode}
              type="button"
              onClick={() => setGapMode(mode)}
              className={`min-h-12 rounded-xl border px-4 text-sm font-semibold ${
                gapMode === mode
                  ? "border-blue-500 bg-blue-500/15 text-blue-200"
                  : "border-slate-700 text-slate-300"
              }`}
            >
              {resultGapModeLabels[mode]}
            </button>
          ))}
        </div>
      </div>

      {existingSession?.fiaPenaltiesChanged ? (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-100">
          <div className="flex gap-3">
            <AlertTriangle className="shrink-0" size={20} />
            <div className="space-y-3">
              <p>
                Die finalen FIA-Entscheidungen haben sich seit dem
                letzten Entwurf geändert. Manuelle Anpassungen werden
                nicht überschrieben.
              </p>
              <label className="flex min-h-11 items-center gap-3 font-semibold">
                <input
                  type="checkbox"
                  checked={syncFiaPenalties}
                  onChange={(event) =>
                    setSyncFiaPenalties(event.target.checked)
                  }
                  className="h-5 w-5 accent-amber-500"
                />
                FIA-Strafen erneut synchronisieren
              </label>
            </div>
          </div>
        </div>
      ) : null}

      {hasDuplicateDriver ||
      hasIncompleteDriverRow ||
      normalizedGaps.error ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {hasDuplicateDriver
            ? "Ein Fahrer wurde mehrfach ausgewählt. "
            : ""}
          {hasIncompleteDriverRow
            ? "Mindestens eine ausgefüllte Zeile hat noch keinen ausgewählten Fahrer. "
            : ""}
          {normalizedGaps.error}
        </div>
      ) : null}

      <form action={action} className="space-y-5">
        <input
          type="hidden"
          name="submission"
          value={JSON.stringify(submission)}
        />

        <div
          className="hidden max-h-[68vh] overflow-auto rounded-2xl border border-slate-700 bg-[#0b1119] shadow-2xl shadow-black/20 md:block"
          onKeyDown={handleTableKeyDown}
        >
          <table className="min-w-[1380px] w-full border-collapse text-sm">
            <thead className="sticky top-0 z-20 bg-[#151e2a] text-left text-[0.68rem] uppercase tracking-[0.13em] text-slate-400 shadow-lg">
              <tr>
                <th className="sticky left-0 z-30 w-20 bg-[#151e2a] px-3 py-3">
                  Pos.
                </th>
                <th className="sticky left-20 z-30 min-w-64 bg-[#151e2a] px-3 py-3">
                  Fahrer
                </th>
                <th className="px-3 py-3">Nr.</th>
                <th className="px-3 py-3">Flagge</th>
                <th className="min-w-40 px-3 py-3">Team</th>
                <th className="min-w-36 px-3 py-3">Status</th>
                <th className="min-w-36 px-3 py-3">Abstand</th>
                <th className="min-w-36 px-3 py-3">
                  Schnellste Runde
                </th>
                <th className="min-w-64 px-3 py-3">FIA-Strafe</th>
                <th className="min-w-28 px-3 py-3">Endposition</th>
                <th className="w-32 px-3 py-3">
                  Sortieren / Entfernen
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row, index) => (
                <DesktopRow
                  key={row.key}
                  row={row}
                  index={index}
                  rows={rows}
                  data={data}
                  calculation={calculationByKey.get(row.key)}
                  fastest={fastestDrivers.has(row.key)}
                  imported={importedFiaSummary(row)}
                  onUpdate={(patch) => updateRow(index, patch)}
                  onSelectDriver={(driverId) =>
                    selectDriver(index, driverId)
                  }
                  onMove={(direction) => moveRow(index, direction)}
                  onRemove={() => removeRow(index)}
                  onDragStart={() => setDraggedIndex(index)}
                  onDrop={() => dropRow(index)}
                />
              ))}
            </tbody>
          </table>
        </div>

        <div className="space-y-4 md:hidden">
          {rows.map((row, index) => (
            <MobileRow
              key={row.key}
              row={row}
              index={index}
              rows={rows}
              data={data}
              calculation={calculationByKey.get(row.key)}
              fastest={fastestDrivers.has(row.key)}
              imported={importedFiaSummary(row)}
              onUpdate={(patch) => updateRow(index, patch)}
              onSelectDriver={(driverId) =>
                selectDriver(index, driverId)
              }
              onMove={(direction) => moveRow(index, direction)}
              onRemove={() => removeRow(index)}
            />
          ))}
        </div>

        <button
          type="button"
          onClick={addRow}
          className="wizard-secondary-button min-h-12 w-full justify-center"
        >
          <Plus size={18} /> Fahrer hinzufügen
        </button>

        {removedRow ? (
          <div
            role="status"
            className="flex flex-col gap-3 rounded-xl border border-blue-500/30 bg-blue-500/10 p-4 text-sm text-blue-100 sm:flex-row sm:items-center sm:justify-between"
          >
            <span>
              Fahrerzeile von Position {removedRow.index + 1} wurde
              entfernt.
            </span>
            <button
              type="button"
              onClick={undoRemove}
              className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-blue-400/50 px-4 font-semibold text-blue-100"
            >
              <Undo2 size={17} />
              Rückgängig
            </button>
          </div>
        ) : null}

        <section className="rounded-2xl border border-blue-500/25 bg-blue-500/5 p-4">
          <div className="mb-4 flex items-center gap-2">
            <CheckCircle2 className="text-blue-400" size={20} />
            <h3 className="font-semibold text-white">
              Live-Vorschau
            </h3>
          </div>
          <div className="grid gap-2">
            {preview.map(({ result, row, points }) => {
              const driver = data.drivers.find(
                (candidate) =>
                  candidate.id === Number(row?.driverId),
              );
              return (
                <div
                  key={result.key}
                  className="grid grid-cols-[42px_1fr_auto] items-center gap-3 rounded-xl bg-slate-950/50 px-3 py-2"
                >
                  <span className="font-mono font-bold text-blue-300">
                    {result.finalPosition
                      ? `P${result.finalPosition}`
                      : "–"}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate font-medium text-white">
                      {driver?.name || "Fahrer auswählen"}
                    </p>
                    <p className="text-xs text-slate-400">
                      Effektive Strafe:{" "}
                      {result.effectiveStatus === ResultStatus.Dsq
                        ? "DSQ"
                        : `+${formatTiming(
                            result.effectivePenaltyMs,
                          ) || "0.000"}`}
                    </p>
                  </div>
                  <span className="text-right text-sm text-slate-300">
                    {points.driverBase + points.driverBonus} Pkt.
                  </span>
                </div>
              );
            })}
          </div>
          {teamPoints.size > 0 ? (
            <div className="mt-4 flex flex-wrap gap-2">
              {[...teamPoints.entries()].map(([teamId, points]) => (
                <span
                  key={teamId}
                  className="rounded-full border border-slate-700 px-3 py-1 text-xs text-slate-300"
                >
                  {
                    data.teams.find((team) => team.id === teamId)
                      ?.shortName
                  }
                  : {points} Pkt.
                </span>
              ))}
            </div>
          ) : null}
        </section>

        {data.selected.race.season.archived ? (
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <input
              type="checkbox"
              checked={allowArchived}
              onChange={(event) =>
                setAllowArchived(event.target.checked)
              }
              className="h-5 w-5 accent-amber-500"
            />
            Bearbeitung der archivierten Saison erlauben
          </label>
        ) : null}
        {published ||
        existingSession?.lockedAt ||
        data.selected.race.status === "COMPLETED" ? (
          <label className="flex min-h-12 items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            <input
              type="checkbox"
              checked={confirmLockedEdit}
              onChange={(event) =>
                setConfirmLockedEdit(event.target.checked)
              }
              className="h-5 w-5 accent-red-500"
            />
            Veröffentlichtes Ergebnis bewusst bearbeiten und
            Meisterschaft neu berechnen
          </label>
        ) : null}

        <ActionMessage state={state} />
        <div className="sticky bottom-[calc(4.75rem+env(safe-area-inset-bottom))] z-30 grid gap-2 rounded-2xl border border-blue-500/25 bg-[#0b1119]/95 p-3 shadow-[0_20px_60px_rgba(0,0,0,0.5)] backdrop-blur sm:grid-cols-3 lg:bottom-3">
          <button
            name="intent"
            value="DRAFT"
            disabled={
              pending ||
              published ||
              hasDuplicateDriver ||
              Boolean(normalizedGaps.error)
            }
            className="wizard-secondary-button min-h-12 justify-center"
          >
            Als Entwurf speichern
          </button>
          <button
            name="intent"
            value="VALIDATE"
            disabled={
              pending ||
              hasDuplicateDriver ||
              hasIncompleteDriverRow ||
              Boolean(normalizedGaps.error)
            }
            className="wizard-secondary-button min-h-12 justify-center"
          >
            Ergebnis prüfen
          </button>
          <button
            name="intent"
            value="PUBLISH"
            disabled={
              pending ||
              hasDuplicateDriver ||
              hasIncompleteDriverRow ||
              Boolean(normalizedGaps.error) ||
              selectedDriverIds.length === 0
            }
            className="wizard-primary-button min-h-12 justify-center"
          >
            {pending
              ? "Verarbeitet…"
              : "Ergebnis veröffentlichen"}
          </button>
        </div>
      </form>

      {existingSession ? (
        <DeleteResultForm
          raceId={data.selected.race.id}
          leagueId={data.selected.race.season.league.id}
          session={session}
          locked={
            published ||
            Boolean(existingSession.lockedAt) ||
            data.selected.race.status === "COMPLETED"
          }
        />
      ) : null}
    </div>
  );
}

type SharedRowProps = {
  row: RowState;
  index: number;
  rows: RowState[];
  data: ResultAdminData;
  calculation: ReturnType<
    typeof calculateFinalClassification
  >[number] | undefined;
  fastest: boolean;
  imported: ReturnType<typeof aggregateFiaPenalties>;
  onUpdate: (patch: Partial<RowState>) => void;
  onSelectDriver: (driverId: number) => void;
  onMove: (direction: -1 | 1) => void;
  onRemove: () => void;
};

function DriverPicker({
  row,
  rows,
  data,
  onUpdate,
  onSelectDriver,
  compact = false,
}: Pick<
  SharedRowProps,
  "row" | "rows" | "data" | "onUpdate" | "onSelectDriver"
> & { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const selectedIds = new Set(
    rows
      .filter((candidate) => candidate.key !== row.key)
      .map((candidate) => Number(candidate.driverId)),
  );
  const suggestions = data.drivers
    .filter(
      (driver) =>
        !selectedIds.has(driver.id) &&
        matchesDriverSearch(driver, row.driverQuery),
    )
    .slice(0, 8);

  return (
    <div className="relative">
      <span className="relative block">
        <Search
          size={15}
          className="pointer-events-none absolute left-3 top-3 text-slate-500"
        />
        <input
          data-result-cell
          value={row.driverQuery}
          onFocus={() => setOpen(true)}
          onBlur={() => window.setTimeout(() => setOpen(false), 120)}
          onChange={(event) => {
            onUpdate({
              driverQuery: event.target.value,
              driverId: "",
              representedTeamId: "",
            });
            setOpen(true);
          }}
          placeholder="Fahrer suchen"
          className={`form-control pl-9 ${
            compact ? "min-h-11" : "min-w-60"
          }`}
        />
      </span>
      {open && row.driverQuery ? (
        <div
          className={`absolute z-50 mt-1 max-h-72 w-full overflow-y-auto rounded-xl border border-slate-700 bg-slate-950 p-1 shadow-2xl ${
            compact ? "min-w-0" : "min-w-72"
          }`}
        >
          {suggestions.map((driver) => (
            <button
              key={driver.id}
              type="button"
              onMouseDown={(event) => event.preventDefault()}
              onClick={() => {
                onSelectDriver(driver.id);
                setOpen(false);
              }}
              className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 py-2 text-left hover:bg-slate-800"
            >
              <span>{driver.flag}</span>
              <span className="min-w-0">
                <span className="block truncate font-medium text-white">
                  #{driver.number} {driver.name}
                </span>
                <span className="block truncate text-xs text-slate-400">
                  {driver.discordName || "Kein Discord-Name"}
                  {driver.replacement ? " · Ersatzfahrer" : ""}
                </span>
              </span>
            </button>
          ))}
          {suggestions.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-400">
              Kein verfügbarer Fahrer gefunden.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

function PenaltyEditor({
  row,
  data,
  imported,
  onUpdate,
}: Pick<
  SharedRowProps,
  "row" | "data" | "imported" | "onUpdate"
>) {
  const tickets = data.fiaPenalties.filter(
    (penalty) => imported.decisionIds.includes(penalty.decisionId),
  );
  return (
    <div className="space-y-2 text-xs">
      <div className="rounded-lg border border-slate-700 bg-slate-950/50 p-2">
        <p className="font-semibold text-blue-300">
          Von FIA übernommen
        </p>
        <p className="mt-1 text-slate-300">
          {imported.disqualified
            ? "DSQ"
            : imported.penaltyMilliseconds > 0
              ? `+${formatTiming(imported.penaltyMilliseconds)}`
              : "Keine ergebniswirksame Zeitstrafe"}
        </p>
        {tickets.map((ticket) => (
          <Link
            key={ticket.ticketId}
            href={`/fia/${ticket.ticketId}`}
            className="mt-1 block text-blue-400 hover:underline"
          >
            FIA-Ticket #{ticket.ticketId}
          </Link>
        ))}
      </div>
      <label className="flex min-h-9 items-center gap-2 text-slate-300">
        <input
          type="checkbox"
          checked={row.manualOverride}
          onChange={(event) =>
            onUpdate({ manualOverride: event.target.checked })
          }
          className="h-4 w-4 accent-blue-500"
        />
        Manuell angepasst
      </label>
      {row.manualOverride ? (
        <div className="grid gap-2">
          <input
            data-result-cell
            type="number"
            min="0"
            step="0.001"
            value={row.manualPenaltySeconds}
            onChange={(event) =>
              onUpdate({
                manualPenaltySeconds: event.target.value,
              })
            }
            aria-label="Manuelle Zeitstrafe in Sekunden"
            className="form-control"
          />
          <label className="flex min-h-9 items-center gap-2 text-red-200">
            <input
              type="checkbox"
              checked={row.manualDisqualified}
              onChange={(event) =>
                onUpdate({
                  manualDisqualified: event.target.checked,
                })
              }
              className="h-4 w-4 accent-red-500"
            />
            DSQ
          </label>
          <input
            data-result-cell
            value={row.manualOverrideReason}
            onChange={(event) =>
              onUpdate({
                manualOverrideReason: event.target.value,
              })
            }
            placeholder="Begründung"
            className="form-control"
          />
        </div>
      ) : null}
    </div>
  );
}

function DesktopRow({
  row,
  index,
  rows,
  data,
  calculation,
  fastest,
  imported,
  onUpdate,
  onSelectDriver,
  onMove,
  onRemove,
  onDragStart,
  onDrop,
}: SharedRowProps & {
  onDragStart: () => void;
  onDrop: () => void;
}) {
  const driver = data.drivers.find(
    (candidate) => candidate.id === Number(row.driverId),
  );
  const team = data.teams.find(
    (candidate) =>
      candidate.id === Number(row.representedTeamId),
  );
  return (
    <tr
      draggable
      onDragStart={onDragStart}
      onDragOver={(event) => event.preventDefault()}
      onDrop={onDrop}
      className="border-t border-slate-800 align-top hover:bg-slate-900/50"
    >
      <td className="sticky left-0 z-10 bg-slate-950 px-3 py-3">
        <div className="flex items-center gap-2">
          <GripVertical
            size={16}
            className="cursor-grab text-slate-600"
          />
          <span className="font-mono font-bold text-blue-300">
            {index + 1}
          </span>
        </div>
      </td>
      <td className="sticky left-20 z-10 bg-slate-950 px-3 py-3">
        <DriverPicker
          row={row}
          rows={rows}
          data={data}
          onUpdate={onUpdate}
          onSelectDriver={onSelectDriver}
        />
        {driver?.replacement ? (
          <span className="mt-1 inline-block rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] text-amber-200">
            Ersatzfahrer
          </span>
        ) : null}
      </td>
      <td className="px-3 py-4 font-mono text-slate-300">
        {driver ? `#${driver.number}` : "–"}
      </td>
      <td className="px-3 py-4 text-lg">{driver?.flag ?? "–"}</td>
      <td className="px-3 py-3">
        <select
          data-result-cell
          value={row.representedTeamId}
          onChange={(event) =>
            onUpdate({ representedTeamId: event.target.value })
          }
          className="form-control min-w-36"
        >
          <option value="">Team</option>
          {data.teams.map((item) => (
            <option key={item.id} value={item.id}>
              {item.shortName}
            </option>
          ))}
        </select>
        {team ? (
          <span className="mt-1 block truncate text-xs text-slate-500">
            {team.name}
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <select
          data-result-cell
          value={row.status}
          onChange={(event) =>
            onUpdate({
              status: event.target.value as ResultStatus,
            })
          }
          className="form-control"
        >
          {Object.values(ResultStatus)
            .filter((status) => status !== ResultStatus.Retired)
            .map((status) => (
              <option key={status} value={status}>
                {resultStatusLabels[status]}
              </option>
            ))}
        </select>
      </td>
      <td className="px-3 py-3">
        <input
          data-result-cell
          value={row.gapInput}
          onChange={(event) =>
            onUpdate({ gapInput: event.target.value })
          }
          placeholder={index === 0 ? "Sieger" : "+4.321"}
          className="form-control"
        />
      </td>
      <td className="px-3 py-3">
        <input
          data-result-cell
          value={row.fastestLapInput}
          onChange={(event) =>
            onUpdate({ fastestLapInput: event.target.value })
          }
          placeholder="1:21.456"
          className={`form-control ${
            fastest ? "border-violet-400 text-violet-200" : ""
          }`}
        />
        {fastest ? (
          <span className="mt-1 block text-xs text-violet-300">
            Schnellste Runde
          </span>
        ) : null}
      </td>
      <td className="px-3 py-3">
        <PenaltyEditor
          row={row}
          data={data}
          imported={imported}
          onUpdate={onUpdate}
        />
      </td>
      <td className="px-3 py-4">
        <p className="font-mono font-bold text-white">
          {calculation?.finalPosition
            ? `P${calculation.finalPosition}`
            : calculation?.effectiveStatus ?? "–"}
        </p>
        <p className="mt-1 text-xs text-slate-500">
          {calculation?.adjustedTimeMs !== null &&
          calculation?.adjustedTimeMs !== undefined
            ? `+${formatTiming(calculation.adjustedTimeMs)}`
            : ""}
        </p>
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-1">
          <button
            type="button"
            onClick={() => onMove(-1)}
            disabled={index === 0}
            aria-label="Fahrer nach oben"
            className="min-h-10 min-w-10 rounded-lg border border-slate-700 p-2 disabled:opacity-30"
          >
            <ArrowUp size={16} />
          </button>
          <button
            type="button"
            onClick={() => onMove(1)}
            disabled={index === rows.length - 1}
            aria-label="Fahrer nach unten"
            className="min-h-10 min-w-10 rounded-lg border border-slate-700 p-2 disabled:opacity-30"
          >
            <ArrowDown size={16} />
          </button>
          <button
            type="button"
            onClick={onRemove}
            disabled={rows.length === 1}
            aria-label="Fahrer entfernen"
            className="min-h-10 min-w-10 rounded-lg border border-red-500/30 p-2 text-red-300 disabled:opacity-30"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </td>
    </tr>
  );
}

function MobileRow(props: SharedRowProps) {
  const {
    row,
    index,
    rows,
    data,
    calculation,
    imported,
    onUpdate,
    onSelectDriver,
    onMove,
    onRemove,
  } = props;
  const team = data.teams.find(
    (candidate) =>
      candidate.id === Number(row.representedTeamId),
  );
  return (
    <article className="overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/40">
      <div className="space-y-3 p-4">
        <div className="flex items-center justify-between gap-3">
          <span className="rounded-lg bg-blue-500/15 px-3 py-2 font-mono font-bold text-blue-200">
            P{index + 1}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => onMove(-1)}
              disabled={index === 0}
              aria-label="Fahrer nach oben"
              className="min-h-12 min-w-12 rounded-xl border border-slate-700 p-2 disabled:opacity-30"
            >
              <ArrowUp className="mx-auto" size={18} />
            </button>
            <button
              type="button"
              onClick={() => onMove(1)}
              disabled={index === rows.length - 1}
              aria-label="Fahrer nach unten"
              className="min-h-12 min-w-12 rounded-xl border border-slate-700 p-2 disabled:opacity-30"
            >
              <ArrowDown className="mx-auto" size={18} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              disabled={rows.length === 1}
              aria-label="Fahrer entfernen"
              className="min-h-12 min-w-12 rounded-xl border border-red-500/30 p-2 text-red-200 disabled:opacity-30"
            >
              <Trash2 className="mx-auto" size={18} />
            </button>
          </div>
        </div>
        <DriverPicker
          row={row}
          rows={rows}
          data={data}
          onUpdate={onUpdate}
          onSelectDriver={onSelectDriver}
          compact
        />
        <div className="grid grid-cols-2 gap-3 text-sm">
          <label className="master-label">
            Status
            <select
              value={row.status}
              onChange={(event) =>
                onUpdate({
                  status: event.target.value as ResultStatus,
                })
              }
              className="form-control mt-1 min-h-11"
            >
              {Object.values(ResultStatus)
                .filter(
                  (status) => status !== ResultStatus.Retired,
                )
                .map((status) => (
                  <option key={status} value={status}>
                    {resultStatusLabels[status]}
                  </option>
                ))}
            </select>
          </label>
          <label className="master-label">
            Abstand
            <input
              value={row.gapInput}
              onChange={(event) =>
                onUpdate({ gapInput: event.target.value })
              }
              placeholder={index === 0 ? "Sieger" : "+4.321"}
              className="form-control mt-1 min-h-11"
            />
          </label>
        </div>
        <div className="grid grid-cols-2 gap-3 rounded-xl bg-slate-900/60 p-3 text-sm">
          <div>
            <p className="text-xs text-slate-500">Team</p>
            <p className="mt-1 truncate text-white">
              {team?.shortName ?? "–"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">Endposition</p>
            <p className="mt-1 font-mono font-bold text-blue-200">
              {calculation?.finalPosition
                ? `P${calculation.finalPosition}`
                : calculation?.effectiveStatus ?? "–"}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              Effektive Strafe
            </p>
            <p className="mt-1 text-white">
              {calculation?.effectiveStatus === ResultStatus.Dsq
                ? "DSQ"
                : `+${formatTiming(
                    calculation?.effectivePenaltyMs ?? 0,
                  )}`}
            </p>
          </div>
          <div>
            <p className="text-xs text-slate-500">
              FIA-Strafe
            </p>
            <p className="mt-1 text-blue-200">
              {imported.disqualified
                ? "DSQ"
                : `+${formatTiming(
                    imported.penaltyMilliseconds,
                  )}`}
            </p>
          </div>
        </div>
      </div>
      <details className="border-t border-slate-800">
        <summary className="min-h-12 cursor-pointer px-4 py-3 text-sm font-semibold text-slate-300">
          Weitere Angaben
        </summary>
        <div className="space-y-4 p-4 pt-1">
          <label className="master-label">
            Team
            <select
              value={row.representedTeamId}
              onChange={(event) =>
                onUpdate({
                  representedTeamId: event.target.value,
                })
              }
              className="form-control mt-2 min-h-12"
            >
              <option value="">Team wählen</option>
              {data.teams.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.shortName} · {item.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Schnellste Runde
            <input
              value={row.fastestLapInput}
              onChange={(event) =>
                onUpdate({
                  fastestLapInput: event.target.value,
                })
              }
              placeholder="1:21.456"
              className="form-control mt-2 min-h-12"
            />
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="master-label">
              Startposition
              <input
                type="number"
                min="1"
                value={row.startingPosition}
                onChange={(event) =>
                  onUpdate({
                    startingPosition: event.target.value,
                  })
                }
                className="form-control mt-2 min-h-12"
              />
            </label>
            <label className="master-label">
              Runden
              <input
                type="number"
                min="0"
                value={row.lapsCompleted}
                onChange={(event) =>
                  onUpdate({
                    lapsCompleted: event.target.value,
                  })
                }
                className="form-control mt-2 min-h-12"
              />
            </label>
          </div>
          <PenaltyEditor
            row={row}
            data={data}
            imported={imported}
            onUpdate={onUpdate}
          />
          <label className="master-label">
            Notiz
            <textarea
              value={row.notes}
              onChange={(event) =>
                onUpdate({ notes: event.target.value })
              }
              rows={3}
              className="form-control mt-2"
            />
          </label>
        </div>
      </details>
    </article>
  );
}

function DeleteResultForm({
  raceId,
  leagueId,
  session,
  locked,
}: {
  raceId: number;
  leagueId: number;
  session: ResultSession;
  locked: boolean;
}) {
  const deleteAction = deleteResultsAction.bind(
    null,
    raceId,
    leagueId,
    session,
  );
  const [state, action, pending] = useActionState(
    deleteAction,
    initialSportsActionState,
  );
  return (
    <form
      action={action}
      onSubmit={(event) => {
        if (
          !window.confirm(
            "Diese komplette Ergebnis-Sitzung wirklich löschen?",
          )
        ) {
          event.preventDefault();
        }
      }}
      className="flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between"
    >
      <ActionMessage state={state} />
      {locked ? (
        <label className="flex min-h-11 items-center gap-2 text-sm text-red-200">
          <input
            type="checkbox"
            name="confirmLockedEdit"
            className="h-5 w-5 accent-red-500"
          />
          Löschung trotz Sperre bestätigen
        </label>
      ) : null}
      <button
        disabled={pending}
        className="min-h-12 rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-200"
      >
        {pending ? "Löscht…" : "Komplettes Ergebnis löschen"}
      </button>
    </form>
  );
}
