import AppLayout from "@/components/layout/AppLayout";
import TeamForm from "@/components/master-data/TeamForm";
import TeamLifecycleActions from "@/components/master-data/TeamLifecycleActions";
import TeamOrganizationForm from "@/components/master-data/TeamOrganizationForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataOptions,
  getTeamItems,
  getTeamOrganizationItems,
} from "@/lib/master-data/queries";

const allTeamsQuery = { q: "", active: "all" as const };

type TeamAdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamAdminPage({ searchParams }: TeamAdminPageProps) {
  await requirePermission(Permission.ManageMasterData);
  const raw = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const requestedView = first(raw.view);
  const view = requestedView === "archived" || requestedView === "all"
    ? requestedView
    : "active";
  const notice = first(raw.notice);
  const [teams, options, organizations] = await Promise.all([
    getTeamItems(allTeamsQuery, view),
    getMasterDataOptions(),
    getTeamOrganizationItems(),
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
        {notice ? (
          <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {notice === "archived"
              ? "Team wurde archiviert. Historische Daten bleiben erhalten."
              : notice === "restored"
                ? "Team wurde wiederhergestellt."
                : "Team wurde endgültig gelöscht."}
          </div>
        ) : null}
        <section className="master-card">
          <h2 className="mb-2 text-xl font-semibold text-white">
            Globale Teamorganisation
          </h2>
          <p className="mb-5 text-sm text-slate-400">
            Stabile Identität für dasselbe Team über F1 bis F6 und
            saisonbezogene Teamchef-Zuordnung.
          </p>
          <TeamOrganizationForm options={options} />
        </section>
        <div className="space-y-4">
          {organizations.map((organization) => (
            <details key={organization.id} className="master-card">
              <summary className="cursor-pointer list-none">
                <div className="flex items-center gap-3">
                  <span
                    className="h-9 w-1.5 rounded-full"
                    style={{ backgroundColor: organization.color }}
                  />
                  <div>
                    <h2 className="font-semibold text-white">
                      {organization.name} · {organization.shortName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {organization.seasons.length} Saison-Zuordnung(en)
                    </p>
                  </div>
                </div>
              </summary>
              <div className="mt-5 border-t border-slate-800 pt-5">
                <TeamOrganizationForm
                  options={options}
                  organization={organization}
                />
              </div>
            </details>
          ))}
        </div>
        <section className="master-card">
          <h2 className="mb-5 text-xl font-semibold text-white">
            Neues Team
          </h2>
          <TeamForm options={options} />
        </section>
        <nav aria-label="Teamfilter" className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950/35 p-2 sm:flex sm:w-fit">
          {[
            ["active", "Aktive Teams"],
            ["archived", "Archivierte Teams"],
            ["all", "Alle Teams"],
          ].map(([value, label]) => (
            <a key={value} href={`/admin/teams?view=${value}`} className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-center text-xs font-bold sm:text-sm ${view === value ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}>
              {label}
            </a>
          ))}
        </nav>
        <div className="space-y-4">
          {teams.map((team) => (
            <article
              key={team.id}
              className="master-card"
              style={{ borderLeftColor: team.color, borderLeftWidth: 4 }}
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-white">
                      {team.name} · {team.shortName}
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {team.league.code} · {team.season?.name ?? "Keine Saison"}
                      {team.organization
                        ? ` · ${team.organization.shortName}`
                        : " · keine globale Organisation"}
                    </p>
                  </div>
                  <div className="flex flex-col items-start gap-3 sm:items-end">
                    <span className={team.archivedAt ? "rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200" : "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-bold text-emerald-200"}>
                      {team.archivedAt ? "Archiviert" : "Aktiv"}
                    </span>
                    <TeamLifecycleActions team={team} />
                  </div>
                </div>
              {team.activeDrivers.length ? (
                <div className="mt-5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-4 text-sm text-slate-300">
                  <p className="font-bold text-amber-100">Aktive Fahrerzuordnungen</p>
                  <div className="mt-2 flex flex-wrap gap-2">{team.activeDrivers.map((driver) => <span key={driver.id} className="rounded-full bg-slate-900 px-3 py-1">{driver.leagueCode} · {driver.name}</span>)}</div>
                </div>
              ) : null}
              {!team.archivedAt ? (
                <details id={`team-${team.id}-editor`} className="mt-5 border-t border-slate-800 pt-5">
                  <summary className="flex min-h-11 cursor-pointer items-center font-bold text-blue-200">Bearbeiten</summary>
                  <div className="mt-4"><TeamForm options={options} team={team} /></div>
                </details>
              ) : (
                <div className="mt-5 border-t border-slate-800 pt-5">
                  <p className="text-sm font-bold text-white">Historische Besetzung</p>
                  <div className="mt-3 flex flex-wrap gap-2">{team.drivers.length ? team.drivers.map((driver) => <span key={driver.id} className="rounded-full border border-slate-700 px-3 py-1 text-sm text-slate-300">#{driver.number} {driver.name}</span>) : <span className="text-sm text-slate-500">Keine direkte Fahrerzuordnung gespeichert.</span>}</div>
                </div>
              )}
            </article>
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
