import AppLayout from "@/components/layout/AppLayout";
import RaceForm from "@/components/master-data/RaceForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataOptions,
  getRaceItems,
} from "@/lib/master-data/queries";

const allRacesQuery = {
  q: "",
  active: "all" as const,
};

export default async function RaceAdminPage() {
  await requirePermission(Permission.ManageMasterData);
  const [races, options] = await Promise.all([
    getRaceItems(allRacesQuery),
    getMasterDataOptions(),
  ]);
  const activeSeasons = options.seasons.filter(
    (season) => season.active && !season.archived,
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Rennkalender verwalten
          </h1>
          <p className="mt-2 text-slate-400">
            Ein Rennwochenende erzeugt automatisch je aktiver Liga einen
            eigenen Termin.
          </p>
        </div>
        <section className="master-card">
          <h2 className="mb-5 text-xl font-semibold text-white">
            Neues Rennen
          </h2>
          <RaceForm seasons={activeSeasons} />
        </section>
        <div className="space-y-4">
          {races.map((race) => (
            <details key={race.id} className="master-card">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-blue-400">
                      {race.season.name} · Runde {race.round}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {race.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {race.weekendDate} · {race.leagueSchedules.length}{" "}
                      Liga-Termine
                    </p>
                  </div>
                  <p className="text-xs text-slate-500">
                    {race.ticketCount} FIA-Tickets
                  </p>
                </div>
              </summary>
              <div className="mt-5 border-t border-slate-800 pt-5">
                <RaceForm
                  seasons={options.seasons}
                  race={race}
                />
              </div>
            </details>
          ))}
        </div>
        {races.length === 0 ? (
          <div className="master-card text-center text-slate-400">
            Noch keine Rennen vorhanden.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
