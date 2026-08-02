import AppLayout from "@/components/layout/AppLayout";
import DriverForm from "@/components/master-data/DriverForm";
import CountryFlag from "@/components/ui/CountryFlag";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getDriverItems,
  getDriverFormOptions,
} from "@/lib/master-data/queries";

const allDriversQuery = { q: "", active: "all" as const };

type DriverAdminPageProps = {
  searchParams: Promise<{ notice?: string }>;
};

export default async function DriverAdminPage({ searchParams }: DriverAdminPageProps) {
  await requirePermission(Permission.ManageMasterData);
  const notice = (await searchParams).notice;
  const [drivers, options] = await Promise.all([
    getDriverItems(allDriversQuery),
    getDriverFormOptions(),
  ]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Fahrer verwalten
          </h1>
          <p className="mt-2 text-slate-400">
            Fahrerprofile, Discord-Verknüpfung und sportliche Zuordnung.
          </p>
        </div>
        {notice === "deleted" ? (
          <p role="status" className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-semibold text-emerald-200">
            Der Fahrer wurde endgültig gelöscht. Ein verknüpftes Benutzerkonto ist erhalten geblieben.
          </p>
        ) : null}
        <section className="master-card">
          <h2 className="mb-5 text-xl font-semibold text-white">
            Neuer Fahrer
          </h2>
          <DriverForm options={options} />
        </section>
        <div className="space-y-4">
          {drivers.map((driver) => (
            <details key={driver.id} className="master-card">
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="font-semibold text-white">
                      <span className="inline-flex items-center gap-2"><CountryFlag countryCode={driver.countryCode} fallbackFlag={driver.flag} size="sm" />#{driver.number} {driver.name}</span>
                    </h2>
                    <p className="mt-1 text-sm text-slate-400">
                      {driver.league.code} · {driver.team?.name ?? "Ohne Team"}
                      {driver.assignment ? ` · ${driver.assignment.season.name} · ${driver.assignment.lineupStatus === "PRIMARY" ? "Stammfahrer" : "Ersatzfahrer"}` : ""}
                    </p>
                  </div>
                  <span className={driver.active ? "text-green-300" : "text-slate-500"}>
                    {driver.active ? "Aktiv" : "Inaktiv"}
                  </span>
                </div>
              </summary>
              <nav aria-label={`Aktionen für ${driver.name}`} className="mt-4 grid gap-2 border-t border-slate-800 pt-4 sm:grid-cols-3">
                <Link href={`/admin/drivers/${driver.id}#edit`} className="wizard-secondary-button min-h-11 w-full"><Pencil size={17} />Bearbeiten</Link>
                <Link href={`/admin/drivers/${driver.id}#danger-zone`} className="wizard-secondary-button min-h-11 w-full"><Power size={17} />{driver.active ? "Deaktivieren" : "Reaktivieren"}</Link>
                <Link href={`/admin/drivers/${driver.id}#danger-zone`} className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 px-4 font-bold text-red-200 hover:bg-red-500/20"><Trash2 size={17} />Fahrer löschen</Link>
              </nav>
              <div className="mt-5 border-t border-slate-800 pt-5">
                {driver.diagnostics.length > 0 ? (
                  <div className="mb-4 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                    <strong>Zuordnungsdiagnose</strong>
                    <ul className="mt-2 space-y-1">
                      {driver.diagnostics.map((diagnostic) => (
                        <li key={diagnostic}>• {diagnostic}</li>
                      ))}
                    </ul>
                    <p className="mt-2 text-xs text-amber-200/80">
                      Widersprüchliche Werte werden nicht geraten. Eine bestätigte Auswahl im Formular normalisiert die Legacy-Felder sicher.
                    </p>
                  </div>
                ) : null}
                <DriverForm options={options} driver={driver} />
              </div>
            </details>
          ))}
        </div>
        {drivers.length === 0 ? (
          <div className="master-card text-center text-slate-400">
            Noch keine Fahrer vorhanden.
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
import Link from "next/link";
import { Pencil, Power, Trash2 } from "lucide-react";
