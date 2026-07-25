import Link from "next/link";
import { Search, Settings, Trophy } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getChampionshipPageData,
  parseSportsListQuery,
} from "@/lib/championship/queries";

type ChampionshipPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

function points(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ChampionshipPage({
  searchParams,
}: ChampionshipPageProps) {
  const user = await requirePermission(Permission.ViewChampionship);
  const query = parseSportsListQuery(await searchParams);
  const data = await getChampionshipPageData(query);
  const canManage = hasPermission(
    user.roles,
    Permission.ManageScoring,
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">
              Meisterschaft
            </h1>
            <p className="mt-2 text-slate-400">
              Automatisch berechnete Fahrer- und Teamwertung.
            </p>
          </div>
          {canManage ? (
            <Link
              href="/admin/championship"
              className="wizard-primary-button"
            >
              <Settings size={18} />
              Meisterschaft verwalten
            </Link>
          ) : null}
        </div>

        <form
          action="/championship"
          className="master-card grid gap-3 md:grid-cols-2 xl:grid-cols-5"
        >
          <label className="master-label">
            Liga
            <select
              name="leagueId"
              defaultValue={
                query.leagueId ??
                data.selectedSeason?.league.id ??
                ""
              }
              className="form-control mt-2"
            >
              <option value="">Alle Ligen</option>
              {data.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.code} · {league.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Saison
            <select
              name="seasonId"
              defaultValue={data.selectedSeason?.id ?? ""}
              className="form-control mt-2"
            >
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {data.leagues.find(
                    (league) => league.id === season.leagueId,
                  )?.code ?? "–"}{" "}
                  · {season.name}
                  {season.archived ? " · Archiv" : ""}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Tabelle
            <select
              name="table"
              defaultValue={query.table}
              className="form-control mt-2"
            >
              <option value="drivers">Fahrer</option>
              <option value="teams">Teams</option>
            </select>
          </label>
          <label className="master-label xl:col-span-2">
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
            Tabelle laden
          </button>
        </form>

        {data.selectedSeason ? (
          <div className="flex flex-col gap-2 rounded-xl border border-blue-500/20 bg-blue-500/10 px-5 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
            <p className="font-semibold text-blue-100">
              {data.selectedSeason.league.code} ·{" "}
              {data.selectedSeason.name}
            </p>
            <p className="text-blue-200/70">
              {data.updatedAt
                ? `Berechnet ${new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(new Date(data.updatedAt))}`
                : "Noch nicht berechnet"}
            </p>
          </div>
        ) : null}

        {query.table === "drivers" && data.drivers.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#151B24]">
            <div className="hidden grid-cols-[70px_1fr_1fr_100px_80px_90px] gap-4 border-b border-slate-800 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid">
              <span>Pos.</span>
              <span>Fahrer</span>
              <span>Team</span>
              <span>Punkte</span>
              <span>Siege</span>
              <span>Podien</span>
            </div>
            {data.drivers.map((standing) => (
              <details
                key={standing.driver.id}
                className="border-b border-slate-800 last:border-b-0"
              >
                <summary className="grid cursor-pointer list-none grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-4 md:grid-cols-[70px_1fr_1fr_100px_80px_90px] md:px-6">
                  <strong className="text-xl text-white">
                    {standing.position}
                  </strong>
                  <Link
                    href={`/drivers/${standing.driver.id}`}
                    className="min-w-0 font-semibold text-white hover:text-blue-300"
                  >
                    <span className="mr-2">{standing.driver.flag}</span>
                    #{standing.driver.number} {standing.driver.name}
                    {standing.substituteStarts > 0 ? (
                      <span className="ml-2 rounded bg-amber-500/20 px-2 py-1 text-xs text-amber-200">
                        EF
                      </span>
                    ) : null}
                  </Link>
                  <span className="hidden text-slate-400 md:block">
                    {standing.driver.team?.name ?? "Ohne Team"}
                  </span>
                  <strong className="text-right text-lg text-blue-300 md:text-left">
                    {points(standing.points)}
                  </strong>
                  <span className="hidden text-slate-300 md:block">
                    {standing.wins}
                  </span>
                  <span className="hidden text-slate-300 md:block">
                    {standing.podiums}
                  </span>
                </summary>
                <div className="grid gap-3 bg-slate-950/40 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                  <Stat label="Rennpunkte" value={standing.racePoints} />
                  <Stat label="Sprintpunkte" value={standing.sprintPoints} />
                  <Stat label="Bonus" value={standing.bonusPoints} />
                  <Stat label="Anpassungen" value={standing.adjustments} />
                  <Stat label="Starts" value={standing.starts} />
                  <Stat label="DNF" value={standing.dnfs} />
                  <Stat label="DSQ" value={standing.dsqs} />
                  <Stat
                    label="Pole / schnellste Runde"
                    value={`${standing.polePositions} / ${standing.fastestLaps}`}
                  />
                  <Stat
                    label="Tie-Break"
                    value={standing.tieBreakSummary}
                  />
                </div>
              </details>
            ))}
          </div>
        ) : null}

        {query.table === "teams" && data.teams.length > 0 ? (
          <div className="overflow-hidden rounded-2xl border border-slate-800 bg-[#151B24]">
            <div className="hidden grid-cols-[70px_1fr_100px_80px_90px] gap-4 border-b border-slate-800 px-6 py-4 text-xs font-semibold uppercase tracking-wider text-slate-500 md:grid">
              <span>Pos.</span>
              <span>Team</span>
              <span>Punkte</span>
              <span>Siege</span>
              <span>Podien</span>
            </div>
            {data.teams.map((standing) => (
              <details
                key={standing.team.id}
                className="border-b border-slate-800 last:border-b-0"
              >
                <summary className="grid cursor-pointer list-none grid-cols-[48px_1fr_auto] items-center gap-3 px-4 py-4 md:grid-cols-[70px_1fr_100px_80px_90px] md:px-6">
                  <strong className="text-xl text-white">
                    {standing.position}
                  </strong>
                  <Link
                    href={`/teams/${standing.team.id}`}
                    className="flex min-w-0 items-center gap-3 font-semibold text-white hover:text-blue-300"
                  >
                    <span
                      className="h-8 w-1 rounded-full"
                      style={{ backgroundColor: standing.team.color }}
                    />
                    {standing.team.name}
                  </Link>
                  <strong className="text-right text-lg text-blue-300 md:text-left">
                    {points(standing.points)}
                  </strong>
                  <span className="hidden text-slate-300 md:block">
                    {standing.wins}
                  </span>
                  <span className="hidden text-slate-300 md:block">
                    {standing.podiums}
                  </span>
                </summary>
                <div className="grid gap-3 bg-slate-950/40 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
                  <Stat label="Rennpunkte" value={standing.racePoints} />
                  <Stat label="Sprintpunkte" value={standing.sprintPoints} />
                  <Stat label="Bonus" value={standing.bonusPoints} />
                  <Stat label="Anpassungen" value={standing.adjustments} />
                  <Stat
                    label="Tie-Break"
                    value={standing.tieBreakSummary}
                  />
                </div>
              </details>
            ))}
          </div>
        ) : null}

        {(query.table === "drivers"
          ? data.drivers.length
          : data.teams.length) === 0 ? (
          <div className="master-card text-center">
            <Trophy className="mx-auto text-slate-500" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Noch keine Wertung vorhanden
            </h2>
            <p className="mt-2 text-slate-400">
              Nach dem ersten gespeicherten Ergebnis wird die Tabelle
              automatisch berechnet.
            </p>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-lg bg-slate-900 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <strong className="text-white">
        {typeof value === "number" ? points(value) : value}
      </strong>
    </p>
  );
}
