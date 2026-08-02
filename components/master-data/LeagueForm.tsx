"use client";

import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";

import { useState } from "react";
import { updateLeagueAction } from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type LeagueAdminItem,
} from "@/lib/master-data/types";
import ActionMessage from "./ActionMessage";
import {
  calculateLeagueRaceSchedule,
  formatStartMinute,
  weekdayLabels,
} from "@/lib/races/scheduling";

const commonTimezones = [
  "Europe/Berlin",
  "Europe/London",
  "Europe/Paris",
  "America/New_York",
  "America/Sao_Paulo",
  "Asia/Tokyo",
  "Australia/Melbourne",
  "UTC",
];

export default function LeagueForm({
  league,
}: {
  league: LeagueAdminItem;
}) {
  const [raceWeekday, setRaceWeekday] = useState(league.raceWeekday);
  const [raceStartTime, setRaceStartTime] = useState(
    formatStartMinute(league.raceStartMinute),
  );
  const [raceTimezone, setRaceTimezone] = useState(league.raceTimezone);
  const [deadlineHours, setDeadlineHours] = useState(
    league.defaultAttendanceDeadlineMinutes === null
      ? ""
      : String(league.defaultAttendanceDeadlineMinutes / 60),
  );
  const [updateFutureSchedules, setUpdateFutureSchedules] =
    useState(false);
  const action = updateLeagueAction.bind(null, league.id);
  const [state, formAction, pending] = useActionState(
    action,
    initialMasterDataActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="master-label">
          Code
          <input value={league.code} disabled className="form-control mt-2 opacity-60" />
        </label>
        <label className="master-label">
          Name
          <input
            name="name"
            defaultValue={league.name}
            required
            maxLength={160}
            className="form-control mt-2"
          />
        </label>
      </div>
      <label className="master-label">
        Beschreibung
        <textarea
          name="description"
          defaultValue={league.description ?? ""}
          rows={3}
          maxLength={5000}
          className="form-control mt-2"
        />
      </label>
      <section className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-4">
        <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
          Rennzeit
        </p>
        <div className="mt-3 grid gap-4 sm:grid-cols-2">
          <label className="master-label">
            Wochentag
            <select
              name="raceWeekday"
              value={raceWeekday}
              onChange={(event) =>
                setRaceWeekday(Number(event.target.value))
              }
              className="form-control mt-2"
            >
              {weekdayLabels.map((label, index) => (
                <option key={label} value={index + 1}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Startzeit
            <input
              type="time"
              name="raceStartTime"
              value={raceStartTime}
              onChange={(event) => setRaceStartTime(event.target.value)}
              required
              className="form-control mt-2"
            />
          </label>
          <label className="master-label">
            Zeitzone
            <input
              name="raceTimezone"
              list={`league-timezones-${league.id}`}
              value={raceTimezone}
              onChange={(event) => setRaceTimezone(event.target.value)}
              required
              className="form-control mt-2"
            />
            <datalist id={`league-timezones-${league.id}`}>
              {commonTimezones.map((timezone) => (
                <option key={timezone} value={timezone} />
              ))}
            </datalist>
          </label>
          <label className="master-label">
            Standard-Anmeldeschluss
            <input
              type="number"
              name="defaultAttendanceDeadlineHours"
              value={deadlineHours}
              onChange={(event) => setDeadlineHours(event.target.value)}
              min={0}
              max={720}
              placeholder="z. B. 24"
              className="form-control mt-2"
            />
            <span className="mt-2 block text-xs font-normal text-slate-500">
              Stunden vor dem Liga-Start; leer bedeutet kein automatischer
              Anmeldeschluss.
            </span>
          </label>
          <label className="master-label sm:col-span-2">
            Reihenfolge
            <input
              type="number"
              name="displayOrder"
              defaultValue={league.displayOrder}
              min={0}
              max={999}
              className="form-control mt-2"
            />
          </label>
        </div>
      </section>
      {league.futureSchedules.length > 0 ? (
        <section className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-4">
          <label className="flex items-start gap-3 text-sm text-slate-200">
            <input
              type="checkbox"
              name="updateFutureSchedules"
              checked={updateFutureSchedules}
              onChange={(event) =>
                setUpdateFutureSchedules(event.target.checked)
              }
              className="mt-0.5 size-4 accent-amber-500"
            />
            <span>
              Neue Zeit auch auf zukünftige, nicht abgeschlossene
              Liga-Termine anwenden
            </span>
          </label>
          {updateFutureSchedules ? (
            <div className="mt-4 space-y-3 border-t border-amber-500/15 pt-4">
              <p className="text-xs font-bold uppercase tracking-[0.15em] text-amber-300">
                Vorschau · {league.futureSchedules.length} Termine
              </p>
              <div className="max-h-52 space-y-2 overflow-y-auto">
                {league.futureSchedules.map((schedule) => {
                  let preview = "Ungültige Zeitkonfiguration";
                  try {
                    const calculated = calculateLeagueRaceSchedule(
                      schedule.weekendDate,
                      {
                        raceWeekday,
                        raceStartMinute:
                          Number(raceStartTime.slice(0, 2)) * 60 +
                          Number(raceStartTime.slice(3, 5)),
                        raceTimezone,
                        defaultAttendanceDeadlineMinutes:
                          deadlineHours === ""
                            ? null
                            : Number(deadlineHours) * 60,
                      },
                    );
                    preview = new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                      timeZone: calculated.timezone,
                    }).format(calculated.scheduledAt);
                  } catch {
                    // The server performs the authoritative validation.
                  }
                  return (
                    <div
                      key={schedule.id}
                      className="flex flex-col gap-1 rounded-xl border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs sm:flex-row sm:items-center sm:justify-between"
                    >
                      <span className="text-slate-300">
                        R{schedule.round} · {schedule.raceName}
                      </span>
                      <span className="font-semibold text-amber-200">
                        → {preview}
                      </span>
                    </div>
                  );
                })}
              </div>
              <label className="flex items-start gap-3 text-sm font-semibold text-amber-100">
                <input
                  type="checkbox"
                  name="confirmFutureScheduleUpdate"
                  required
                  className="mt-0.5 size-4 accent-amber-500"
                />
                Vorschau geprüft und Terminaktualisierung bestätigt
              </label>
            </div>
          ) : null}
        </section>
      ) : null}
      <label className="master-label">
        Aktuelle Saison
        <select
          name="currentSeasonId"
          defaultValue={league.currentSeasonId ?? ""}
          className="form-control mt-2"
        >
          <option value="">Keine aktuelle Saison</option>
          {league.seasons.map((season) => (
            <option
              key={season.id}
              value={season.id}
              disabled={!season.active || season.archived}
            >
              {season.name}
              {season.archived
                ? " (archiviert)"
                : season.active
                  ? ""
                  : " (inaktiv)"}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name="active"
          defaultChecked={league.active}
          className="h-4 w-4 accent-blue-600"
        />
        Liga aktiv
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button disabled={pending} className="wizard-primary-button">
          {pending ? "Speichert…" : "Liga speichern"}
        </button>
      </div>
    </form>
  );
}
