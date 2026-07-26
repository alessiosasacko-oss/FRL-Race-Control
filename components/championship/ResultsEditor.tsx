"use client";

import { useActionState, useMemo, useState } from "react";
import {
  ArrowDown,
  ArrowUp,
  Plus,
  Search,
  Trash2,
} from "lucide-react";
import {
  ResultSession,
  ResultStatus,
  resultStatusLabels,
} from "@/domain";
import {
  deleteResultsAction,
  saveResultsAction,
} from "@/lib/championship/actions";
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
  driverId: string;
  representedTeamId: string;
  expectedDriverId: string;
  position: string;
  startingPosition: string;
  status: ResultStatus;
  gapToWinnerSeconds: string;
  gapToPreviousSeconds: string;
  totalTimeSeconds: string;
  fastestLap: boolean;
  polePosition: boolean;
  lapsCompleted: string;
  penaltySeconds: string;
  notes: string;
  substitute: boolean;
};

function seconds(milliseconds: number | null): string {
  return milliseconds === null ? "" : String(milliseconds / 1000);
}

function emptyRow(
  position: number,
  driver?: ResultAdminData["drivers"][number],
): RowState {
  return {
    driverId: driver ? String(driver.id) : "",
    representedTeamId: driver?.teamId ? String(driver.teamId) : "",
    expectedDriverId: "",
    position: String(position),
    startingPosition: "",
    status: ResultStatus.Finished,
    gapToWinnerSeconds: "",
    gapToPreviousSeconds: "",
    totalTimeSeconds: "",
    fastestLap: false,
    polePosition: false,
    lapsCompleted: "0",
    penaltySeconds: "0",
    notes: "",
    substitute: false,
  };
}

function optionalNumber(value: string): number | null {
  return value.trim() === "" ? null : Number(value);
}

