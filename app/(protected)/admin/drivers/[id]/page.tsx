import Link from "next/link";
import { Gauge, UserRound } from "lucide-react";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import DriverForm from "@/components/master-data/DriverForm";
import CountryFlag from "@/components/ui/CountryFlag";
import PageHeader from "@/components/ui/PageHeader";
import DriverDangerZone from "@/components/users/DriverDangerZone";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { getDriverById, getDriverFormOptions } from "@/lib/master-data/queries";
import { getDriverDeletionSnapshotByDriverId } from "@/lib/users/driver-dependencies";

type DriverAdminDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DriverAdminDetailPage({
  params,
}: DriverAdminDetailPageProps) {
  const actor = await requirePermission(Permission.ManageMasterData);
  const driverId = Number((await params).id);
  if (!Number.isInteger(driverId) || driverId <= 0) notFound();

  const [driver, options, deletionSnapshot] = await Promise.all([
    getDriverById(driverId),
    getDriverFormOptions(),
    getDriverDeletionSnapshotByDriverId(getPrismaClient(), driverId),
  ]);
  if (!driver || !deletionSnapshot) notFound();

  return (
    <AppLayout>
      <div className="page-stack page-accent-admin min-w-0">
        <PageHeader
          title={driver.name}
          eyebrow="Fahrerverwaltung"
          subtitle="Profil, sportliche Zuordnung, Verknüpfungen und sichere Lebenszyklusaktionen."
          icon={Gauge}
          backHref="/admin/drivers"
          backLabel="Zur Fahrerverwaltung"
        />

        <section className="surface-panel p-5 sm:p-6">
          <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.55fr)]">
            <div className="flex min-w-0 items-start gap-4">
              <CountryFlag countryCode={driver.countryCode} fallbackFlag={driver.flag} size="lg" showLabel />
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="break-words text-2xl font-black text-white">#{driver.number} {driver.name}</h2>
                  <span className={driver.active ? "text-emerald-300" : "text-slate-500"}>{driver.active ? "Aktiv" : "Inaktiv"}</span>
                </div>
                <p className="mt-2 text-sm text-slate-400">
                  {driver.assignment
                    ? `${driver.assignment.season.name} · ${driver.assignment.league.code} · ${driver.assignment.organization?.name ?? "Ohne Team"}`
                    : "Keine aktive Saisonzuordnung"}
                </p>
                <p className="mt-1 text-sm text-slate-500">
                  {driver.assignment?.lineupStatus === "SUBSTITUTE" ? "Ersatzfahrer" : "Stammfahrer"} · {driver.ticketCount} FIA-Verknüpfungen · {driver.standingCount} Tabellenstände
                </p>
              </div>
            </div>
            <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4">
              <div className="flex items-center gap-2 text-white"><UserRound size={18} /><strong>Benutzerkonto</strong></div>
              {driver.user ? (
                <>
                  <p className="mt-3 break-words text-sm text-slate-300">{driver.user.displayName}</p>
                  <p className="mt-1 text-xs text-slate-500">Discord: {driver.user.discordId ? "Verknüpft" : "Nicht verknüpft"}</p>
                  <Link href={`/admin/users/${driver.user.id}`} className="wizard-secondary-button mt-4 min-h-11 w-full">Benutzerkonto separat verwalten</Link>
                </>
              ) : (
                <p className="mt-3 text-sm leading-6 text-slate-400">Kein Benutzerkonto verknüpft. Der Fahrer kann trotzdem vollständig verwaltet werden.</p>
              )}
            </div>
          </div>
          {driver.diagnostics.length ? (
            <div className="mt-5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              <strong>Zuordnungsdiagnose</strong>
              <ul className="mt-2 space-y-1">{driver.diagnostics.map((message) => <li key={message}>• {message}</li>)}</ul>
            </div>
          ) : null}
        </section>

        <section id="edit" className="surface-panel scroll-mt-24 p-5 sm:p-6">
          <p className="eyebrow">Fahrerprofil</p>
          <h2 className="mt-2 text-xl font-black text-white">Fahrer bearbeiten</h2>
          <div className="mt-5"><DriverForm options={options} driver={driver} /></div>
        </section>

        <DriverDangerZone mode="driver" snapshot={deletionSnapshot} actorRoles={actor.roles} />
      </div>
    </AppLayout>
  );
}
