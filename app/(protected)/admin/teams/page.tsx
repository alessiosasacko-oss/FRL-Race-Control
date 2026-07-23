import AppLayout from "@/components/layout/AppLayout";
import TeamForm from "@/components/master-data/TeamForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataOptions,
  getTeamItems,
} from "@/lib/master-data/queries";

const allTeamsQuery = { q: "", active: "all" as const };

export default async function TeamAdminPage() {
  await requirePermission(Permission.ManageMasterData);
  const [teams, options] = await Promise.all([
    getTeamItems(allTeamsQuery),
    getMasterDataOptions(),
  ]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">Teams verwalten</h1>
          <p className="mt-2 text-slate-400">
            Saisonbezogene Teams, Team Principals und Fahreraufstellungen.
          </p>
        </div>
        <section className="master-card">
          <h2 className="mb-5 text-xl font-semibold text-white">
            Neues Team
          </h2>
          <TeamForm options={options} />
        </section>
        <div className="space-y-4">
          {teams.map((team) => (
            <details
              key={team.id}
              className="master-card"
              style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}
            >
              <summary className="cursor-pointer list-none">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <h2 className="font-semibold text-white">
                      {team.name} · {team.shortName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {team.league.code} · {team.season?.name ?? "Keine Saison"}
                    </p>
                  </div>
                  <span className={team.active ? "text-green-300" : "text-slate-500"}>
                    {team.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
              </summary>
              <div className="mt-5 border-t border-slate-800 pt-5">
                <TeamForm options={options} team={team} />
              </div>
            </details>
          ))}
        </div>
        {teams.length === 0 ? (
          <div className="master-card text-center text-slate-400">
            Noch keine Teams vorhanden.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
