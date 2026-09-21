import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import ListFilters from "@/components/master-data/ListFilters";
import DriverCharacter from "@/components/characters/DriverCharacter";
import TeamLogo from "@/components/teams/TeamLogo";
import PageHeader from "@/components/ui/PageHeader";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getDriverItems,
  getMasterDataFilterOptions,
  parseMasterDataListQuery,
} from "@/lib/master-data/queries";

type DriversPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function DriversPage({
  searchParams,
}: DriversPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const query = parseMasterDataListQuery(await searchParams);
  const [drivers, options] = await Promise.all([
    getDriverItems(query),
    getMasterDataFilterOptions(),
  ]);
  const canManage = hasPermission(
    user.roles,
    Permission.ManageMasterData,
  );

  return (
    <AppLayout>
      <div className="page-stack page-accent-drivers">
        <PageHeader title="Fahrerfeld" eyebrow="Paddock registry" subtitle="Alle aktiven FRL-Fahrer, Startnummern und Teamzuordnungen in einer kompakten Grid-Ansicht." icon={Users}>
          {canManage ? (
            <Link href="/admin/drivers" className="wizard-primary-button">
              Fahrer verwalten
            </Link>
          ) : null}
        </PageHeader>
        <ListFilters
          action="/drivers"
          query={query}
          leagues={options.leagues}
          showActive
        />
        <section className="data-table-shell" aria-label="FRL Fahrerfeld">
          <div className="hidden grid-cols-[4rem_5rem_minmax(12rem,1.4fr)_minmax(10rem,1fr)_7rem_3rem] items-center gap-4 border-b border-slate-700/70 bg-slate-950/70 px-5 py-3 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-slate-500 lg:grid">
            <span>Nr.</span><span>Fahrer</span><span>Name</span><span>Team</span><span>Status</span><span />
          </div>
          {drivers.map((driver) => (
            <Link
              key={driver.id}
              href={`/drivers/${driver.id}`}
              className="group grid min-h-24 grid-cols-[3rem_3.5rem_minmax(0,1fr)_2.75rem] items-center gap-3 border-b border-slate-800/80 px-4 py-4 transition last:border-b-0 hover:bg-blue-500/[0.06] lg:grid-cols-[4rem_5rem_minmax(12rem,1.4fr)_minmax(10rem,1fr)_7rem_3rem] lg:gap-4 lg:px-5"
            >
              <span className="font-mono text-2xl font-black text-white">{String(driver.number).padStart(2, "0")}</span>
              <span className="flex size-14 items-end justify-center overflow-hidden border border-white/10 bg-slate-950/70 lg:size-16"><DriverCharacter configuration={driver.character.configuration} teamSuit={driver.teamSuit.configuration} pose={driver.character.normalPose} variant="head" driverNumber={driver.number} driverInitials={driver.name} alt={`Fahrercharakter von ${driver.name}`} className="size-14 lg:size-16" showShadow={false} /></span>
              <span className="min-w-0"><span className="flex items-center gap-2"><CountryFlag countryCode={driver.countryCode} fallbackFlag={driver.flag} size="sm" /><span className="truncate font-bold text-white">{driver.name}</span></span><span className="mt-1 block text-xs font-bold uppercase tracking-[0.12em] text-blue-300">FRL {driver.league.code}</span></span>
              <span className="col-start-3 flex min-w-0 items-center gap-2 text-sm text-slate-400 lg:col-start-auto">{driver.team ? <TeamLogo logoUrl={driver.team.logoUrl} teamName={driver.team.name} shortName={driver.team.shortName} primaryColor={driver.team.color} size="xs" /> : null}<span className="truncate">{driver.team?.name ?? "Ohne Team"}</span></span>
              <span className={`col-start-3 text-xs font-bold uppercase tracking-wider lg:col-start-auto ${driver.active ? "text-emerald-300" : "text-slate-500"}`}>{driver.active ? "Aktiv" : "Inaktiv"}</span>
              <ArrowRight size={17} className="col-start-4 row-start-1 justify-self-end text-slate-600 transition group-hover:text-blue-300 lg:col-start-auto lg:row-start-auto" />
            </Link>
          ))}
        </section>
        {drivers.length === 0 ? (
          <div className="master-card text-center">
            <Users className="mx-auto text-slate-500" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Keine Fahrer gefunden
            </h2>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
