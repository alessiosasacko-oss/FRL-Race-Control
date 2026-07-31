import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  EyeOff,
  Flag,
  MapPin,
} from "lucide-react";
import {
  attendanceStatusLabels,
  AttendanceStatus,
} from "@/domain";
import type { DashboardData } from "@/lib/dashboard/types";
import Countdown from "./Countdown";

const attendanceTone: Record<AttendanceStatus, string> = {
  [AttendanceStatus.NoResponse]:
    "border-amber-500/25 bg-amber-500/10 text-amber-200",
  [AttendanceStatus.Registered]:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  [AttendanceStatus.Declined]:
    "border-red-500/25 bg-red-500/10 text-red-200",
};

export default function NextRaceWidget({
  race,
  attendance,
  league,
}: {
  race: DashboardData["nextRace"];
  attendance: DashboardData["attendance"];
  league: string | null;
}) {
  if (!race) {
    return (
      <section className="race-hero relative overflow-hidden rounded-[1.5rem] border p-8 sm:p-10">
        <p className="eyebrow">Nächstes Rennen</p>
        <h2 className="mt-3 text-3xl font-bold text-white">
          Kein Renntermin geplant
        </h2>
        <p className="mt-3 max-w-xl text-slate-400">
          Sobald ein Rennen terminiert ist, erscheinen Countdown und
          Rennanmeldung hier.
        </p>
        <Link href="/calendar" className="wizard-primary-button mt-6">
          Kalender öffnen
        </Link>
      </section>
    );
  }

  return (
    <section className="race-hero relative isolate min-h-[25rem] overflow-hidden rounded-[1.75rem] border shadow-[var(--shadow-card)]">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_18%_12%,rgba(37,99,235,0.38),transparent_33%),radial-gradient(circle_at_92%_82%,rgba(34,211,238,0.12),transparent_28%),linear-gradient(115deg,transparent_0_70%,rgba(255,255,255,0.035)_70%_71%,transparent_71%_100%)]"
      />
      <div
        aria-hidden="true"
        className="absolute right-[-3rem] top-[-3rem] select-none font-mono text-[13rem] font-black leading-none text-white/[0.025] sm:text-[18rem]"
      >
        {String(race.round).padStart(2, "0")}
      </div>

      <div className="grid min-h-[25rem] gap-8 p-6 sm:p-8 lg:grid-cols-[minmax(0,1fr)_22rem] lg:items-end lg:p-10">
        <div className="relative z-10 flex min-w-0 flex-col justify-between self-stretch">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-200">
                Runde {race.round}
              </span>
              {league ? (
                <span className="rounded-full border border-slate-600/70 bg-slate-950/35 px-3 py-1 text-xs font-semibold text-slate-300">
                  {league}
                </span>
              ) : null}
              {race.sprint ? (
                <span className="rounded-full border border-violet-500/30 bg-violet-500/15 px-3 py-1 text-xs font-semibold text-violet-200">
                  Sprint
                </span>
              ) : null}
              {race.mystery ? (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-200">
                  <EyeOff className="mr-1 inline" size={13} />
                  Mystery Track
                </span>
              ) : null}
            </div>
            <p className="mt-7 text-xs font-bold uppercase tracking-[0.22em] text-cyan-300">
              Next up
            </p>
            <h2 className="mt-2 max-w-4xl text-4xl font-black tracking-[-0.045em] text-white sm:text-5xl lg:text-6xl">
              {race.name}
            </h2>
            <p className="mt-4 flex items-center gap-2 text-sm text-slate-300 sm:text-base">
              <MapPin size={18} className="text-blue-300" />
              {race.circuit}
            </p>
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/attendance" className="wizard-primary-button">
              <CheckCircle2 size={18} />
              Rennanmeldung öffnen
              <ArrowRight size={17} />
            </Link>
            <Link href="/calendar" className="wizard-secondary-button">
              Gesamten Kalender ansehen
            </Link>
          </div>
        </div>

        <aside className="relative z-10 rounded-2xl border border-white/10 bg-black/25 p-5 backdrop-blur-md sm:p-6">
          <p className="text-[0.68rem] font-bold uppercase tracking-[0.18em] text-cyan-300">
            Start in
          </p>
          <div className="mt-2 text-3xl font-black text-white">
            <Countdown target={race.scheduledAt} />
          </div>
          <div className="mt-5 space-y-3 border-t border-white/10 pt-5 text-sm text-slate-300">
            <p className="flex items-center gap-2">
              <CalendarDays size={17} className="text-blue-300" />
              {new Intl.DateTimeFormat("de-DE", {
                dateStyle: "full",
                timeZone: race.timezone,
              }).format(new Date(race.scheduledAt))}
            </p>
            <p className="flex items-center gap-2">
              <Clock3 size={17} className="text-cyan-300" />
              {new Intl.DateTimeFormat("de-DE", {
                timeStyle: "short",
                timeZone: race.timezone,
              }).format(new Date(race.scheduledAt))}{" "}
              · {race.timezone}
            </p>
          </div>
          {attendance ? (
            <div
              className={`mt-5 flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold ${attendanceTone[attendance.status]}`}
            >
              <Flag size={16} />
              Anmeldung: {attendanceStatusLabels[attendance.status]}
            </div>
          ) : null}
        </aside>
      </div>
    </section>
  );
}
