"use client";

import { useActionState, useState } from "react";
import {
  RaceStatus,
  raceStatusLabels,
} from "@/domain";
import {
  createRaceAction,
  deleteRaceAction,
  updateRaceAction,
} from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type RaceItem,
  type SeasonOption,
} from "@/lib/master-data/types";
import ActionMessage from "./ActionMessage";

type RaceFormProps = {
  seasons: SeasonOption[];
  tracks: Array<{ id: number; name: string; countryCode: string }>;
  race?: RaceItem;
};

export default function RaceForm({
  seasons,
  tracks,
  race,
}: RaceFormProps) {
  const [mystery, setMystery] = useState(race?.mystery ?? false);
  const [mysteryJustEnabled, setMysteryJustEnabled] = useState(false);
  const [circuit, setCircuit] = useState(race?.circuit ?? "");
  const [countryCode, setCountryCode] = useState(
    race?.countryCode ?? "DE",
  );
  const revealReached = race?.trackRevealed ?? false;
  const hideTrackFields =
    mystery && (!revealReached || mysteryJustEnabled);
  const saveAction = race
    ? updateRaceAction.bind(null, race.id)
    : createRaceAction;
  const deleteAction = deleteRaceAction.bind(null, race?.id ?? 0);
  const [state, formAction, pending] = useActionState(
    saveAction,
    initialMasterDataActionState,
  );
  const [deleteState, deleteFormAction, deletePending] = useActionState(
    deleteAction,
    initialMasterDataActionState,
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="master-label">
            Saison
            <select
              name="seasonId"
              defaultValue={race?.seasonId ?? seasons[0]?.id}
              className="form-control mt-2"
            >
              {seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Rennname
            <input
              name="name"
              defaultValue={race?.name ?? ""}
              required
              maxLength={160}
              placeholder="Belgium Grand Prix"
              className="form-control mt-2"
            />
          </label>
          <label className="master-label sm:col-span-2">
            Zentrale Strecke
            <select
              name="trackId"
              defaultValue={race?.trackId ?? ""}
              onChange={(event) => {
                const track = tracks.find((item) => item.id === Number(event.target.value));
                if (track && !mystery) {
                  setCircuit(track.name);
                  setCountryCode(track.countryCode);
                }
              }}
              className="form-control mt-2"
            >
              <option value="">Keine Streckendaten zuordnen</option>
              {tracks.map((track) => <option key={track.id} value={track.id}>{track.countryCode} · {track.name}</option>)}
            </select>
          </label>
          {!hideTrackFields ? (
            <>
              <label className="master-label">
                Strecke
                <input
                  name="circuit"
                  value={circuit}
                  onChange={(event) => setCircuit(event.target.value)}
                  required
                  maxLength={160}
                  placeholder="Circuit de Spa-Francorchamps"
                  className="form-control mt-2"
                />
              </label>
              <label className="master-label">
                Ländercode
                <input
                  name="countryCode"
                  value={countryCode}
                  onChange={(event) =>
                    setCountryCode(event.target.value.toUpperCase())
                  }
                  required
                  minLength={2}
                  maxLength={2}
                  className="form-control mt-2 uppercase"
                />
              </label>
            </>
          ) : null}
          <label className="master-label">
            Runde
            <input
              type="number"
              name="round"
              defaultValue={race?.round ?? ""}
              min={1}
              max={999}
              required
              className="form-control mt-2"
            />
          </label>
          <label className="master-label">
            Rennwochenende
            <input
              type="date"
              name="weekendDate"
              defaultValue={race?.weekendDate ?? ""}
              required
              className="form-control mt-2"
            />
            <span className="mt-2 block text-xs font-normal text-slate-500">
              Die Startzeiten werden automatisch aus den Liga-Zeitplänen
              berechnet.
            </span>
          </label>
          <label className="master-label sm:col-span-2">
            Rennstatus
            <select
              name="status"
              defaultValue={race?.status ?? RaceStatus.Scheduled}
              className="form-control mt-2"
            >
              {Object.values(RaceStatus).map((status) => (
                <option key={status} value={status}>
                  {raceStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
        </div>
        <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
          <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
            Liga-Termine
          </p>
          {race?.leagueSchedules.length ? (
            <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
              {race.leagueSchedules.map((schedule) => (
                <div
                  key={schedule.id}
                  className="rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2"
                >
                  <p className="font-semibold text-white">
                    {schedule.league.code}
                  </p>
                  <p className="text-xs text-slate-400">
                    {schedule.localStart.replace("T", " ")} ·{" "}
                    {schedule.timezone}
                  </p>
                  <ScheduleDeadlineOverride
                    leagueId={schedule.league.id}
                    defaultValue={schedule.attendanceDeadlineLocal}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-sm text-slate-400">
              Beim Speichern wird für jede aktive Liga genau ein Termin
              angelegt.
            </p>
          )}
        </section>
        <div className="grid gap-3 sm:grid-cols-3">
          <Check name="sprint" label="Sprint-Wochenende" checked={race?.sprint} />
          <Check
            name="doublePoints"
            label="Doppelte Punkte"
            checked={race?.doublePoints}
          />
          <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
            <input
              type="checkbox"
              name="mystery"
              checked={mystery}
              onChange={(event) => {
                const enabled = event.target.checked;
                setMystery(enabled);
                setMysteryJustEnabled(enabled);
                if (enabled) {
                  setCircuit("");
                  setCountryCode("");
                }
              }}
              className="h-4 w-4 accent-blue-600"
            />
            Mystery Track
          </label>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ActionMessage state={state} />
          <button disabled={pending} className="wizard-primary-button">
            {pending
              ? "Speichert…"
              : race
                ? "Rennen speichern"
                : "Rennen erstellen"}
          </button>
        </div>
      </form>
      {race ? (
        <form
          action={deleteFormAction}
          onSubmit={(event) => {
            if (!window.confirm("Dieses Rennen wirklich löschen?")) {
              event.preventDefault();
            }
          }}
          className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <ActionMessage state={deleteState} />
          <button
            disabled={deletePending}
            className="rounded-xl border border-red-500/40 px-5 py-3 text-sm font-semibold text-red-200 transition hover:bg-red-500/10 disabled:opacity-50"
          >
            {deletePending ? "Löscht…" : "Rennen löschen"}
          </button>
        </form>
      ) : null}
    </div>
  );
}

function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked?: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-900 p-4 text-sm text-slate-300">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="h-4 w-4 accent-blue-600"
      />
      {label}
    </label>
  );
}

function ScheduleDeadlineOverride({
  leagueId,
  defaultValue,
}: {
  leagueId: number;
  defaultValue: string;
}) {
  const [enabled, setEnabled] = useState(false);

  return (
    <div className="mt-2">
      <label className="flex items-center gap-2 text-[0.68rem] font-semibold text-slate-500">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => setEnabled(event.target.checked)}
          className="size-3.5 accent-blue-500"
        />
        Anmeldeschluss individuell ändern
      </label>
      {enabled ? (
        <input
          type="datetime-local"
          name={`attendanceDeadline-${leagueId}`}
          defaultValue={defaultValue}
          className="form-control mt-2 text-xs"
        />
      ) : null}
    </div>
  );
}
