import Link from "next/link";
import AppLayout from "@/components/layout/AppLayout";
import ResultsEditor from "@/components/championship/ResultsEditor";
import PageHeader from "@/components/ui/PageHeader";
import CountryFlag from "@/components/ui/CountryFlag";
import { Flag, LockKeyhole, SlidersHorizontal } from "lucide-react";
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
  const sessionOptions = selected
    ? [ResultSession.Qualifying, ...(selected.race.sprint ? [ResultSession.Sprint] : []), ResultSession.Race]
    : [];

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
                  {race.countryCode ? `${race.countryCode} · ` : ""}ROUND {String(race.round).padStart(2, "0")} · {race.name}{race.circuit ? ` · ${race.circuit}` : ""} · {new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", timeZone: race.timezone }).format(new Date(race.scheduledAt))}
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
                  FRL {league.code} · {league.name}
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

        {selected ? (
          <section className="grid min-w-0 gap-3 rounded-2xl border border-blue-500/25 bg-[linear-gradient(135deg,rgba(37,99,235,.12),rgba(2,6,23,.72))] p-4 lg:grid-cols-[8rem_minmax(0,1fr)_minmax(18rem,.7fr)] lg:items-center">
            <div className="grid min-h-20 place-items-center rounded-xl border border-blue-300/40 bg-blue-600 text-center shadow-lg shadow-blue-950/30"><span><span className="block text-[.62rem] font-black uppercase tracking-[.2em] text-blue-100/70">Aktive Liga</span><span className="mt-1 block text-2xl font-black text-white">FRL {selected.race.season.league.code}</span></span></div>
            <div className="flex min-w-0 items-center gap-3">
              <span className="grid size-14 shrink-0 place-items-center rounded-xl border border-white/10 bg-slate-950/55">{selected.race.revealMystery ? <CountryFlag countryCode={selected.race.countryCode} size="lg" /> : <LockKeyhole className="text-amber-300" size={25} />}</span>
              <div className="min-w-0"><p className="text-xs font-bold uppercase tracking-[.16em] text-blue-300">Round {String(selected.race.round).padStart(2, "0")}</p><h2 className="mt-1 break-words text-lg font-black uppercase text-white">{selected.race.name}</h2><p className="mt-1 text-sm text-slate-400">{selected.race.revealMystery ? selected.race.circuit : "Strecke und Land bis zum Reveal geschützt"}</p></div>
            </div>
            <div><p className="mb-2 text-[.65rem] font-black uppercase tracking-[.18em] text-slate-500">Session wählen</p><div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-1 xl:grid-cols-3">{sessionOptions.map((option) => <Link key={option} href={`/admin/results?seasonId=${selected.race.season.id}&raceId=${selected.race.id}&leagueId=${selected.race.season.league.id}&session=${option}`} aria-current={session === option ? "page" : undefined} className={`grid min-h-11 place-items-center rounded-xl border px-3 text-center text-xs font-black uppercase tracking-wider transition ${session === option ? "border-blue-400 bg-blue-500/20 text-white" : "border-white/10 bg-slate-950/45 text-slate-400 hover:border-blue-400/50 hover:text-white"}`}>{resultSessionLabels[option]}</Link>)}</div></div>
          </section>
        ) : null}

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
                      FRL {league.code}
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
