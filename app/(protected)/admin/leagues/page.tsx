import AppLayout from "@/components/layout/AppLayout";
import LeagueForm from "@/components/master-data/LeagueForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getLeagueAdminItems } from "@/lib/master-data/queries";

export default async function LeagueAdminPage() {
  await requirePermission(Permission.ManageMasterData);
  const leagues = await getLeagueAdminItems();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Ligen &amp; Rennzeiten
          </h1>
          <p className="mt-2 text-slate-400">
            Namen, Status, Reihenfolge und der automatische Wochenend-Zeitplan
            für F1 bis F6 werden zentral verwaltet.
          </p>
        </div>
        <div className="grid gap-5 xl:grid-cols-2">
          {leagues.map((league) => (
            <section key={league.id} className="master-card">
              <div className="mb-5 flex flex-wrap items-start justify-between gap-3 border-b border-slate-800 pb-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                    {league.code}
                  </p>
                  <h2 className="mt-1 text-xl font-semibold text-white">
                    {league.name}
                  </h2>
                </div>
                <p className="text-xs text-slate-500">
                  {league.counts.drivers} Fahrer · {league.counts.teams} Teams ·{" "}
                  {league.counts.tickets} FIA-Tickets
                </p>
              </div>
              <LeagueForm league={league} />
            </section>
          ))}
        </div>
        {leagues.length === 0 ? (
          <div className="master-card text-center text-slate-400">
            Keine Ligen vorhanden. Führe den Entwicklungs-Seed aus, um F1 bis
            F6 anzulegen.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
