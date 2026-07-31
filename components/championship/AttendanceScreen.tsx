import Link from "next/link";
import {
  CalendarClock,
  ChevronRight,
  Clock3,
  Flag,
  History,
  ShieldCheck,
  Users,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import Countdown from "@/components/dashboard/Countdown";
import EmptyState from "@/components/ui/EmptyState";
import CountryFlag from "@/components/ui/CountryFlag";
import {
  AttendanceStatus,
  attendanceChangeSourceLabels,
  attendanceStatusLabels,
  roleLabels,
} from "@/domain";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getAttendancePageData,
  parseSportsListQuery,
} from "@/lib/championship/queries";
import AttendanceManagementControl from "./AttendanceManagementControl";
import AttendanceRoster from "./AttendanceRoster";
import AttendanceSelfPanel from "./AttendanceSelfPanel";

type AttendanceScreenProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
  adminMode?: boolean;
};

export default async function AttendanceScreen({
  searchParams,
  adminMode = false,
}: AttendanceScreenProps) {
  const user = await requirePermission(
    adminMode
      ? Permission.ManageAttendance
      : Permission.ViewChampionship,
  );
  const query = parseSportsListQuery(await searchParams);
  const data = await getAttendancePageData(user.id, query);
  const canManageAll = hasPermission(
    user.roles,
    Permission.ManageAttendance,
  );
  const selectedRace = data.selectedRace;
  const selectedLeagueCode = data.selectedLeague?.code ?? "";
  const deadlinePassed = Boolean(
    selectedRace?.attendanceDeadline &&
      new Date(selectedRace.attendanceDeadline) <= new Date(),
  );
  const ownEntry = data.entries.find(
    (entry) => entry.driver.id === data.ownDriverId,
  );
  const principalEntries = data.entries.filter(
    (entry) =>
      entry.driver.team &&
      data.principalTeamIds.includes(entry.driver.team.id),
  );

  return (
    <AppLayout>
      <div className="page-stack">
        <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-blue-400">
              Race Weekend
            </p>
            <h1 className="mt-2 text-3xl font-black tracking-tight text-white sm:text-4xl">
              {adminMode ? "Anmeldungen verwalten" : "Rennanmeldung"}
            </h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Renntermin, eigener Status und Teilnehmer deiner Liga auf einen
              Blick.
            </p>
          </div>
          {!adminMode && canManageAll ? (
            <Link href="/admin/attendance" className="wizard-primary-button w-full lg:w-auto">
              <ShieldCheck size={18} />
              Admin-Verwaltung
            </Link>
          ) : null}
        </header>

        <form
          action={adminMode ? "/admin/attendance" : "/attendance"}
          className="grid gap-3 rounded-2xl border border-slate-800 bg-[#0d1723] p-4 lg:grid-cols-[1fr_2fr_auto]"
        >
          <label className="master-label">
            Liga
            <select
              name="leagueId"
              defaultValue={data.selectedLeague?.id ?? ""}
              className="form-control mt-2"
            >
              {data.accessibleLeagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.code} · {league.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Rennwochenende
            <select
              name="raceId"
              defaultValue={selectedRace?.id ?? ""}
              className="form-control mt-2"
            >
              {data.races.map((race) => (
                <option key={race.id} value={race.id}>
                  R{race.round} · {race.name}
                </option>
              ))}
            </select>
          </label>
          <button className="wizard-primary-button self-end">
            Anzeigen
            <ChevronRight size={17} />
          </button>
        </form>

        {!data.selectedLeague ? (
          <EmptyState
            icon={<Flag size={22} />}
            title="Keine Liga-Zuordnung"
            description="Für deinen Benutzer ist weder eine Fahrer- noch eine Teamchef-Zuordnung hinterlegt."
          />
        ) : !selectedRace ? (
          <EmptyState
            icon={<CalendarClock size={22} />}
            title="Kein Rennwochenende verfügbar"
            description="Für diese Liga und Saison wurde noch kein Renntermin angelegt."
          />
        ) : (
          <>
            <section className="relative isolate overflow-hidden rounded-[1.8rem] border border-blue-400/25 bg-[#0b1725] p-6 shadow-2xl shadow-blue-950/25 sm:p-8">
              <div
                aria-hidden="true"
                className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_12%,rgba(37,99,235,0.34),transparent_32%),linear-gradient(135deg,rgba(8,47,73,0.45),transparent_55%)]"
              />
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div>
                  <p className="text-xs font-black uppercase tracking-[0.2em] text-cyan-300">
                    {selectedLeagueCode} · Runde {selectedRace.round}
                  </p>
                  <h2 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
                    {selectedRace.name}
                  </h2>
                  <p className="mt-3 text-base text-slate-300">
                    {selectedRace.circuit ?? "Mystery Track"}
                    {selectedRace.countryCode
                      ? ` · ${selectedRace.countryCode}`
                      : ""}
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3 text-sm">
                    <span className="rounded-xl border border-slate-700/80 bg-slate-950/55 px-3 py-2 text-slate-200">
                      <CalendarClock
                        size={16}
                        className="mr-2 inline text-blue-300"
                      />
                      {new Intl.DateTimeFormat("de-DE", {
                        dateStyle: "full",
                        timeStyle: "short",
                        timeZone: selectedRace.timezone,
                      }).format(new Date(selectedRace.scheduledAt))}
                    </span>
                    <span className="rounded-xl border border-slate-700/80 bg-slate-950/55 px-3 py-2 text-slate-200">
                      <Clock3
                        size={16}
                        className="mr-2 inline text-blue-300"
                      />
                      {selectedRace.attendanceDeadline
                        ? `${deadlinePassed ? "Geschlossen" : "Anmeldeschluss"}: ${new Intl.DateTimeFormat(
                            "de-DE",
                            {
                              dateStyle: "medium",
                              timeStyle: "short",
                              timeZone: selectedRace.timezone,
                            },
                          ).format(
                            new Date(selectedRace.attendanceDeadline),
                          )}`
                        : "Kein Anmeldeschluss"}
                    </span>
                  </div>
                </div>
                <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/8 px-5 py-4 text-right">
                  <p className="text-[0.65rem] font-black uppercase tracking-[0.18em] text-cyan-300">
                    Start in
                  </p>
                  <p className="mt-1 text-2xl">
                    <Countdown target={selectedRace.scheduledAt} />
                  </p>
                </div>
              </div>
              <div className="mt-7 grid grid-cols-3 gap-2 border-t border-slate-700/60 pt-5 sm:gap-4">
                <StatusMetric
                  label="Angemeldet"
                  value={data.counts[AttendanceStatus.Registered]}
                  tone="text-emerald-300"
                />
                <StatusMetric
                  label="Abgemeldet"
                  value={data.counts[AttendanceStatus.Declined]}
                  tone="text-red-300"
                />
                <StatusMetric
                  label="Keine Antwort"
                  value={data.counts[AttendanceStatus.NoResponse]}
                  tone="text-amber-200"
                />
              </div>
            </section>

            {!adminMode && ownEntry ? (
              <AttendanceSelfPanel
                raceId={selectedRace.id}
                raceName={selectedRace.name}
                leagueCode={selectedLeagueCode}
                entry={ownEntry}
                closed={deadlinePassed}
              />
            ) : null}

            <AttendanceRoster entries={data.entries} />

            {!adminMode && principalEntries.length > 0 ? (
              <section className="rounded-[1.6rem] border border-violet-500/25 bg-violet-500/5 p-5 sm:p-7">
                <div className="flex items-center gap-3">
                  <span className="flex size-11 items-center justify-center rounded-xl bg-violet-500/15 text-violet-300">
                    <Users size={21} />
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-violet-300">
                      Teamchef-Bereich
                    </p>
                    <h2 className="text-xl font-black text-white">Mein Team</h2>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 lg:grid-cols-2">
                  {principalEntries.map((entry) => (
                    <ManagementRow
                      key={entry.driver.id}
                      raceId={selectedRace.id}
                      entry={entry}
                       leagueCode={selectedLeagueCode}
                      closed={deadlinePassed}
                    />
                  ))}
                </div>
              </section>
            ) : null}

            {adminMode ? (
              <>
                <section className="rounded-[1.6rem] border border-blue-500/25 bg-blue-500/5 p-5 sm:p-7">
                  <p className="text-xs font-bold uppercase tracking-[0.16em] text-blue-300">
                    Administration
                  </p>
                  <h2 className="mt-1 text-xl font-black text-white">
                    Fahrerstatus verwalten
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    Admin-Ausnahmen sind auch nach Fristende möglich. Ein Grund
                    und ein Audit-Eintrag sind immer verpflichtend.
                  </p>
                  <div className="mt-5 grid gap-3 lg:grid-cols-2">
                    {data.entries.map((entry) => (
                      <ManagementRow
                        key={entry.driver.id}
                        raceId={selectedRace.id}
                        entry={entry}
                         leagueCode={selectedLeagueCode}
                        closed={deadlinePassed}
                        admin
                      />
                    ))}
                  </div>
                </section>
                <section className="rounded-[1.6rem] border border-slate-800 bg-[#0d1723] p-5 sm:p-7">
                  <div className="flex items-center gap-3">
                    <History size={20} className="text-blue-300" />
                    <h2 className="text-xl font-black text-white">
                      Änderungsverlauf
                    </h2>
                  </div>
                  <div className="mt-5 space-y-2">
                    {data.auditEntries.map((audit) => (
                      <article
                        key={audit.id}
                        className="rounded-xl border border-slate-800 bg-slate-950/35 p-3 text-sm"
                      >
                        <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                          <p className="font-bold text-white">
                            {audit.driverName}:{" "}
                            {attendanceStatusLabels[audit.previousStatus]} →{" "}
                            {attendanceStatusLabels[audit.newStatus]}
                          </p>
                          <time className="text-xs text-slate-500">
                            {new Intl.DateTimeFormat("de-DE", {
                              dateStyle: "short",
                              timeStyle: "short",
                            }).format(new Date(audit.createdAt))}
                          </time>
                        </div>
                        <p className="mt-1 text-xs text-slate-400">
                          {attendanceChangeSourceLabels[audit.source]} ·{" "}
                          {audit.actorName ?? "System"} ·{" "}
                          {roleLabels[audit.actorRole]}
                          {audit.reason ? ` · ${audit.reason}` : ""}
                        </p>
                      </article>
                    ))}
                    {data.auditEntries.length === 0 ? (
                      <p className="py-5 text-center text-sm text-slate-500">
                        Noch keine Änderungen protokolliert.
                      </p>
                    ) : null}
                  </div>
                </section>
              </>
            ) : null}
          </>
        )}
      </div>
    </AppLayout>
  );
}

