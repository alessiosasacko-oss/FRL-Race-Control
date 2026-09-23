"use client";

import { useActionState } from "react";
import { RefreshCw, RotateCcw, Save } from "lucide-react";
import { resetDriverCareerAdjustmentsAction, resyncDriverCareerStatsAction, updateDriverCareerStatsAction, type CareerStatsActionState } from "@/lib/drivers/career-actions";
import type { DriverCareerStatsView } from "@/lib/drivers/career-stats";

const initialCareerStatsActionState: CareerStatsActionState = { status: "idle", message: "" };

function Message({ state }: { state: CareerStatsActionState }) {
  return <p role="status" aria-live="polite" className={`text-sm ${state.status === "error" ? "text-red-300" : state.status === "success" ? "text-emerald-300" : "text-slate-400"}`}>{state.message}</p>;
}

export default function DriverCareerStatsEditor({ driverId, stats, admin }: { driverId: number; stats: DriverCareerStatsView; admin: boolean }) {
  const [saveState, saveAction, saving] = useActionState(updateDriverCareerStatsAction.bind(null, driverId), initialCareerStatsActionState);
  const [syncState, syncAction, syncing] = useActionState(resyncDriverCareerStatsAction.bind(null, driverId), initialCareerStatsActionState);
  const [resetState, resetAction, resetting] = useActionState(resetDriverCareerAdjustmentsAction.bind(null, driverId), initialCareerStatsActionState);
  return (
    <details className="rounded-2xl border border-slate-800 bg-slate-950/35">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 font-bold text-white">Statistik bearbeiten</summary>
      <div className="space-y-5 border-t border-slate-800 p-4 sm:p-5">
        <form action={saveAction} className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[
              ["raceStarts", "Gefahrene Rennen", stats.raceStarts], ["wins", "Siege", stats.wins], ["podiums", "Podien", stats.podiums],
              ["poles", "Pole Positions", stats.poles], ["fastestLaps", "Fastest Laps", stats.fastestLaps], ["points", "Punkte", stats.points],
            ].map(([name, label, value]) => <label key={String(name)} className="master-label">{label}<input name={String(name)} type="number" min="0" step={name === "points" ? "0.5" : "1"} defaultValue={Number(value)} required className="form-control mt-2 min-h-11" /></label>)}
          </div>
          <label className="master-label">Erster GP<input name="firstGrandPrix" defaultValue={stats.firstGrandPrix ?? ""} readOnly={Boolean(stats.automatic.firstGrandPrix)} placeholder="S3 R1 Australien GP" className="form-control mt-2 min-h-11 read-only:opacity-60" />{stats.automatic.firstGrandPrix ? <span className="mt-1 block text-xs text-slate-500">Wird aus dem ältesten veröffentlichten Rennergebnis abgeleitet.</span> : null}</label>
          <label className="master-label">Vergangene Teams<textarea name="pastTeams" defaultValue={stats.pastTeams.join("\n")} rows={4} className="form-control mt-2" /><span className="mt-1 block text-xs text-slate-500">Ein Team pro Zeile. Automatisch erkannte Teams bleiben bei der Synchronisierung erhalten.</span></label>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Message state={saveState} /><button disabled={saving} className="wizard-primary-button min-h-11 justify-center"><Save size={17} />{saving ? "Speichert…" : "Statistik speichern"}</button></div>
        </form>
        {admin ? <div className="space-y-4 border-t border-slate-800 pt-5">
          <div className="rounded-xl bg-slate-900/60 p-4 text-xs leading-6 text-slate-300"><strong className="text-white">Manuelle Korrekturen:</strong> Starts {stats.adjustments.raceStarts >= 0 ? "+" : ""}{stats.adjustments.raceStarts}, Siege {stats.adjustments.wins >= 0 ? "+" : ""}{stats.adjustments.wins}, Podien {stats.adjustments.podiums >= 0 ? "+" : ""}{stats.adjustments.podiums}, Poles {stats.adjustments.poles >= 0 ? "+" : ""}{stats.adjustments.poles}, Fastest Laps {stats.adjustments.fastestLaps >= 0 ? "+" : ""}{stats.adjustments.fastestLaps}, Punkte {stats.adjustments.points >= 0 ? "+" : ""}{stats.adjustments.points}</div>
          <form action={syncAction} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><Message state={syncState} /><button disabled={syncing} className="wizard-secondary-button min-h-11 justify-center"><RefreshCw size={17} />Automatik neu synchronisieren</button></form>
          <form action={resetAction} onSubmit={(event) => { if (!window.confirm("Alle manuellen Statistik-Korrekturen wirklich zurücksetzen?")) event.preventDefault(); }} className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"><input type="hidden" name="confirmation" value="RESET" /><Message state={resetState} /><button disabled={resetting} className="wizard-secondary-button min-h-11 justify-center border-red-500/30 text-red-200"><RotateCcw size={17} />Korrekturen zurücksetzen</button></form>
        </div> : null}
      </div>
    </details>
  );
}
