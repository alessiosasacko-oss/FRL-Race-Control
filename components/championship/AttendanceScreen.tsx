import Link from "next/link";
import {
  CalendarClock,
  Search,
  ShieldCheck,
  UserRoundCheck,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import {
  AttendanceStatus,
  attendanceStatusLabels,
} from "@/domain";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import {
  requirePermission,
} from "@/lib/auth/session";
import {
  getAttendancePageData,
  parseSportsListQuery,
} from "@/lib/championship/queries";
import AttendanceForm from "./AttendanceForm";

type AttendanceScreenProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
  adminMode?: boolean;
};

function statusClass(status: AttendanceStatus): string {
  if (status === AttendanceStatus.Registered) {
    return "bg-green-500/15 text-green-300";
  }
  if (status === AttendanceStatus.Declined) {
    return "bg-red-500/15 text-red-300";
  }
  return "bg-slate-700 text-slate-300";
}

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
  const data = await getAttendancePageData(
    user.id,
    query,
    adminMode,
  );
  const canManageAll = hasPermission(
    user.roles,
    Permission.ManageAttendance,
  );
  const deadlinePassed = Boolean(
    data.selectedRace?.attendanceDeadline &&
      new Date(data.selectedRace.attendanceDeadline) <= new Date(),
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              {adminMode
                ? "Rennanmeldungen verwalten"
                : "Rennanmeldung"}
            </h1>
            <p className="mt-2 text-slate-400">
              Teilnahme, Absagen und Ersatzfahrer je Rennen.
            </p>
          </div>
          {!adminMode && canManageAll ? (
            <Link
              href="/admin/attendance"
              className="wizard-primary-button"
            >
              <ShieldCheck size={18} />
              Verwaltung
            </Link>
          ) : null}
        </div>

        <form
          action={adminMode ? "/admin/attendance" : "/attendance"}
          className="master-card grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <label className="master-label xl:col-span-2">
            Rennen
            <select
              name="raceId"
              defaultValue={data.selectedRace?.id ?? ""}
              className="form-control mt-2"
            >
              {data.races.map((race) => (
                <option key={race.id} value={race.id}>
                  {race.season.league.code} · {race.season.name} · R
                  {race.round} · {race.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Status
            <select
              name="attendanceStatus"
              defaultValue={query.attendanceStatus ?? ""}
              className="form-control mt-2"
            >
              <option value="">Alle Status</option>
              {Object.values(AttendanceStatus).map((status) => (
                <option key={status} value={status}>
                  {attendanceStatusLabels[status]}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Team
            <select
              name="teamId"
              defaultValue={query.teamId ?? ""}
              className="form-control mt-2"
            >
              <option value="">Alle Teams</option>
              {data.teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Suche
            <span className="relative mt-2 block">
              <Search
                size={17}
                className="absolute left-3 top-3.5 text-slate-500"
              />
              <input
                name="q"
                defaultValue={query.q}
                className="form-control pl-10"
                placeholder="Fahrer oder Team"
              />
            </span>
          </label>
          <button className="wizard-primary-button md:col-span-2 xl:col-span-5">
            Anwenden
          </button>
        </form>

        {data.selectedRace ? (
          <section className="master-card flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                {data.selectedRace.season.league.code} · Runde{" "}
                {data.selectedRace.round}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-white">
                {data.selectedRace.name}
              </h2>
            </div>
            <div className="text-sm text-slate-400">
              <CalendarClock className="mr-2 inline text-blue-400" size={18} />
              {data.selectedRace.attendanceDeadline
                ? `${deadlinePassed ? "Geschlossen seit" : "Anmeldeschluss"} ${new Intl.DateTimeFormat(
                    "de-DE",
                    {
                      dateStyle: "medium",
                      timeStyle: "short",
                    },
                  ).format(
                    new Date(data.selectedRace.attendanceDeadline),
                  )}`
                : "Kein Anmeldeschluss gesetzt"}
            </div>
          </section>
        ) : null}

        <div className="space-y-4">
          {data.entries.map((entry) => {
            const principalCanEdit = Boolean(
              entry.driver.team &&
                data.principalTeamIds.includes(entry.driver.team.id),
            );
            const canEdit =
              canManageAll ||
              (!deadlinePassed &&
                (entry.driver.id === data.ownDriverId ||
                  principalCanEdit));
            const canAssignSubstitute =
              canManageAll || principalCanEdit;

            return (
              <article key={entry.driver.id} className="master-card">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-4">
                    <span className="text-3xl">{entry.driver.flag}</span>
                    <div>
                      <h2 className="font-semibold text-white">
                        #{entry.driver.number} {entry.driver.name}
                        {entry.substitute ? (
                          <span className="ml-2 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200">
                            EF: {entry.substitute.name}
                          </span>
                        ) : null}
                      </h2>
                      <p className="mt-1 text-sm text-slate-400">
                        {entry.representedTeam?.name ??
                          entry.driver.team?.name ??
                          "Ohne Team"}
                      </p>
                    </div>
                  </div>
                  <span
                    className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${statusClass(
                      entry.status,
                    )}`}
                  >
                    {attendanceStatusLabels[entry.status]}
                  </span>
                </div>
                {entry.submittedBy ? (
                  <p className="mt-3 text-xs text-slate-500">
                    Zuletzt geändert von {entry.submittedBy.displayName}
                    {entry.changedAt
                      ? ` · ${new Intl.DateTimeFormat("de-DE", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(entry.changedAt))}`
                      : ""}
                  </p>
                ) : null}
                {canEdit && data.selectedRace ? (
                  <AttendanceForm
                    raceId={data.selectedRace.id}
                    entry={entry}
                    canAssignSubstitute={canAssignSubstitute}
                    teams={data.teams}
                    substituteDrivers={data.substituteDrivers}
                  />
                ) : null}
              </article>
            );
          })}
        </div>

        {data.entries.length === 0 ? (
          <div className="master-card text-center">
            <UserRoundCheck className="mx-auto text-slate-500" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Keine Anmeldungen gefunden
            </h2>
            <p className="mt-2 text-slate-400">
              Wähle ein Rennen oder passe die Filter an.
            </p>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
