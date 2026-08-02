"use client";

import { useActionState, useRef } from "react";
import { AlertTriangle, ShieldX, Trash2, UserRoundX } from "lucide-react";
import { Role } from "@/domain";
import { initialUserAdminActionState } from "@/lib/users/action-state";
import {
  anonymizeDriverAction,
  deleteDriverProfileAction,
  deleteUserAndDriverAction,
  updateDriverStatusAction,
} from "@/lib/users/actions";
import type { DriverDeletionSnapshot } from "@/lib/users/driver-dependencies";

export default function DriverDangerZone({
  snapshot,
  actorRoles,
}: {
  snapshot: DriverDeletionSnapshot;
  actorRoles: Role[];
}) {
  const profileDialog = useRef<HTMLDialogElement>(null);
  const userDialog = useRef<HTMLDialogElement>(null);
  const anonymizeDialog = useRef<HTMLDialogElement>(null);
  const actorIsSuperAdmin = actorRoles.includes(Role.SuperAdmin);
  const confirmationName = snapshot.driver?.name ?? snapshot.user.displayName;
  const [statusState, statusAction, statusPending] = useActionState(
    updateDriverStatusAction.bind(null, snapshot.user.id),
    initialUserAdminActionState,
  );
  const [profileState, profileAction, profilePending] = useActionState(
    deleteDriverProfileAction.bind(null, snapshot.user.id),
    initialUserAdminActionState,
  );
  const [userState, userAction, userPending] = useActionState(
    deleteUserAndDriverAction.bind(null, snapshot.user.id),
    initialUserAdminActionState,
  );
  const [anonymizeState, anonymizeAction, anonymizePending] = useActionState(
    anonymizeDriverAction.bind(null, snapshot.user.id),
    initialUserAdminActionState,
  );

  return (
    <section className="rounded-2xl border border-red-500/30 bg-red-950/10 p-4 sm:p-6">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-red-500/10 text-red-300"><AlertTriangle size={21} /></span>
        <div>
          <p className="eyebrow text-red-300">Gefahrenzone</p>
          <h2 className="mt-2 text-xl font-black text-white">Fahrer deaktivieren oder endgültig entfernen</h2>
          <p className="mt-2 text-sm leading-6 text-slate-400">Historische Sport-, FIA- und Verwaltungsdaten werden vor jeder endgültigen Löschung serverseitig erneut geprüft.</p>
        </div>
      </div>

      <DependencyOverview snapshot={snapshot} />

      <div className="mt-6 grid gap-4 lg:grid-cols-3">
        {snapshot.driver ? (
          <form action={statusAction} className="rounded-xl border border-amber-500/25 bg-amber-500/5 p-4">
            <h3 className="font-bold text-white">Fahrer {snapshot.driver.active ? "deaktivieren" : "reaktivieren"}</h3>
            <p className="mt-2 text-sm text-slate-400">{snapshot.driver.active ? "Blendet den Fahrer aus neuen Zuordnungen aus. Historie bleibt erhalten." : "Aktiviert nur das Fahrerprofil. Saisonzuordnungen werden nicht automatisch reaktiviert."}</p>
            <input type="hidden" name="active" value={snapshot.driver.active ? "false" : "true"} />
            <label className="master-label mt-4">Grund<textarea name="reason" rows={2} minLength={3} maxLength={500} required className="form-control mt-2" /></label>
            <label className="mt-3 flex min-h-12 items-start gap-3 rounded-xl border border-amber-500/25 p-3 text-sm text-amber-100"><input type="checkbox" name="confirmed" required className="mt-0.5 size-5 accent-amber-500" />Auswirkungen geprüft</label>
            <ActionState state={statusState} />
            <button disabled={statusPending} className="wizard-secondary-button mt-4 min-h-11 w-full">{statusPending ? "Speichert…" : snapshot.driver.active ? "Fahrer deaktivieren" : "Fahrer reaktivieren"}</button>
          </form>
        ) : (
          <div className="rounded-xl border border-slate-800 p-4 text-sm text-slate-500">Kein Fahrerprofil vorhanden.</div>
        )}

        {snapshot.driver ? (
          <div className="rounded-xl border border-red-500/25 bg-red-500/5 p-4">
            <h3 className="font-bold text-white">Fahrerprofil löschen</h3>
            <p className="mt-2 text-sm text-slate-400">Das Discord-Benutzerkonto und andere Systemrollen bleiben bestehen.</p>
            {!snapshot.canDeleteDriverProfile ? <p className="mt-3 text-sm font-bold text-amber-200">Wegen historischer Daten gesperrt. Deaktivieren oder anonymisieren ist weiterhin möglich.</p> : null}
            <button type="button" disabled={!snapshot.canDeleteDriverProfile} onClick={() => profileDialog.current?.showModal()} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40"><UserRoundX size={18} />Fahrerprofil löschen</button>
          </div>
        ) : null}

        <div className="rounded-xl border border-red-500/40 bg-red-500/10 p-4">
          <h3 className="font-bold text-white">Benutzer und Fahrer löschen</h3>
          <p className="mt-2 text-sm text-slate-400">Entfernt zusätzlich Auth.js-Accounts, Sessions, Einstellungen und nicht historische persönliche Daten.</p>
          {!actorIsSuperAdmin ? <p className="mt-3 text-sm text-amber-200">Nur für Super-Administratoren.</p> : !snapshot.canDeleteUserAndDriver ? <p className="mt-3 text-sm font-bold text-amber-200">Historische Abhängigkeiten sperren die vollständige Löschung.</p> : null}
          <button type="button" disabled={!actorIsSuperAdmin || !snapshot.canDeleteUserAndDriver} onClick={() => userDialog.current?.showModal()} className="mt-4 flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-red-700 px-4 font-bold text-white hover:bg-red-600 disabled:cursor-not-allowed disabled:opacity-40"><Trash2 size={18} />Benutzer und Fahrer löschen</button>
          {actorIsSuperAdmin && snapshot.driver ? <button type="button" onClick={() => anonymizeDialog.current?.showModal()} className="wizard-secondary-button mt-3 min-h-11 w-full"><ShieldX size={18} />Fahrerdaten anonymisieren</button> : null}
        </div>
      </div>

      <DangerDialog dialogRef={profileDialog} title={`Fahrerprofil von ${confirmationName} löschen`} description={`Das Fahrerprofil von ${confirmationName} wird endgültig gelöscht. Das Discord-Benutzerkonto bleibt bestehen.`} action={profileAction} state={profileState} pending={profilePending} confirmationName={confirmationName} submitLabel="Fahrerprofil endgültig löschen">
        <label className="flex min-h-12 items-start gap-3 rounded-xl border border-slate-700 p-3 text-sm"><input type="checkbox" name="removeDriverRole" defaultChecked className="mt-0.5 size-5 accent-red-500" />DRIVER-Rolle ebenfalls entfernen (Standard)</label>
      </DangerDialog>

      <DangerDialog dialogRef={userDialog} title={`Benutzerkonto und Fahrer von ${confirmationName} löschen`} description="Accounts, Sessions, Rollen, Einstellungen und das unbenutzte Fahrerprofil werden transaktional und unwiderruflich gelöscht." action={userAction} state={userState} pending={userPending} confirmationName={confirmationName} submitLabel="Benutzer und Fahrer endgültig löschen" />

      <DangerDialog dialogRef={anonymizeDialog} title={`${confirmationName} anonymisieren`} description="Persönliche Daten, Discord-Verknüpfung, E-Mail, Avatar, Accounts und Sessions werden entfernt. Ergebnisse, Punkte, FIA- und Teamhistorie bleiben bestehen." action={anonymizeAction} state={anonymizeState} pending={anonymizePending} confirmationName={confirmationName} submitLabel="Fahrerdaten anonymisieren" />
    </section>
  );
}