export default function ResultsEditor({
  data,
  session,
}: ResultsEditorProps) {
  const existingSession = data.selected?.sessions.find(
    (item) => item.session === session,
  );
  const [rows, setRows] = useState<RowState[]>(() =>
    existingSession?.results.length
      ? existingSession.results.map((result) => ({
          driverId: String(result.driverId),
          representedTeamId: String(result.representedTeamId),
          expectedDriverId: result.expectedDriverId
            ? String(result.expectedDriverId)
            : "",
          position: result.position ? String(result.position) : "",
          startingPosition: result.startingPosition
            ? String(result.startingPosition)
            : "",
          status: result.status,
          gapToWinnerSeconds: seconds(result.gapToWinnerMs),
          gapToPreviousSeconds: seconds(result.gapToPreviousMs),
          totalTimeSeconds: seconds(result.totalTimeMs),
          fastestLap: result.fastestLap,
          polePosition: result.polePosition,
          lapsCompleted: String(result.lapsCompleted),
          penaltySeconds: String(result.penaltySeconds),
          notes: result.notes ?? "",
          substitute: result.substitute,
        }))
      : [emptyRow(1)],
  );
  const [driverSearch, setDriverSearch] = useState("");
  const [allowArchived, setAllowArchived] = useState(false);
  const [confirmLockedEdit, setConfirmLockedEdit] = useState(false);
  const [lockAfterSave, setLockAfterSave] = useState(
    Boolean(existingSession?.lockedAt),
  );
  const [state, action, pending] = useActionState(
    saveResultsAction,
    initialSportsActionState,
  );
  const deleteAction = deleteResultsAction.bind(
    null,
    data.selected?.race.id ?? 0,
    data.selected?.race.season.league.id ?? 0,
    session,
  );
  const [deleteState, deleteFormAction, deletePending] =
    useActionState(deleteAction, initialSportsActionState);
  const selectedDriverIds = useMemo(
    () => rows.map((row) => row.driverId).filter(Boolean),
    [rows],
  );
  const visibleDrivers = useMemo(() => {
    const search = driverSearch.toLocaleLowerCase("de-DE");
    if (!search) return data.drivers;
    return data.drivers.filter(
      (driver) =>
        selectedDriverIds.includes(String(driver.id)) ||
        [
          driver.name,
          driver.discordName,
          driver.number,
          driver.teamName,
        ]
          .filter(Boolean)
          .some((value) =>
            String(value)
              .toLocaleLowerCase("de-DE")
              .includes(search),
          ),
    );
  }, [data.drivers, driverSearch, selectedDriverIds]);
  const hasDuplicateDriver =
    new Set(selectedDriverIds).size !== selectedDriverIds.length;
  const selectedPositions = rows
    .map((row) => row.position)
    .filter(Boolean);
  const hasDuplicatePosition =
    new Set(selectedPositions).size !== selectedPositions.length;
  const submission = {
    leagueId: data.selected?.race.season.league.id ?? 0,
    raceId: data.selected?.race.id ?? 0,
    session,
    allowArchived,
    confirmLockedEdit,
    lockAfterSave,
    results: rows.map((row) => ({
      driverId: Number(row.driverId),
      representedTeamId: Number(row.representedTeamId),
      expectedDriverId: optionalNumber(row.expectedDriverId),
      position: optionalNumber(row.position),
      startingPosition: optionalNumber(row.startingPosition),
      status: row.status,
      gapToWinnerSeconds: optionalNumber(row.gapToWinnerSeconds),
      gapToPreviousSeconds: optionalNumber(row.gapToPreviousSeconds),
      totalTimeSeconds: optionalNumber(row.totalTimeSeconds),
      fastestLap: row.fastestLap,
      polePosition: row.polePosition,
      lapsCompleted: Number(row.lapsCompleted),
      penaltySeconds: Number(row.penaltySeconds),
      notes: row.notes || null,
      substitute: row.substitute,
    })),
  };

  function updateRow(index: number, patch: Partial<RowState>): void {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, ...patch } : row,
      ),
    );
  }

  function selectDriver(index: number, driverId: string): void {
    const driver = data.drivers.find(
      (item) => item.id === Number(driverId),
    );
    updateRow(index, {
      driverId,
      representedTeamId: driver?.teamId
        ? String(driver.teamId)
        : "",
    });
  }

  function moveRow(index: number, direction: -1 | 1): void {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    setRows((current) => {
      const next = [...current];
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((row, rowIndex) => ({
        ...row,
        position: String(rowIndex + 1),
      }));
    });
  }

  if (!data.selected) return null;

  return (
    <div className="space-y-5">
      <label className="master-label">
        Fahrer durchsuchen
        <span className="relative mt-2 block">
          <Search
            size={17}
            className="absolute left-3 top-3.5 text-slate-500"
          />
          <input
            type="search"
            value={driverSearch}
            onChange={(event) => setDriverSearch(event.target.value)}
            placeholder="Name, Discord, Nummer oder Team"
            className="form-control pl-10"
          />
        </span>
      </label>

      {(hasDuplicateDriver || hasDuplicatePosition) && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
          {hasDuplicateDriver
            ? "Ein Fahrer wurde mehrfach ausgewählt. "
            : ""}
          {hasDuplicatePosition
            ? "Eine Zielposition wurde mehrfach vergeben."
            : ""}
        </div>
      )}

      <form action={action} className="space-y-4">
        <input
          type="hidden"
          name="submission"
          value={JSON.stringify(submission)}
        />
        {rows.map((row, index) => (
          <fieldset
            key={index}
            className="rounded-2xl border border-slate-800 bg-slate-950/35 p-4"
          >
            <legend className="px-2 text-sm font-semibold text-blue-300">
              Ergebniszeile {index + 1}
            </legend>
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <label className="master-label xl:col-span-2">
                Fahrer
                <select
                  value={row.driverId}
                  onChange={(event) =>
                    selectDriver(index, event.target.value)
                  }
                  required
                  className="form-control mt-2"
                >
                  <option value="">Fahrer wählen</option>
                  {visibleDrivers.map((driver) => (
                    <option key={driver.id} value={driver.id}>
                      {driver.flag} #{driver.number} {driver.name}
                      {driver.discordName
                        ? ` · ${driver.discordName}`
                        : ""}
                      {driver.teamName ? ` · ${driver.teamName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="master-label">
                Vertretenes Team
                <select
                  value={row.representedTeamId}
                  onChange={(event) =>
                    updateRow(index, {
                      representedTeamId: event.target.value,
                    })
                  }
                  required
                  className="form-control mt-2"
                >
                  <option value="">Team wählen</option>
                  {data.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.shortName} · {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className="master-label">
                Status
                <select
                  value={row.status}
                  onChange={(event) =>
                    updateRow(index, {
                      status: event.target.value as ResultStatus,
                    })
                  }
                  className="form-control mt-2"
                >
                  {Object.values(ResultStatus).map((status) => (
                    <option key={status} value={status}>
                      {resultStatusLabels[status]}
                    </option>
                  ))}
                </select>
              </label>
              <NumberField
                label="Zielposition"
                value={row.position}
                onChange={(value) =>
                  updateRow(index, { position: value })
                }
              />
              <NumberField
                label="Startposition"
                value={row.startingPosition}
                onChange={(value) =>
                  updateRow(index, { startingPosition: value })
                }
              />
              <NumberField
                label="Runden"
                value={row.lapsCompleted}
                minimum={0}
                onChange={(value) =>
                  updateRow(index, { lapsCompleted: value })
                }
              />
              <NumberField
                label="Abstand Sieger (s)"
                value={row.gapToWinnerSeconds}
                minimum={0}
                step="0.001"
                onChange={(value) =>
                  updateRow(index, { gapToWinnerSeconds: value })
                }
              />
              <NumberField
                label="Abstand vorheriger (s)"
                value={row.gapToPreviousSeconds}
                minimum={0}
                step="0.001"
                onChange={(value) =>
                  updateRow(index, {
                    gapToPreviousSeconds: value,
                  })
                }
              />
              <NumberField
                label="Gesamtzeit (s)"
                value={row.totalTimeSeconds}
                minimum={0}
                step="0.001"
                onChange={(value) =>
                  updateRow(index, { totalTimeSeconds: value })
                }
              />
              <NumberField
                label="Zeitstrafe (s)"
                value={row.penaltySeconds}
                minimum={0}
                step="0.001"
                onChange={(value) =>
                  updateRow(index, { penaltySeconds: value })
                }
              />
              <label className="master-label xl:col-span-2">
                Notiz
                <input
                  value={row.notes}
                  onChange={(event) =>
                    updateRow(index, { notes: event.target.value })
                  }
                  maxLength={5000}
                  className="form-control mt-2"
                />
              </label>
              <div className="flex flex-wrap gap-3 xl:col-span-2">
                <Check
                  label="Schnellste Runde"
                  checked={row.fastestLap}
                  onChange={(checked) =>
                    updateRow(index, { fastestLap: checked })
                  }
                />
                <Check
                  label="Pole"
                  checked={row.polePosition}
                  onChange={(checked) =>
                    updateRow(index, { polePosition: checked })
                  }
                />
                <Check
                  label="Ersatzfahrer (EF)"
                  checked={row.substitute}
                  onChange={(checked) =>
                    updateRow(index, { substitute: checked })
                  }
                />
              </div>
              {row.substitute ? (
                <label className="master-label xl:col-span-2">
                  Ursprünglich erwarteter Fahrer
                  <select
                    value={row.expectedDriverId}
                    onChange={(event) =>
                      updateRow(index, {
                        expectedDriverId: event.target.value,
                      })
                    }
                    required
                    className="form-control mt-2"
                  >
                    <option value="">Stammfahrer wählen</option>
                    {data.drivers
                      .filter(
                        (driver) =>
                          String(driver.id) !== row.driverId,
                      )
                      .map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          #{driver.number} {driver.name}
                        </option>
                      ))}
                  </select>
                </label>
              ) : null}
            </div>
            <div className="mt-4 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => moveRow(index, -1)}
                aria-label="Zeile nach oben"
                className="wizard-secondary-button px-3 py-2"
              >
                <ArrowUp size={16} />
              </button>
              <button
                type="button"
                onClick={() => moveRow(index, 1)}
                aria-label="Zeile nach unten"
                className="wizard-secondary-button px-3 py-2"
              >
                <ArrowDown size={16} />
              </button>
              <button
                type="button"
                onClick={() =>
                  setRows((current) =>
                    current.filter((_, rowIndex) => rowIndex !== index),
                  )
                }
                disabled={rows.length === 1}
                className="rounded-xl border border-red-500/30 px-3 py-2 text-red-200 disabled:opacity-40"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </fieldset>
        ))}

        <button
          type="button"
          onClick={() =>
            setRows((current) => [
              ...current,
              emptyRow(current.length + 1),
            ])
          }
          className="wizard-secondary-button w-full"
        >
          <Plus size={17} />
          Ergebniszeile hinzufügen
        </button>

        {data.selected.race.season.archived ? (
          <label className="flex items-center gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            <input
              type="checkbox"
              checked={allowArchived}
              onChange={(event) =>
                setAllowArchived(event.target.checked)
              }
              className="accent-amber-500"
            />
            Bearbeitung der archivierten Saison ausdrücklich erlauben
          </label>
        ) : null}
        {existingSession &&
        (existingSession.lockedAt ||
          data.selected.race.status === "COMPLETED") ? (
          <label className="flex items-center gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-100">
            <input
              type="checkbox"
              checked={confirmLockedEdit}
              onChange={(event) =>
                setConfirmLockedEdit(event.target.checked)
              }
              className="accent-red-500"
            />
            Abgeschlossenes oder gesperrtes Ergebnis bewusst bearbeiten
          </label>
        ) : null}
        <label className="flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            checked={lockAfterSave}
            onChange={(event) =>
              setLockAfterSave(event.target.checked)
            }
            className="accent-blue-500"
          />
          Ergebnis nach dem Speichern sperren
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ActionMessage state={state} />
          <button
            disabled={
              pending ||
              hasDuplicateDriver ||
              hasDuplicatePosition
            }
            className="wizard-primary-button"
          >
            {pending ? "Speichert vollständig…" : "Alle Ergebnisse speichern"}
          </button>
        </div>
      </form>

      {existingSession ? (
        <form
          action={deleteFormAction}
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
          <ActionMessage state={deleteState} />
          {existingSession.lockedAt ||
          data.selected.race.status === "COMPLETED" ? (
            <label className="flex items-center gap-2 text-sm text-red-200">
              <input
                type="checkbox"
                name="confirmLockedEdit"
                className="accent-red-500"
              />
              Löschung trotz Sperre bestätigen
            </label>
          ) : null}
          <button
            disabled={deletePending}
            className="rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-200"
          >
            {deletePending ? "Löscht…" : "Komplettes Ergebnis löschen"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function NumberField({
  label,
  value,
  onChange,
  minimum = 1,
  step = "1",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  minimum?: number;
  step?: string;
}) {
  return (
    <label className="master-label">
      {label}
      <input
        type="number"
        min={minimum}
        step={step}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="form-control mt-2"
      />
    </label>
  );
}

function Check({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-2 rounded-xl border border-slate-700 px-3 py-2 text-sm text-slate-300">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="accent-blue-500"
      />
      {label}
    </label>
  );
}
