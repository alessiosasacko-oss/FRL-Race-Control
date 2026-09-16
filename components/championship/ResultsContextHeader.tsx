import type { ReactNode } from "react";
import { CalendarClock, LockKeyhole, MapPin, Radio } from "lucide-react";
import { ResultSession, resultSessionLabels } from "@/domain";
import CountryFlag from "@/components/ui/CountryFlag";
import type { ResultAdminData } from "@/lib/championship/types";

type SelectedRace = NonNullable<ResultAdminData["selected"]>["race"];

type ResultsContextHeaderProps = {
  race: SelectedRace;
  session: ResultSession;
  raceDate: string;
  published: boolean;
  dirty: boolean;
  pending: boolean;
  lastSavedLabel: string;
  actions?: ReactNode;
};

const sessionTone: Record<ResultSession, string> = {
  [ResultSession.Qualifying]: "border-cyan-400/40 bg-cyan-400/10 text-cyan-100",
  [ResultSession.Sprint]: "border-amber-400/40 bg-amber-400/10 text-amber-100",
  [ResultSession.Race]: "border-red-400/40 bg-red-500/10 text-red-100",
};

export default function ResultsContextHeader({ race, session, raceDate, published, dirty, pending, lastSavedLabel, actions }: ResultsContextHeaderProps) {
  const round = String(race.round).padStart(2, "0");
  return (
    <section aria-label="Aktueller Ergebniskontext" className="sticky top-[4.5rem] z-40 overflow-hidden rounded-2xl border border-[color-mix(in_srgb,var(--page-accent)_34%,transparent)] bg-[color-mix(in_srgb,var(--color-background-elevated)_96%,transparent)] shadow-[var(--shadow-card)] backdrop-blur-xl lg:top-3">
      <div className="grid min-w-0 gap-3 p-3 sm:p-4 lg:grid-cols-[8rem_minmax(0,1fr)_13rem] lg:items-stretch">
        <div className="grid grid-cols-[1fr_auto] gap-2 lg:grid-cols-1">
          <div className="grid min-h-16 place-items-center rounded-xl border border-blue-300/40 bg-[linear-gradient(145deg,#2563eb,#123a9c)] px-3 text-center shadow-lg shadow-blue-950/35 lg:min-h-20">
            <span><span className="block text-[.62rem] font-bold uppercase tracking-[.2em] text-blue-100/75">Liga</span><span className="mt-0.5 block text-2xl font-black tracking-tight text-white sm:text-3xl">FRL {race.season.league.code}</span></span>
          </div>
          <div className="grid min-h-16 place-items-center rounded-xl border border-white/10 bg-slate-950/55 px-3 text-center lg:min-h-14">
            <span><span className="block text-[.6rem] font-bold uppercase tracking-[.18em] text-slate-500">Runde</span><span className="mt-0.5 block font-mono text-lg font-black text-white">ROUND {round}</span></span>
          </div>
        </div>

        <div className="flex min-w-0 items-center gap-3 rounded-xl border border-white/8 bg-slate-950/35 p-3 sm:gap-4 sm:p-4">
          <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-900 sm:size-16">
            {race.revealMystery ? <CountryFlag countryCode={race.countryCode} size="lg" /> : <LockKeyhole aria-label="Mystery Race geschützt" className="text-amber-300" size={28} />}
          </span>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[.65rem] font-bold uppercase tracking-wider ${published ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-amber-500/30 bg-amber-500/10 text-amber-200"}`}>{published ? "Veröffentlicht" : "Entwurf"}</span>
              <span className={`rounded-full px-2.5 py-1 text-[.65rem] font-semibold ${dirty ? "bg-amber-500/15 text-amber-200" : pending ? "bg-blue-500/15 text-blue-200" : "bg-slate-800 text-slate-300"}`}>{pending ? "Wird gespeichert …" : dirty ? "Ungespeicherte Änderungen" : `Gespeichert ${lastSavedLabel}`}</span>
            </div>
            <h2 className="mt-2 break-words text-lg font-black uppercase leading-tight tracking-tight text-white sm:text-2xl">{race.name}</h2>
            <div className="mt-2 flex flex-col gap-1 text-xs text-slate-300 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:text-sm">
              <span className="inline-flex items-center gap-1.5"><MapPin size={14} className="text-blue-300" />{race.revealMystery ? race.circuit : "Strecke bis zum Reveal geschützt"}</span>
              <span className="inline-flex items-center gap-1.5"><CalendarClock size={14} className="text-blue-300" />{raceDate}</span>
            </div>
          </div>
        </div>

        <div className={`flex min-h-16 items-center justify-between gap-3 rounded-xl border px-4 py-3 lg:flex-col lg:items-start lg:justify-center ${sessionTone[session]}`}>
          <span><span className="block text-[.62rem] font-bold uppercase tracking-[.22em] opacity-65">Session</span><span className="mt-1 block text-xl font-black uppercase tracking-[.08em] sm:text-2xl">{resultSessionLabels[session]}</span></span>
          <Radio aria-hidden="true" className="shrink-0 opacity-70" size={24} />
        </div>
      </div>
      {actions ? <div className="hidden items-center justify-end gap-2 border-t border-white/10 px-4 py-3 lg:flex">{actions}</div> : null}
      <div className="border-t border-white/10 px-4 py-2 text-center text-[.68rem] font-bold uppercase tracking-[.12em] text-slate-400 lg:hidden">FRL {race.season.league.code} · {race.revealMystery ? race.circuit : "Mystery Track"} · Round {round} · {resultSessionLabels[session]}</div>
    </section>
  );
}

export function ResultsSaveContext({ race, session, children }: { race: SelectedRace; session: ResultSession; children?: ReactNode }) {
  return (
    <section aria-label="Speicherkontext" className="rounded-2xl border border-blue-500/25 bg-[linear-gradient(135deg,rgba(37,99,235,.12),rgba(2,6,23,.72))] p-4 sm:p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0">
          <p className="text-[.68rem] font-black uppercase tracking-[.2em] text-blue-300">Du speicherst</p>
          <div className="mt-3 flex min-w-0 items-center gap-3">
            {race.revealMystery ? <CountryFlag countryCode={race.countryCode} size="lg" /> : <LockKeyhole className="shrink-0 text-amber-300" size={26} />}
            <div className="min-w-0"><p className="break-words font-black text-white">FRL {race.season.league.code} · Round {String(race.round).padStart(2, "0")} · {resultSessionLabels[session]}</p><p className="mt-1 break-words text-sm text-slate-400">{race.name} · {race.revealMystery ? race.circuit : "Geschütztes Mystery Race"}</p></div>
          </div>
        </div>
        {children ? <div className="hidden gap-2 lg:flex lg:shrink-0">{children}</div> : null}
      </div>
    </section>
  );
}