function DependencyOverview({ snapshot }: { snapshot: DriverDeletionSnapshot }) {
  const blocking = [...snapshot.driverBlockingMessages, ...snapshot.userBlockingMessages];
  return (
    <div className="mt-5 rounded-xl border border-slate-800 bg-slate-950/35 p-4">
      <h3 className="font-bold text-white">Abhängigkeitsprüfung</h3>
      {blocking.length ? (
        <><p className="mt-2 text-sm text-amber-200">Endgültige Löschung ist aktuell gesperrt:</p><ul className="mt-3 grid gap-2 text-sm text-slate-300 sm:grid-cols-2">{blocking.map((message) => <li key={message} className="break-words">• {message}</li>)}</ul></>
      ) : <p className="mt-2 text-sm text-emerald-300">Keine sperrende Sport-, FIA- oder Verwaltungshistorie gefunden.</p>}
      <p className="mt-4 text-xs leading-5 text-slate-500">Entfernbar: {snapshot.removable.seasonAssignments} Saisonzuordnungen, {snapshot.removable.accounts} Auth-Accounts, {snapshot.removable.sessions} Sessions, {snapshot.removable.notifications} Benachrichtigungen. {snapshot.removable.retainedSystemAudits} System-Audit-Einträge bleiben als minimales Löschprotokoll erhalten.</p>
    </div>
  );
}

function DangerDialog({
  dialogRef,
  title,
  description,
  action,
  state,
  pending,
  confirmationName,
  submitLabel,
  children,
}: {
  dialogRef: React.RefObject<HTMLDialogElement | null>;
  title: string;
  description: string;
  action: (formData: FormData) => void;
  state: typeof initialUserAdminActionState;
  pending: boolean;
  confirmationName: string;
  submitLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <dialog ref={dialogRef} className="w-[min(40rem,calc(100%-2rem))] rounded-2xl border border-red-500/40 bg-slate-950 p-0 text-slate-200 shadow-2xl backdrop:bg-slate-950/80 max-lg:mb-0 max-lg:mt-auto max-lg:w-full max-lg:max-w-none max-lg:rounded-b-none">
      <form action={action} className="max-h-[85vh] space-y-4 overflow-y-auto overflow-x-hidden p-5 sm:p-6">
        <h3 className="break-words text-xl font-black text-red-100">{title}</h3>
        <p className="text-sm leading-6 text-slate-300">{description}</p>
        {children}
        <label className="master-label">Grund<textarea name="reason" minLength={3} maxLength={500} rows={3} required className="form-control mt-2" /></label>
        <label className="master-label">Gib <strong className="break-all text-white">{confirmationName.toUpperCase()}</strong> ein<input name="confirmationName" autoComplete="off" required className="form-control mt-2 uppercase" /></label>
        <label className="flex min-h-12 items-start gap-3 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-100"><input type="checkbox" name="irreversible" required className="mt-0.5 size-5 accent-red-500" />Ich bestätige, dass diese Aktion nicht rückgängig gemacht werden kann.</label>
        <ActionState state={state} />
        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end"><button type="button" onClick={() => dialogRef.current?.close()} className="wizard-secondary-button min-h-11">Abbrechen</button><button disabled={pending} className="min-h-11 rounded-xl bg-red-600 px-4 font-bold text-white hover:bg-red-500 disabled:opacity-50">{pending ? "Verarbeitet…" : submitLabel}</button></div>
      </form>
    </dialog>
  );
}

function ActionState({ state }: { state: typeof initialUserAdminActionState }) {
  if (state.status === "idle") return null;
  return <div role="status" className={`mt-4 rounded-xl border p-3 text-sm ${state.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>{state.message}</div>;
}
