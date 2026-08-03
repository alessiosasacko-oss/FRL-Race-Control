import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import ResultsEditor from "@/components/championship/ResultsEditor";
import PageHeader from "@/components/ui/PageHeader";
import { Flag, SlidersHorizontal } from "lucide-react";
import {
  ResultSession,
  resultSessionLabels,
} from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getResultAdminData,
  parseSportsListQuery,
} from "@/lib/championship/queries";
import { resultWorkspaceStatus } from "@/lib/championship/result-workspace";
import { resultSessionInputSchema } from "@/lib/championship/schemas";
import { getMasterDataFilterOptions } from "@/lib/master-data/queries";

type ResultsAdminPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function ResultsAdminPage({
  searchParams,
}: ResultsAdminPageProps) {
  await requirePermission(Permission.ManageResults);
  const rawParams = await searchParams;
  const query = parseSportsListQuery(rawParams);
  const rawSession = Array.isArray(rawParams.session)
    ? rawParams.session[0]
    : rawParams.session;
  const session =
    resultSessionInputSchema.catch(ResultSession.Race).parse(rawSession);
  const [dataResult, filterOptionsResult] = await Promise.allSettled([
    getResultAdminData(
      query.raceId,
      query.leagueId,
      query.seasonId,
    ),
    getMasterDataFilterOptions(),
  ]);
  if (dataResult.status === "rejected") {
    throw dataResult.reason;
  }
  if (filterOptionsResult.status === "rejected") {
    console.error(
      "[results] Unable to load filter options.",
      filterOptionsResult.reason,
    );
  }
  const data = dataResult.value;
  const filterOptions =
    filterOptionsResult.status === "fulfilled"
      ? filterOptionsResult.value
      : { leagues: [], seasons: [] };
  const selected = data.selected;

  return (
    <AppLayout>
      <div className="page-stack">
        <PageHeader
          title="Ergebnisverwaltung"
          subtitle="Die Ergebnistabelle ist die zentrale Race-Control-Arbeitsfläche."
          eyebrow="Timing & classification"
          icon={Flag}
          backHref="/admin"
          backLabel="Zurück zur Administration"
        />

        <details className="rounded-2xl border border-slate-800 bg-[#101720]" open>
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-300">
            <SlidersHorizontal size={17} className="text-blue-400" />
            Rennen und Sitzung wählen
          </summary>
          <form
            action="/admin/results"
            className="grid gap-3 border-t border-slate-800 p-4 md:grid-cols-2 xl:grid-cols-[220px_1fr_140px_190px_auto]"
          >
          <label className="master-label">
            1 · Saison
            <select
              name="seasonId"
              defaultValue={data.selected?.race.season.id ?? ""}
              className="form-control mt-2"
            >
              {filterOptions.seasons
                .filter(
                  (season) =>
                    !query.leagueId ||
                    season.participatingLeagueIds.includes(
                      query.leagueId,
                    ),
                )
                .map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                    {season.archived ? " · Archiv" : ""}
                  </option>
                ))}
            </select>
          </label>
          <label className="master-label">
            2 · Rennwochenende
            <select
              name="raceId"
              defaultValue={data.selected?.race.id ?? ""}
              className="form-control mt-2"
            >
              {data.races.map((race) => (
                <option key={race.id} value={race.id}>
                  R{race.round} · {race.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            3 · Liga
            <select
              name="leagueId"
              defaultValue={
                data.selected?.race.season.league.id ?? ""
              }
              className="form-control mt-2"
            >
              {filterOptions.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.code}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Sitzung
            <select
              name="session"
              defaultValue={session}
              className="form-control mt-2"
            >
              <option value={ResultSession.Qualifying}>
                {resultSessionLabels[ResultSession.Qualifying]}
              </option>
              <option value={ResultSession.Race}>
                {resultSessionLabels[ResultSession.Race]}
              </option>
              {data.selected?.race.sprint ? (
                <option value={ResultSession.Sprint}>
                  {resultSessionLabels[ResultSession.Sprint]}
                </option>
              ) : null}
            </select>
          </label>
          <button className="wizard-primary-button self-end">
            Ergebnis öffnen
          </button>
          </form>
        </details>

        {selected && data.weekendLeagueResults.length > 0 ? (
          <section className="rounded-2xl border border-slate-800 bg-[#101720] p-4 sm:p-5">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <p className="eyebrow">Gemeinsames Rennwochenende</p>
                <h2 className="mt-2 text-xl font-bold text-white">
                  {selected.race.name} · Runde{" "}
                  {selected.race.round}
                </h2>
              </div>
              <p className="text-sm text-slate-400">
                {resultSessionLabels[session]} für F1 bis F6
              </p>
            </div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {data.weekendLeagueResults.map(({ league, sessions }) => {
                const status = resultWorkspaceStatus(sessions, session);
                const label =
                  status === "PUBLISHED"
                    ? "Veröffentlicht"
                    : status === "DRAFT"
                      ? "Entwurf"
                      : "Noch nicht begonnen";
                const qualifyingStatus = resultWorkspaceStatus(sessions, ResultSession.Qualifying);
                const raceStatus = resultWorkspaceStatus(sessions, ResultSession.Race);
                const requiredPublished = qualifyingStatus === "PUBLISHED" && raceStatus === "PUBLISHED";
                return (
                  <Link
                    key={league.id}
                    href={`/admin/results?seasonId=${selected.race.season.id}&raceId=${selected.race.id}&leagueId=${league.id}&session=${session}`}
                    className={`rounded-xl border p-3 transition hover:border-blue-500 ${
                      league.id === selected.race.season.league.id
                        ? "border-blue-500 bg-blue-500/10"
                        : "border-slate-700 bg-slate-950/40"
                    }`}
                  >
                    <span className="text-lg font-black text-white">
                      {league.code}
                    </span>
                    <span className="mt-1 block text-xs text-slate-400">
                      {label}
                    </span>
                    <span className="mt-3 block space-y-1 border-t border-slate-700/70 pt-2 text-[0.7rem]">
                      <span className="block text-slate-300">{qualifyingStatus === "PUBLISHED" ? "✓" : "○"} Qualifying: {qualifyingStatus === "PUBLISHED" ? "Veröffentlicht" : qualifyingStatus === "DRAFT" ? "Entwurf" : "Fehlt"}</span>
                      <span className="block text-slate-300">{raceStatus === "PUBLISHED" ? "✓" : "○"} Rennen: {raceStatus === "PUBLISHED" ? "Veröffentlicht" : raceStatus === "DRAFT" ? "Entwurf" : "Fehlt"}</span>
                      <span className={`block font-bold ${requiredPublished ? "text-emerald-300" : "text-amber-300"}`}>{requiredPublished ? "Rennwochenende vollständig" : "Rennwochenende unvollständig"}</span>
                    </span>
                  </Link>
                );
              })}
            </div>
          </section>
        ) : null}

        {selected ? (
          <section className="min-w-0">
            <ResultsEditor
              key={`${selected.race.id}:${selected.race.season.league.id}:${session}`}
              data={data}
              session={session}
            />
          </section>
        ) : (
          <div className="master-card text-center text-slate-400">
            Noch keine Rennen vorhanden.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
