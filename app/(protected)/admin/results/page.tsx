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
  const [data, filterOptions] = await Promise.all([
    getResultAdminData(
      query.raceId,
      query.leagueId,
      query.seasonId,
    ),
    getMasterDataFilterOptions(),
  ]);

  return (
    <AppLayout>
      <div className="page-stack">
        <PageHeader
          title="Ergebnisverwaltung"
          subtitle="Die Ergebnistabelle ist die zentrale Race-Control-Arbeitsfläche."
          eyebrow="Timing & classification"
          icon={Flag}
        />

        <details className="rounded-2xl border border-slate-800 bg-[#101720]" open>
          <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-300">
            <SlidersHorizontal size={17} className="text-blue-400" />
            Rennen und Sitzung wählen
          </summary>
          <form
            action="/admin/results"
            className="grid gap-3 border-t border-slate-800 p-4 md:grid-cols-2 xl:grid-cols-[140px_220px_1fr_190px_auto]"
          >
          <label className="master-label">
            Liga
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
            Saison
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
            Rennen
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
            Laden
          </button>
          </form>
        </details>

        {data.selected ? (
          <section>
            <div className="mb-5 flex flex-col gap-3 border-l-4 border-blue-500 bg-blue-500/5 px-5 py-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
              <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                {data.selected.race.season.league.code} ·{" "}
                {data.selected.race.season.name} · Runde{" "}
                {data.selected.race.round}
              </p>
              <h2 className="mt-2 text-2xl font-semibold text-white">
                {data.selected.race.name} ·{" "}
                {resultSessionLabels[session]}
              </h2>
              </div>
              <p className="text-sm text-slate-400">
                Positionen, Abstände, FIA-Strafen und Endklassifikation
              </p>
            </div>
            <ResultsEditor
              key={`${data.selected.race.id}:${data.selected.race.season.league.id}:${session}`}
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
