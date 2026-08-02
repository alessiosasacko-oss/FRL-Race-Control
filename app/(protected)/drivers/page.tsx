import Link from "next/link";
import { ArrowRight, Users } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import ListFilters from "@/components/master-data/ListFilters";
import DriverCharacter from "@/components/characters/DriverCharacter";
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
      <div className="page-accent-drivers space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Fahrer</h1>
            <p className="mt-2 text-slate-400">
              Fahrerfeld aller FRL-Ligen.
            </p>
          </div>
          {canManage ? (
            <Link href="/admin/drivers" className="wizard-primary-button">
              Fahrer verwalten
            </Link>
          ) : null}
        </div>
        <ListFilters
          action="/drivers"
          query={query}
          leagues={options.leagues}
          showActive
        />
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {drivers.map((driver) => (
            <Link
              key={driver.id}
              href={`/drivers/${driver.id}`}
              className="master-card group transition hover:-translate-y-1 hover:border-blue-500"
            >
              <div className="mb-3 flex h-32 items-end justify-center overflow-hidden rounded-xl bg-slate-950/70">
                <DriverCharacter configuration={driver.character.configuration} teamSuit={driver.teamSuit.configuration} pose={driver.character.normalPose} variant="portrait" driverNumber={driver.number} driverInitials={driver.name} alt={`Fahrercharakter von ${driver.name}`} className="h-36 w-auto" showShadow={false} />
              </div>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CountryFlag countryCode={driver.countryCode} fallbackFlag={driver.flag} size="lg" />
                  <h2 className="mt-3 text-xl font-semibold text-white">
                    {driver.name}
                  </h2>
                  <p className="mt-1 text-sm text-slate-400">
                    {driver.league.code} · {driver.team?.name ?? "Ohne Team"}
                  </p>
                </div>
                <span className="rounded-xl bg-blue-600 px-3 py-2 text-lg font-bold">
                  #{driver.number}
                </span>
              </div>
              <div className="mt-5 flex items-center justify-between border-t border-slate-800 pt-4 text-sm">
                <span className={driver.active ? "text-green-300" : "text-slate-500"}>
                  {driver.active ? "Aktiv" : "Inaktiv"}
                </span>
                <span className="flex items-center gap-1 text-blue-400">
                  Profil <ArrowRight size={16} />
                </span>
              </div>
            </Link>
          ))}
        </div>
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
