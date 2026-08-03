import Link from "next/link";
import { ArrowLeft, MessageCircle, Users } from "lucide-react";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import TeamLogo from "@/components/teams/TeamLogo";
import { DriverLineupStatus } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getGlobalTeamDetail } from "@/lib/teams/queries";

type TeamDetailPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ seasonId?: string }>;
};

export default async function TeamDetailPage({ params, searchParams }: TeamDetailPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const id = Number((await params).id);
  const seasonId = Number((await searchParams).seasonId);
  if (!Number.isInteger(id) || id <= 0) notFound();
  const team = await getGlobalTeamDetail(id, Number.isInteger(seasonId) && seasonId > 0 ? seasonId : undefined);
  if (!team) notFound();
  const canManage = hasPermission(user.roles, Permission.ManageMasterData);
  const primaries = team.leagues.flatMap((league) => league.primaryDrivers);
  const substitutes = team.leagues.flatMap((league) => league.substitutes);

  return (
    <AppLayout>
      <div className="page-stack page-accent-teams">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Link href="/teams" className="inline-flex min-h-11 items-center gap-2 text-sm text-slate-400"><ArrowLeft size={16} />Zur Teamübersicht</Link>
          {canManage ? <Link href="/admin/teams" className="wizard-primary-button">Team verwalten</Link> : null}
        </div>
        <section className="master-card overflow-hidden p-0">
          <div className="h-2" style={{ backgroundColor: team.color }} />
          <div className="p-5 sm:p-7 lg:p-8">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex items-center gap-4">
                <TeamLogo logoUrl={team.logoUrl} teamName={team.name} shortName={team.shortName} primaryColor={team.color} size="lg" priority />
                <div><p className="eyebrow">{team.season?.name ?? "Keine Saison"}</p><div className="mt-2 flex flex-wrap items-center gap-3"><h1 className="break-words text-3xl font-black text-white sm:text-4xl">{team.name}</h1>{team.archived ? <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-bold text-amber-200">Archiviert</span> : null}</div><p className="mt-1 font-mono text-slate-400">{team.shortName}</p></div>
              </div>
              <form action={`/teams/${id}`} className="grid gap-2 sm:grid-cols-[1fr_auto]"><select name="seasonId" defaultValue={team.season?.id ?? ""} className="form-control">{team.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}</option>)}</select><button className="wizard-secondary-button">Saison</button></form>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Metric label="Stammfahrer" value={primaries.length} /><Metric label="Ersatzfahrer" value={substitutes.length} /><Metric label="Ligen" value={team.leagues.filter((league) => league.primaryDrivers.length || league.substitutes.length).length} /><Metric label="Teamchef" value={team.principalName} />
            </div>
          </div>
        </section>

        <section>
          <div className="mb-4 flex items-center gap-2"><Users size={21} className="text-blue-300" /><h2 className="text-2xl font-black text-white">Besetzung F1 bis F6</h2></div>
          <div className="grid gap-4 lg:grid-cols-2">
            {team.leagues.map((league) => (
              <details key={league.id} className="surface-panel group" open={league.primaryDrivers.length > 0 || league.substitutes.length > 0}>
                <summary className="flex min-h-14 cursor-pointer items-center justify-between px-5"><strong className="text-lg text-white">{league.code} · {league.primaryDrivers.length}/2 Stammplätze</strong><span className="text-xs text-slate-500">{league.substitutes.length} Ersatz</span></summary>
                <div className="space-y-4 border-t border-slate-800 p-5">
                  <LineupGroup title="Stammfahrer" drivers={league.primaryDrivers} />
                  {Array.from({ length: Math.max(0, 2 - league.primaryDrivers.length) }, (_, index) => <div key={index} className="rounded-xl border border-dashed border-slate-700 p-4 text-sm text-slate-500">Noch kein Fahrer zugeordnet</div>)}
                  <LineupGroup title="Ersatzfahrer" drivers={league.substitutes} empty="Keine Ersatzfahrer" />
                </div>
              </details>
            ))}
          </div>
        </section>

        <aside className="surface-panel p-5"><MessageCircle size={21} className="text-blue-300" /><h2 className="mt-3 font-bold text-white">Teamchef</h2><p className="mt-2 text-sm text-slate-400">{team.principalName}</p></aside>
      </div>
    </AppLayout>
  );
}

type DetailDriver = NonNullable<Awaited<ReturnType<typeof getGlobalTeamDetail>>>["leagues"][number]["primaryDrivers"][number];

function LineupGroup({ title, drivers, empty }: { title: string; drivers: DetailDriver[]; empty?: string }) {
  return <div><h3 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-500">{title}</h3><div className="space-y-2">{drivers.map((driver) => <Link key={driver.id} href={`/drivers/${driver.id}`} className="flex min-h-12 items-center justify-between gap-3 rounded-xl bg-slate-950/45 px-4"><span className="flex min-w-0 items-center gap-2"><CountryFlag countryCode={driver.countryCode} size="sm" /><span className="truncate">#{driver.number} {driver.name}</span></span><span className={driver.active ? "text-xs text-emerald-300" : "text-xs text-slate-500"}>{driver.lineupStatus === DriverLineupStatus.Primary ? "Stamm" : "Ersatz"}</span></Link>)}{drivers.length === 0 && empty ? <p className="text-sm text-slate-600">{empty}</p> : null}</div></div>;
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-3"><p className="text-xs text-slate-500">{label}</p><p className="mt-1 break-words font-bold text-white">{value}</p></div>;
}
