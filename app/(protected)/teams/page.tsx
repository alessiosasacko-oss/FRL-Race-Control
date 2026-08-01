import Link from "next/link";
import { ArrowRight, Flag, Search } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { Permission, hasPermission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getGlobalTeamOverview } from "@/lib/teams/queries";

type TeamsPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function TeamsPage({ searchParams }: TeamsPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const raw = await searchParams;
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const q = first(raw.q)?.trim() ?? "";
  const seasonId = Number(first(raw.seasonId));
  const data = await getGlobalTeamOverview({ q, seasonId: Number.isInteger(seasonId) && seasonId > 0 ? seasonId : undefined });
  const canManage = hasPermission(user.roles, Permission.ManageMasterData);

  return (
    <AppLayout>
      <div className="page-stack page-accent-teams">
        <PageHeader title="Teams" eyebrow="FRL Teams" subtitle="Jedes Team einmal – mit seiner Besetzung von F1 bis F6." icon={Flag}>
          {canManage ? <Link href="/admin/teams" className="wizard-primary-button">Teams verwalten</Link> : null}
        </PageHeader>

        <form action="/teams" className="surface-panel grid gap-3 p-4 sm:grid-cols-[minmax(0,1fr)_minmax(12rem,.45fr)_auto]">
          <label className="master-label">Suche<div className="relative mt-2"><Search size={17} className="absolute left-3 top-3.5 text-slate-500" /><input name="q" defaultValue={q} placeholder="Team oder Fahrer" className="form-control pl-10" /></div></label>
          <label className="master-label">Saison<select name="seasonId" defaultValue={data.season?.id ?? ""} className="form-control mt-2">{data.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select></label>
          <button className="wizard-primary-button self-end">Anzeigen</button>
        </form>

        {data.organizations.length ? (
          <div className="grid gap-5 xl:grid-cols-2">
            {data.organizations.map((team) => (
              <article key={team.id} className="master-card overflow-hidden p-0">
                <div className="h-1.5" style={{ backgroundColor: team.color }} />
                <div className="p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div><p className="eyebrow">{data.season?.name ?? "Keine Saison"}</p><h2 className="mt-2 text-2xl font-black text-white">{team.name}</h2><p className="mt-1 text-sm text-slate-400">Teamchef: {team.principalName}</p></div>
                    <span className="rounded-xl bg-slate-800 px-3 py-2 font-mono text-sm font-bold">{team.shortName}</span>
                  </div>
                  <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {team.leagues.map((league) => (
                      <div key={league.id} className="rounded-xl border border-slate-800 bg-slate-950/35 p-3">
                        <div className="flex items-center justify-between"><strong className="text-white">{league.code}</strong><span className="text-xs text-slate-400">{league.primaryDrivers.length}/2</span></div>
                        <div className="mt-3 space-y-2">
                          {league.primaryDrivers.map((driver) => <DriverLine key={driver.id} driver={driver} />)}
                          {Array.from({ length: Math.max(0, 2 - league.primaryDrivers.length) }, (_, index) => <p key={index} className="text-xs italic text-slate-600">Freier Stammplatz</p>)}
                          {league.substitutes.length ? <p className="border-t border-slate-800 pt-2 text-[0.65rem] font-bold uppercase tracking-wider text-amber-300">{league.substitutes.length} Ersatzfahrer</p> : null}
                        </div>
                      </div>
                    ))}
                  </div>
                  {team.representativeTeamId ? <Link href={`/teams/${team.representativeTeamId}`} className="wizard-secondary-button mt-5 w-full sm:w-auto">Details <ArrowRight size={16} /></Link> : null}
                </div>
              </article>
            ))}
          </div>
        ) : <EmptyState icon={<Flag size={23} />} title="Keine Teams gefunden" description="Für diese Saison wurden noch keine Teams angelegt." />}
      </div>
    </AppLayout>
  );
}

type OverviewDriver = Awaited<ReturnType<typeof getGlobalTeamOverview>>["organizations"][number]["leagues"][number]["primaryDrivers"][number];

function DriverLine({ driver }: { driver: OverviewDriver }) {
  return <Link href={`/drivers/${driver.id}`} className="flex min-h-11 items-center gap-2 rounded-lg bg-slate-900/70 px-2 text-xs text-slate-200"><CountryFlag countryCode={driver.countryCode} size="sm" /><span className="min-w-0 truncate">#{driver.number} {driver.name}</span></Link>;
}
