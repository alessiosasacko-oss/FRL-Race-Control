"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import {
  AttendanceStatus,
  attendanceStatusLabels,
} from "@/domain";
import type { AttendanceEntryView } from "@/lib/championship/types";
import CountryFlag from "@/components/ui/CountryFlag";
import TeamLogo from "@/components/teams/TeamLogo";

const groups = [
  AttendanceStatus.Registered,
  AttendanceStatus.Declined,
  AttendanceStatus.NoResponse,
] as const;

const groupTone: Record<AttendanceStatus, string> = {
  [AttendanceStatus.Registered]: "text-emerald-300",
  [AttendanceStatus.Declined]: "text-red-300",
  [AttendanceStatus.NoResponse]: "text-amber-200",
};

export default function AttendanceRoster({
  entries,
}: {
  entries: AttendanceEntryView[];
}) {
  const [query, setQuery] = useState("");
  const [mobileGroup, setMobileGroup] = useState<AttendanceStatus>(
    AttendanceStatus.Registered,
  );
  const filtered = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase("de-DE");
    if (!normalized) return entries;
    return entries.filter(
      (entry) =>
        entry.driver.name.toLocaleLowerCase("de-DE").includes(normalized) ||
        entry.driver.team?.name
          .toLocaleLowerCase("de-DE")
          .includes(normalized) ||
        String(entry.driver.number).includes(normalized),
    );
  }, [entries, query]);

  const group = (status: AttendanceStatus) =>
    filtered.filter((entry) => entry.status === status);

  return (
    <section className="rounded-[1.6rem] border border-slate-800 bg-[#0d1723] p-5 sm:p-7">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.18em] text-blue-300">
            Teilnehmerübersicht
          </p>
          <h2 className="mt-1 text-xl font-black text-white">
            Wer fährt mit?
          </h2>
        </div>
        <label className="relative block sm:w-72">
          <Search
            size={17}
            className="absolute left-3 top-3.5 text-slate-500"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            className="form-control pl-10"
            placeholder="Fahrer, Nummer oder Team"
            aria-label="Teilnehmer durchsuchen"
          />
        </label>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-2 lg:hidden">
        {groups.map((status) => (
          <button
            key={status}
            type="button"
            onClick={() => setMobileGroup(status)}
            className={`min-h-11 rounded-xl px-2 text-xs font-bold ${
              mobileGroup === status
                ? "bg-blue-600 text-white"
                : "bg-slate-900 text-slate-400"
            }`}
          >
            {status === AttendanceStatus.Registered
              ? "Dabei"
              : status === AttendanceStatus.Declined
                ? "Abgesagt"
                : "Offen"}{" "}
            ({group(status).length})
          </button>
        ))}
      </div>
      <div className="mt-4 lg:hidden">
        <RosterGroup status={mobileGroup} entries={group(mobileGroup)} />
      </div>

      <div className="mt-6 hidden gap-4 lg:grid lg:grid-cols-3">
        {groups.map((status) => (
          <RosterGroup
            key={status}
            status={status}
            entries={group(status)}
          />
        ))}
      </div>
    </section>
  );
}

function RosterGroup({
  status,
  entries,
}: {
  status: AttendanceStatus;
  entries: AttendanceEntryView[];
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-slate-800 bg-slate-950/35 p-3">
      <div className="flex items-center justify-between px-1">
        <h3 className={`text-sm font-black ${groupTone[status]}`}>
          {attendanceStatusLabels[status]}
        </h3>
        <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-bold text-slate-300">
          {entries.length}
        </span>
      </div>
      <div className="mt-3 space-y-2">
        {entries.map((entry) => (
          <article
            key={entry.driver.id}
            className="flex min-w-0 items-center gap-3 rounded-xl border border-slate-800/80 bg-[#111b27] p-3"
          >
            <CountryFlag countryCode={null} fallbackFlag={entry.driver.flag} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-bold text-white">
                #{entry.driver.number} {entry.driver.name}
              </p>
              <AttendanceTeam team={entry.representedTeam ?? entry.driver.team} />
              {entry.substitute ? (
                <p className="mt-1 text-[0.68rem] font-bold text-amber-300">
                  Ersatz: #{entry.substitute.number} {entry.substitute.name}
                </p>
              ) : null}
            </div>
          </article>
        ))}
        {entries.length === 0 ? (
          <p className="px-1 py-5 text-center text-xs text-slate-600">
            Keine Fahrer in diesem Status.
          </p>
        ) : null}
      </div>
    </div>
  );
}

function AttendanceTeam({ team }: { team: AttendanceEntryView["representedTeam"] }) {
  return <p className="flex min-w-0 items-center gap-2 text-xs text-slate-500">{team ? <TeamLogo logoUrl={team.logoUrl} teamName={team.name} shortName={team.shortName} primaryColor={team.color} size="xs" /> : null}<span className="truncate">{team?.name ?? "Ohne Team"}</span></p>;
}
