import AppLayout from "@/components/layout/AppLayout";
import { CalendarCog } from "lucide-react";
import RaceForm from "@/components/master-data/RaceForm";
import PageHeader from "@/components/ui/PageHeader";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataFilterOptions,
  getRaceAdminItems,
} from "@/lib/master-data/queries";
import { getTrackOptions } from "@/lib/tracks/queries";

const allRacesQuery = {
  q: "",
  active: "all" as const,
};

export default async function RaceAdminPage() {
  await requirePermission(Permission.ManageMasterData);
  const [races, options, tracks] = await Promise.all([
    getRaceAdminItems(allRacesQuery),
    getMasterDataFilterOptions(),
    getTrackOptions(),
  ]);
  const activeSeasons = options.seasons.filter(
    (season) => season.active && !season.archived,
  );

  return (
    <AppLayout>
      <div className="page-stack page-accent-calendar">
        <PageHeader
          title="Rennkalender verwalten"
          eyebrow="Race Weekend Control"
          subtitle="Termine, Mystery-Schutz und responsive Event-Bilder zentral pro Rennwochenende pflegen."
          icon={CalendarCog}
        />
        <section className="master-card">
          <h2 className="mb-5 text-xl font-semibold text-white">
            Neues Rennen
          </h2>
          <RaceForm seasons={activeSeasons} tracks={tracks} />
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
                  <p className="text-xs text-slate-500">{race.season.name}</p>
                </div>
              </summary>
              <div className="mt-5 border-t border-slate-800 pt-5">
                <RaceForm
                  seasons={options.seasons}
                  tracks={tracks}
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