function StatusMetric({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone: string;
}) {
  return (
    <div className="rounded-xl bg-slate-950/35 p-3 text-center">
      <p className={`text-2xl font-black ${tone}`}>{value}</p>
      <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-500">
        {label}
      </p>
    </div>
  );
}

function ManagementRow({
  raceId,
  entry,
  leagueCode,
  closed,
  admin = false,
}: {
  raceId: number;
  entry: Awaited<
    ReturnType<typeof getAttendancePageData>
  >["entries"][number];
  leagueCode: string;
  closed: boolean;
  admin?: boolean;
}) {
  return (
    <article className="rounded-2xl border border-slate-800 bg-[#111b27] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex min-w-0 items-center gap-2 truncate font-bold text-white"><CountryFlag countryCode={null} fallbackFlag={entry.driver.flag} size="sm" /><span className="truncate">#{entry.driver.number} {entry.driver.name}</span></p>
          <p className="mt-1 text-xs text-slate-500">
            {leagueCode} · {entry.driver.team?.name ?? "Ohne Team"} ·{" "}
            {attendanceStatusLabels[entry.status]}
          </p>
          {entry.submittedBy ? (
            <p className="mt-2 text-xs text-slate-400">
              Zuletzt durch {entry.submittedBy.displayName}
              {entry.changedAt
                ? ` · ${new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "short",
                    timeStyle: "short",
                  }).format(new Date(entry.changedAt))}`
                : ""}
            </p>
          ) : null}
          {entry.changeReason ? (
            <p className="mt-1 text-xs text-slate-500">
              Grund: {entry.changeReason}
            </p>
          ) : null}
        </div>
      </div>
      <AttendanceManagementControl
        raceId={raceId}
        entry={entry}
        closed={closed}
        admin={admin}
      />
    </article>
  );
}
