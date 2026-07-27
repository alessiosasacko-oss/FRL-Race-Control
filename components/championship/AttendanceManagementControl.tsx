"use client";

import { useActionState, useState } from "react";
import { CheckCircle2, Loader2, ShieldCheck, XCircle } from "lucide-react";
import { AttendanceStatus } from "@/domain";
import { updateAttendanceAction } from "@/lib/championship/actions";
import {
  initialSportsActionState,
  type AttendanceEntryView,
} from "@/lib/championship/types";
import ActionMessage from "./ActionMessage";

export default function AttendanceManagementControl({
  raceId,
  entry,
  admin = false,
  closed = false,
}: {
  raceId: number;
  entry: AttendanceEntryView;
  admin?: boolean;
  closed?: boolean;
}) {
  const [nextStatus, setNextStatus] = useState<AttendanceStatus | null>(
    null,
  );
  const [state, action, pending] = useActionState(
    updateAttendanceAction,
    initialSportsActionState,
  );

  return (
    <div className="mt-3">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={closed && !admin}
          onClick={() => setNextStatus(AttendanceStatus.Registered)}
          className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-xs font-bold text-emerald-200 disabled:opacity-40"
        >
          Als angemeldet setzen
        </button>
        <button
          type="button"
          disabled={closed && !admin}
          onClick={() => setNextStatus(AttendanceStatus.Declined)}
          className="rounded-xl border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs font-bold text-red-200 disabled:opacity-40"
        >
          Als abgemeldet setzen
        </button>
      </div>
      <ActionMessage state={state} />

      {nextStatus ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Anmeldestatus für ${entry.driver.name} ändern`}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-3 backdrop-blur-sm sm:items-center"
        >
          <form
            action={action}
            className="w-full max-w-lg rounded-[1.5rem] border border-slate-700 bg-[#101923] p-5 shadow-2xl"
          >
            <input type="hidden" name="raceId" value={raceId} />
            <input
              type="hidden"
              name="driverId"
              value={entry.driver.id}
            />
            <input type="hidden" name="status" value={nextStatus} />
            <input type="hidden" name="changeMode" value="MANAGEMENT" />
            <div className="flex items-center gap-3">
              <span className="flex size-10 items-center justify-center rounded-xl bg-blue-500/15 text-blue-300">
                <ShieldCheck size={20} />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-wider text-blue-300">
                  {admin ? "Admin-Ausnahme" : "Mein Team"}
                </p>
                <h3 className="font-bold text-white">
                  Status für {entry.driver.name} ändern
                </h3>
              </div>
            </div>
            <p className="mt-4 text-sm text-slate-300">
              Du setzt den Fahrer auf{" "}
              <strong className="text-white">
                {nextStatus === AttendanceStatus.Registered
                  ? "angemeldet"
                  : "abgemeldet"}
              </strong>
              .
            </p>
            <label className="master-label mt-4 block">
              Grund der Änderung
              <textarea
                name="reason"
                required
                minLength={3}
                maxLength={1000}
                rows={3}
                autoFocus
                placeholder="z. B. technische Probleme oder kurzfristige Absprache"
                className="form-control mt-2"
              />
            </label>
            <div className="mt-5 grid gap-2 sm:grid-cols-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setNextStatus(null)}
                className="min-h-11 rounded-xl border border-slate-700 px-4 text-sm font-bold text-slate-300"
              >
                Abbrechen
              </button>
              <button
                disabled={pending}
                className={`flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-black ${
                  nextStatus === AttendanceStatus.Registered
                    ? "bg-emerald-500 text-emerald-950"
                    : "bg-red-500 text-white"
                }`}
              >
                {pending ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : nextStatus === AttendanceStatus.Registered ? (
                  <CheckCircle2 size={18} />
                ) : (
                  <XCircle size={18} />
                )}
                Änderung speichern
              </button>
            </div>
            <div className="mt-3" aria-live="polite">
              <ActionMessage state={state} />
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
