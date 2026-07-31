import Link from "next/link";
import { ArrowRight, Flag } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ListFilters from "@/components/master-data/ListFilters";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataFilterOptions,
  getTeamItems,
  parseMasterDataListQuery,
} from "@/lib/master-data/queries";

type TeamsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const query = parseMasterDataListQuery(await searchParams);
  const [teams, options] = await Promise.all([
    getTeamItems(query),
    getMasterDataFilterOptions(),
  ]);
  const canManage = hasPermission(
    user.roles,
    Permission.ManageMasterData,
  );

  return (
    <AppLayout>
      <div className="page-accent-teams space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Teams</h1>
            <p className="mt-2 text-slate-400">
              Saisonbezogene Teams und aktuelle Fahreraufstellungen.
            </p>
          </div>
          {canManage ? (
            <Link href="/admin/teams" className="wizard-primary-button">
              Teams verwalten
            </Link>
          ) : null}
        </div>
        <ListFilters
          action="/teams"
          query={query}
          leagues={options.leagues}
          seasons={options.seasons}
          showActive
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {teams.map((team) => (
            <Link
              key={team.id}
              href={`/teams/${team.id}`}
              className="master-card group transition hover:-translate-y-1"
              style={{ borderTopColor: team.color, borderTopWidth: 4 }}
            >
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                    {team.league.code} · {team.season?.name ?? "Keine Saison"}
                  </p>
                  <h2 className="mt-2 text-xl font-semibold text-white">
                    {team.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {team.principal?.displayName ?? "Kein Team Principal"}
                  </p>
                </div>
                <span className="rounded-lg bg-slate-800 px-3 py-2 font-mono text-sm">
                  {team.shortName}
                </span>
              </div>
              <p className="mt-5 text-sm text-slate-400">
                {team.drivers.length} Fahrer im Line-up
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
                <span className={team.active ? "text-green-300" : "text-slate-500"}>
                  {team.active ? "Aktiv" : "Inaktiv"}
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  Details <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
        {teams.length === 0 ? (
          <div className="master-card text-center">
            <Flag className="mx-auto text-slate-500" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Keine Teams gefunden
            </h2>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
