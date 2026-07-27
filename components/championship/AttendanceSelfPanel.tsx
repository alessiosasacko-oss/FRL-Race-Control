"use client";

import { useActionState } from "react";
import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import {
  AttendanceChangeSource,
  AttendanceStatus,
  attendanceStatusLabels,
} from "@/domain";
import { updateAttendanceAction } from "@/lib/championship/actions";
import {
  initialSportsActionState,
  type AttendanceEntryView,
} from "@/lib/championship/types";
import ActionMessage from "./ActionMessage";

export default function AttendanceSelfPanel({
  raceId,
  raceName,
  leagueCode,
  entry,
  closed,
}: {
  raceId: number;
  raceName: string;
  leagueCode: string;
  entry: AttendanceEntryView;
  closed: boolean;
}) {
  const [state, action, pending] = useActionState(
    updateAttendanceAction,
    initialSportsActionState,
  );
  const setByTeamPrincipal =
    entry.changeSource === AttendanceChangeSource.TeamPrincipal;

  return (
    <section className="overflow-hidden rounded-[1.6rem] border border-blue-500/25 bg-[#0d1723] shadow-2xl shadow-blue-950/20">
      <div className="border-b border-slate-800/80 px-5 py-5 sm:px-7">
        <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
          Deine Anmeldung
        </p>
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl font-black text-white">
              {attendanceStatusLabels[entry.status]}
            </h2>
            <p className="mt-1 text-sm text-slate-400">
              {setByTeamPrincipal
                ? "Dein Teamchef hat diesen Status gesetzt. Du kannst ihn bis zum Anmeldeschluss selbst ändern."
                : entry.changedAt
                  ? `Zuletzt geändert am ${new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(entry.changedAt))}`
                  : "Du hast noch keine Antwort abgegeben."}
            </p>
          </div>
          <span
            className={`w-fit rounded-full px-3 py-1.5 text-xs font-bold ${
              closed
                ? "bg-slate-700 text-slate-200"
                : entry.status === AttendanceStatus.Registered
                  ? "bg-emerald-500/15 text-emerald-300"
                  : entry.status === AttendanceStatus.Declined
                    ? "bg-red-500/15 text-red-300"
                    : "bg-amber-500/15 text-amber-200"
            }`}
          >
            {closed ? "Anmeldung geschlossen" : "Anmeldung geöffnet"}
          </span>
        </div>
      </div>

      <form action={action} className="p-5 sm:p-7">
        <input type="hidden" name="raceId" value={raceId} />
        <input type="hidden" name="driverId" value={entry.driver.id} />
        <input type="hidden" name="changeMode" value="SELF" />
        <p className="mb-4 text-sm text-slate-300">
          {entry.status === AttendanceStatus.Registered
            ? `Du bist für den ${raceName} in ${leagueCode} angemeldet.`
            : entry.status === AttendanceStatus.Declined
              ? `Du hast dich für den ${raceName} in ${leagueCode} abgemeldet.`
              : `Bestätige jetzt deine Teilnahme am ${raceName} in ${leagueCode}.`}
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="submit"
            name="status"
            value={AttendanceStatus.Registered}
            disabled={closed || pending}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-emerald-400/35 bg-emerald-500/15 px-5 text-base font-black text-emerald-100 transition hover:bg-emerald-500/25 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <CheckCircle2 size={21} />
            )}
            Ich bin dabei
          </button>
          <button
            type="submit"
            name="status"
            value={AttendanceStatus.Declined}
            disabled={closed || pending}
            className="flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-red-400/35 bg-red-500/12 px-5 text-base font-black text-red-100 transition hover:bg-red-500/22 disabled:cursor-not-allowed disabled:opacity-45"
          >
            {pending ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <XCircle size={21} />
            )}
            Ich bin nicht dabei
          </button>
        </div>
        <div className="mt-4" aria-live="polite">
          <ActionMessage state={state} />
        </div>
      </form>
    </section>
  );
}
