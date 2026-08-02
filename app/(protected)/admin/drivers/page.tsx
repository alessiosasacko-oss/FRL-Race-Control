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

export default async function DriverAdminPage() {
  await requirePermission(Permission.ManageMasterData);
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
                <div className="flex items-center justify-between gap-4">
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
