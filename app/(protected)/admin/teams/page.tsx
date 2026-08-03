import Link from "next/link";
import { Plus, ShieldCheck, UserPlus } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import TeamLifecycleActions from "@/components/master-data/TeamLifecycleActions";
import TeamOrganizationForm from "@/components/master-data/TeamOrganizationForm";
import TeamLogoUploader from "@/components/master-data/TeamLogoUploader";
import TeamLogo from "@/components/teams/TeamLogo";
import CountryFlag from "@/components/ui/CountryFlag";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataOptions,
  getTeamOrganizationItems,
} from "@/lib/master-data/queries";
import type { TeamOrganizationItem } from "@/lib/master-data/types";

type TeamAdminPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamAdminPage({ searchParams }: TeamAdminPageProps) {
  await requirePermission(Permission.ManageMasterData);
  const raw = await searchParams;
  const first = (value: string | string[] | undefined) =>
    Array.isArray(value) ? value[0] : value;
  const requestedView = first(raw.view);
  const view =
    requestedView === "archived" || requestedView === "all"
      ? requestedView
      : "active";
  const notice = first(raw.notice);
  const [teams, options] = await Promise.all([
    getTeamOrganizationItems(view),
    getMasterDataOptions(),
  ]);

  return (
    <AppLayout>
      <div className="page-stack page-accent-admin">
        <header>
          <p className="eyebrow">Globale Teamidentität</p>
          <h1 className="mt-2 text-3xl font-black text-white">Teams verwalten</h1>
          <p className="mt-2 max-w-3xl text-slate-400">
            Jedes Team wird genau einmal angelegt. Fahrer erhalten Liga und Team
            saisonbezogen in der Benutzerverwaltung.
          </p>
        </header>

        {notice ? (
          <div role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm text-emerald-200">
            {notice === "archived"
              ? "Team wurde mit allen technischen Liga-Slots archiviert. Historische Daten bleiben erhalten."
              : notice === "restored"
                ? "Team wurde wiederhergestellt."
                : "Team wurde endgültig gelöscht."}
          </div>
        ) : null}

        <section className="master-card">
          <div className="mb-5 flex items-center gap-3">
            <span className="flex size-11 items-center justify-center rounded-xl bg-blue-500/10 text-blue-300"><Plus size={20} /></span>
            <div>
              <h2 className="text-xl font-bold text-white">Neues Team erstellen</h2>
              <p className="mt-1 text-sm text-slate-400">Ohne Liga-, Saison- oder Fahrer-Auswahl.</p>
            </div>
          </div>
          <TeamOrganizationForm options={options} />
        </section>

        <nav aria-label="Teamfilter" className="grid grid-cols-3 gap-2 rounded-xl border border-slate-800 bg-slate-950/35 p-2 sm:flex sm:w-fit">
          {[
            ["active", "Aktive Teams"],
            ["archived", "Archivierte Teams"],
            ["all", "Alle Teams"],
          ].map(([value, label]) => (
            <Link key={value} href={`/admin/teams?view=${value}`} className={`flex min-h-11 items-center justify-center rounded-lg px-3 text-center text-xs font-bold sm:text-sm ${view === value ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-slate-800"}`}>
              {label}
            </Link>
          ))}
        </nav>

        <div className="space-y-5">
          {teams.map((team) => (
            <TeamCard key={team.id} team={team} options={options} />
          ))}
        </div>
        {teams.length === 0 ? (
          <div className="master-card text-center text-slate-400">
            In dieser Ansicht sind noch keine Teams vorhanden.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}

function TeamCard({
  team,
  options,
}: {
  team: TeamOrganizationItem;
  options: Awaited<ReturnType<typeof getMasterDataOptions>>;
}) {
  return (
    <article id={`team-${team.id}`} className="master-card overflow-hidden p-0">
      <div className="h-1.5" style={{ backgroundColor: team.color }} />
      <div className="p-4 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <TeamLogo logoUrl={team.logoUrl} teamName={team.name} shortName={team.shortName} primaryColor={team.color} size="lg" priority />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="break-words text-2xl font-black text-white">{team.name}</h2>
                <span className="rounded-lg bg-slate-800 px-2 py-1 font-mono text-xs font-bold">{team.shortName}</span>
                <span className={team.archivedAt ? "rounded-full border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 text-xs font-bold text-amber-200" : "rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-200"}>
                  {team.archivedAt ? "Archiviert" : "Aktiv"}
                </span>
              </div>
              <p className="mt-2 flex items-center gap-2 text-sm text-slate-400"><ShieldCheck size={16} />Teamchef: <strong className="text-slate-200">{team.principal?.displayName ?? "Nicht zugewiesen"}</strong></p>
              <p className="mt-1 text-xs text-slate-500">{team.currentSeasonName ?? "Keine aktive Saison"}</p>
            </div>
          </div>
          <TeamLifecycleActions team={team} />
        </div>

        {!team.archivedAt ? (
          <div className="mt-6">
            <TeamLogoUploader organizationId={team.id} teamName={team.name} shortName={team.shortName} primaryColor={team.color} initialLogoUrl={team.logoUrl} />
          </div>
        ) : null}

        <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {team.leagues.map((league) => (
            <section key={league.id} className="min-w-0 rounded-xl border border-slate-800 bg-slate-950/35 p-3">
              <div className="flex items-center justify-between gap-3">
                <h3 className="font-black text-white">{league.code} · {league.primaryDrivers.length}/2 Stammplätze</h3>
              </div>
              <div className="mt-3 space-y-2">
                {league.primaryDrivers.map((driver) => <AdminDriverLink key={driver.id} driver={driver} />)}
                {Array.from({ length: Math.max(0, 2 - league.primaryDrivers.length) }, (_, index) => (
                  <Link key={index} href="/admin/users" className="flex min-h-11 items-center gap-2 rounded-lg border border-dashed border-slate-700 px-3 text-xs text-slate-500 hover:border-blue-500/40 hover:text-blue-200">
                    <UserPlus size={15} /> Fahrer zuweisen
                  </Link>
                ))}
              </div>
              <div className="mt-3 border-t border-slate-800 pt-3">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-amber-300">Ersatzfahrer</p>
                <div className="mt-2 space-y-2">
                  {league.substitutes.map((driver) => <AdminDriverLink key={driver.id} driver={driver} />)}
                  {league.substitutes.length === 0 ? <p className="text-xs text-slate-600">Keine Ersatzfahrer</p> : null}
                </div>
              </div>
            </section>
          ))}
        </div>

        {!team.archivedAt ? (
          <details id={`team-${team.id}-editor`} className="mt-6 border-t border-slate-800 pt-5">
            <summary className="flex min-h-11 cursor-pointer items-center font-bold text-blue-200">Team bearbeiten</summary>
            <div className="mt-4"><TeamOrganizationForm options={options} organization={team} /></div>
          </details>
        ) : null}
      </div>
    </article>
  );
}

function AdminDriverLink({
  driver,
}: {
  driver: TeamOrganizationItem["leagues"][number]["primaryDrivers"][number];
}) {
  const href = driver.userId ? `/admin/users/${driver.userId}` : `/drivers/${driver.id}`;
  return (
    <Link href={href} className="flex min-h-11 min-w-0 items-center gap-2 rounded-lg bg-slate-900/70 px-3 text-xs text-slate-200 hover:bg-slate-800">
      <CountryFlag countryCode={driver.countryCode} size="sm" />
      <span className="min-w-0 truncate">#{driver.number} {driver.name}</span>
    </Link>
  );
}
