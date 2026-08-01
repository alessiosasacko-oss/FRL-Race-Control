"use client";

import { useActionState, useMemo, useRef } from "react";
import { Archive, MoreHorizontal, RotateCcw, Trash2 } from "lucide-react";
import {
  archiveTeamAction,
  permanentlyDeleteTeamAction,
  restoreTeamAction,
} from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type TeamOrganizationItem,
} from "@/lib/master-data/types";
import { teamDependencyMessages } from "@/lib/master-data/team-lifecycle";
import ActionMessage from "./ActionMessage";

export default function TeamLifecycleActions({ team }: { team: TeamOrganizationItem }) {
  const archiveDialog = useRef<HTMLDialogElement>(null);
  const restoreDialog = useRef<HTMLDialogElement>(null);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [archiveState, archiveAction, archivePending] = useActionState(
    archiveTeamAction.bind(null, team.id),
    initialMasterDataActionState,
  );
  const [restoreState, restoreAction, restorePending] = useActionState(
    restoreTeamAction.bind(null, team.id),
    initialMasterDataActionState,
  );
  const [deleteState, deleteAction, deletePending] = useActionState(
    permanentlyDeleteTeamAction.bind(null, team.id),
    initialMasterDataActionState,
  );
  const driversByLeague = useMemo(() =>
    team.activeDrivers.reduce<Record<string, TeamOrganizationItem["activeDrivers"]>>(
      (groups, driver) => ({
        ...groups,
        [driver.leagueCode]: [...(groups[driver.leagueCode] ?? []), driver],
      }),
      {},
    ), [team.activeDrivers]);
  const dependencies = teamDependencyMessages(team.dependencies);

  function openEditor() {
    const editor = document.getElementById(`team-${team.id}-editor`);
    if (editor instanceof HTMLDetailsElement) editor.open = true;
    editor?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="flex flex-col items-stretch gap-2 sm:items-end">
      <details className="relative z-10">
        <summary className="wizard-secondary-button min-h-11 cursor-pointer list-none">
          <MoreHorizontal size={18} /> Aktionen
        </summary>
        <div className="absolute right-0 top-full mt-2 grid min-w-56 gap-1 rounded-xl border border-slate-700 bg-slate-950 p-2 shadow-2xl max-sm:fixed max-sm:inset-x-3 max-sm:bottom-20 max-sm:top-auto">
          {!team.archivedAt ? (
            <button type="button" onClick={openEditor} className="min-h-11 rounded-lg px-3 text-left text-sm text-slate-200 hover:bg-slate-800">
              Bearbeiten
            </button>
          ) : null}
          {!team.archivedAt ? (
            <button type="button" onClick={() => archiveDialog.current?.showModal()} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-amber-200 hover:bg-amber-500/10">
              <Archive size={16} /> Archivieren
            </button>
          ) : (
            <button type="button" onClick={() => restoreDialog.current?.showModal()} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-emerald-200 hover:bg-emerald-500/10">
              <RotateCcw size={16} /> Wiederherstellen
            </button>
          )}
          {team.canPermanentlyDelete ? (
            <button type="button" onClick={() => deleteDialog.current?.showModal()} className="flex min-h-11 items-center gap-2 rounded-lg px-3 text-left text-sm text-red-200 hover:bg-red-500/10">
              <Trash2 size={16} /> Endgültig löschen
            </button>
          ) : null}
        </div>
      </details>

      {!team.canPermanentlyDelete && dependencies.length ? (
        <p className="max-w-sm text-right text-xs text-slate-500 max-sm:text-left">
          Endgültiges Löschen gesperrt: {dependencies.join(", ")}.
        </p>
      ) : null}

      <dialog ref={archiveDialog} className="w-[min(42rem,calc(100%-2rem))] rounded-2xl border border-amber-500/30 bg-slate-950 p-0 text-slate-200 shadow-2xl backdrop:bg-slate-950/80 max-lg:mb-0 max-lg:mt-auto max-lg:w-full max-lg:max-w-none max-lg:rounded-b-none">
        <form action={archiveAction} className="max-h-[85vh] overflow-y-auto p-5 sm:p-6">
          <h3 className="text-xl font-black text-white">{team.name} archivieren?</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">
            Das Team kann anschließend nicht mehr für neue Fahrerzuordnungen verwendet werden. Historische Ergebnisse bleiben erhalten.
          </p>
          {team.activeDrivers.length ? (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
              <p className="font-bold text-amber-100">Dieses Team besitzt noch aktive Fahrerzuordnungen.</p>
              <div className="mt-3 space-y-3">
                {Object.entries(driversByLeague).map(([league, drivers]) => (
                  <div key={league}><p className="text-sm font-bold text-white">{league}</p><ul className="mt-1 list-inside list-disc text-sm text-slate-300">{drivers.map((driver) => <li key={driver.id}>{driver.name}</li>)}</ul></div>
                ))}
              </div>
              <p className="mt-4 text-sm text-slate-300">Weise die Fahrer vorher einem anderen Team zu oder bestätige ausdrücklich, dass die aktuellen Zuordnungen auf „Ohne Team“ gesetzt werden.</p>
              <label className="mt-4 flex min-h-11 items-start gap-3 rounded-lg border border-amber-500/30 p-3 text-sm"><input type="checkbox" name="detachActiveDrivers" className="mt-0.5 size-5 accent-amber-500" />Aktive Fahrer ausdrücklich auf „Ohne Team“ setzen</label>
            </div>
          ) : null}
          <input type="hidden" name="confirmed" value="on" />
          <div className="mt-5"><ActionMessage state={archiveState} /></div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button type="button" onClick={() => archiveDialog.current?.close()} className="wizard-secondary-button min-h-11">Abbrechen</button>
            <button disabled={archivePending} className="wizard-primary-button min-h-11 bg-amber-600 hover:bg-amber-500">{archivePending ? "Archiviert…" : "Team archivieren"}</button>
          </div>
        </form>
      </dialog>

      <dialog ref={restoreDialog} className="w-[min(36rem,calc(100%-2rem))] rounded-2xl border border-emerald-500/30 bg-slate-950 p-0 text-slate-200 shadow-2xl backdrop:bg-slate-950/80 max-lg:mb-0 max-lg:mt-auto max-lg:w-full max-lg:max-w-none max-lg:rounded-b-none">
        <form action={restoreAction} className="p-5 sm:p-6">
          <h3 className="text-xl font-black text-white">{team.name} wiederherstellen?</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">Das Team wird wieder in aktiven Übersichten und Auswahlfeldern verfügbar. Historische Daten bleiben unverändert.</p>
          <input type="hidden" name="confirmed" value="on" />
          <div className="mt-5"><ActionMessage state={restoreState} /></div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => restoreDialog.current?.close()} className="wizard-secondary-button min-h-11">Abbrechen</button><button disabled={restorePending} className="wizard-primary-button min-h-11">{restorePending ? "Stellt wieder her…" : "Team wiederherstellen"}</button></div>
        </form>
      </dialog>

      <dialog ref={deleteDialog} className="w-[min(36rem,calc(100%-2rem))] rounded-2xl border border-red-500/30 bg-slate-950 p-0 text-slate-200 shadow-2xl backdrop:bg-slate-950/80 max-lg:mb-0 max-lg:mt-auto max-lg:w-full max-lg:max-w-none max-lg:rounded-b-none">
        <form action={deleteAction} className="p-5 sm:p-6">
          <h3 className="text-xl font-black text-red-100">{team.name} endgültig löschen?</h3>
          <p className="mt-3 text-sm leading-6 text-slate-300">Diese Aktion kann nicht rückgängig gemacht werden. Gib <strong className="text-white">{team.name.toUpperCase()}</strong> ein, um das Team endgültig zu löschen.</p>
          <label className="master-label mt-5">Teamname<input name="confirmationName" autoComplete="off" className="form-control mt-2 uppercase" required /></label>
          <div className="mt-5"><ActionMessage state={deleteState} /></div>
          <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => deleteDialog.current?.close()} className="wizard-secondary-button min-h-11">Abbrechen</button><button disabled={deletePending} className="min-h-11 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-500 disabled:opacity-50">{deletePending ? "Löscht…" : "Endgültig löschen"}</button></div>
        </form>
      </dialog>
    </div>
  );
}
