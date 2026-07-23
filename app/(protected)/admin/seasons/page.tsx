import AppLayout from "@/components/layout/AppLayout";
import SeasonForm from "@/components/master-data/SeasonForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataOptions,
  getSeasonAdminItems,
} from "@/lib/master-data/queries";

export default async function SeasonAdminPage() {
  await requirePermission(Permission.ManageMasterData);
  const [seasons, options] = await Promise.all([
    getSeasonAdminItems(),
    getMasterDataOptions(),
  ]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Saisons verwalten
          </h1>
          <p className="mt-2 text-slate-400">
            Saisonzeiträume pflegen und abgeschlossene Saisons archivieren.
          </p>
        </div>
        <section className="master-card">
          <h2 className="mb-5 text-xl font-semibold text-white">
            Neue Saison
          </h2>
          <SeasonForm leagues={options.leagues} />
        </section>
        <div className="space-y-4">
          {seasons.map((season) => (
            <details key={season.id} className="master-card">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-wider text-blue-400">
                      {season.league.code}
                    </p>
                    <h2 className="mt-1 text-lg font-semibold text-white">
                      {season.name}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {season.startsOn} – {season.endsOn}
                    </p>
                  </div>
                  <div className="text-right text-xs text-slate-500">
                    <p>
                      {season.archived
                        ? "Archiviert"
                        : season.active
                          ? "Aktiv"
                          : "Inaktiv"}
                    </p>
                    <p>{season.counts.races} Rennen · {season.counts.teams} Teams</p>
                  </div>
                </div>
              </summary>
              <div className="mt-5 border-t border-slate-800 pt-5">
                <SeasonForm leagues={options.leagues} season={season} />
              </div>
            </details>
          ))}
        </div>
        {seasons.length === 0 ? (
          <div className="master-card text-center text-slate-400">
            Noch keine Saisons vorhanden.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
