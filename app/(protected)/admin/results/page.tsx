import AppLayout from "@/components/layout/AppLayout";
import ResultsEditor from "@/components/championship/ResultsEditor";
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
    getResultAdminData(query.raceId, query.leagueId),
    getMasterDataFilterOptions(),
  ]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Rennergebnisse verwalten
          </h1>
          <p className="mt-2 text-slate-400">
            Rennen und Sprint vollständig, validiert und transaktional
            erfassen.
          </p>
        </div>

        <form
          action="/admin/results"
          className="master-card grid gap-3 md:grid-cols-[180px_1fr_220px_auto]"
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
            Rennen
            <select
              name="raceId"
              defaultValue={data.selected?.race.id ?? ""}
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
            Sitzung
            <select
              name="session"
              defaultValue={session}
              className="form-control mt-2"
            >
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

        {data.selected ? (
          <section className="master-card">
            <div className="mb-5 border-b border-slate-800 pb-5">
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
            <ResultsEditor data={data} session={session} />
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
