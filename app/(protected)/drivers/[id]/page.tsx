import Link from "next/link";
import { ArrowLeft, BadgeInfo, MessageCircle, ShieldCheck } from "lucide-react";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getDriverById } from "@/lib/master-data/queries";
import { entityIdSchema } from "@/lib/master-data/schemas";

type DriverDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function DriverDetailPage({
  params,
}: DriverDetailPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const parsedId = entityIdSchema.safeParse((await params).id);

  if (!parsedId.success) notFound();

  const driver = await getDriverById(parsedId.data);

  if (!driver) notFound();

  const canManage = hasPermission(
    user.roles,
    Permission.ManageMasterData,
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/drivers"
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Zur Fahrerübersicht
          </Link>
          {canManage ? (
            <Link href="/admin/drivers" className="wizard-primary-button">
              Fahrer verwalten
            </Link>
          ) : null}
        </div>

        <section className="master-card overflow-hidden p-0">
          <div
            className="h-2 bg-blue-500"
            style={{ backgroundColor: driver.team?.color }}
          />
          <div className="grid gap-8 p-6 lg:grid-cols-[1fr_280px] lg:p-8">
            <div>
              <div className="flex flex-wrap items-start gap-5">
                <CountryFlag countryCode={driver.countryCode} fallbackFlag={driver.flag} size="lg" />
                <div>
                  <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
                    {driver.league.code} · Fahrer #{driver.number}
                  </p>
                  <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                    {driver.name}
                  </h1>
                  <p className="mt-2 text-slate-400">
                    {driver.team?.name ?? "Aktuell keinem Team zugeordnet"}
                  </p>
                </div>
              </div>

              <dl className="mt-8 grid gap-4 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-950/60 p-4">
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    Status
                  </dt>
                  <dd
                    className={`mt-2 font-semibold ${
                      driver.active ? "text-green-300" : "text-slate-400"
                    }`}
                  >
                    {driver.active ? "Aktiv" : "Inaktiv"}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-4">
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    Herkunft
                  </dt>
                  <dd className="mt-2 font-semibold text-white"><CountryFlag countryCode={driver.countryCode} fallbackFlag={driver.flag} showLabel /></dd>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-4">
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    Liga
                  </dt>
                  <dd className="mt-2 font-semibold text-white">
                    {driver.league.name}
                  </dd>
                </div>
                <div className="rounded-xl bg-slate-950/60 p-4">
                  <dt className="text-xs uppercase tracking-wider text-slate-500">
                    Team
                  </dt>
                  <dd className="mt-2 font-semibold text-white">
                    {driver.team ? (
                      <Link
                        href={`/teams/${driver.team.id}`}
                        className="transition hover:text-blue-300"
                      >
                        {driver.team.name}
                      </Link>
                    ) : (
                      "Ohne Team"
                    )}
                  </dd>
                </div>
              </dl>
            </div>

            <aside className="space-y-4">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <MessageCircle className="text-blue-400" size={22} />
                <h2 className="mt-3 font-semibold text-white">
                  Discord-Verknüpfung
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {driver.user
                    ? driver.user.displayName
                    : "Kein Discord-Benutzer verknüpft"}
                </p>
                {driver.user?.discordId ? (
                  <p className="mt-1 font-mono text-xs text-slate-500">
                    {driver.user.discordId}
                  </p>
                ) : null}
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                <ShieldCheck className="text-blue-400" size={22} />
                <h2 className="mt-3 font-semibold text-white">Race Control</h2>
                <p className="mt-2 text-sm text-slate-400">
                  {driver.ticketCount} FIA-Tickets · {driver.standingCount}{" "}
                  Wertungseinträge
                </p>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <BadgeInfo size={15} />
                Zuletzt aktualisiert{" "}
                {new Intl.DateTimeFormat("de-DE", {
                  dateStyle: "medium",
                }).format(new Date(driver.updatedAt))}
              </div>
            </aside>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
