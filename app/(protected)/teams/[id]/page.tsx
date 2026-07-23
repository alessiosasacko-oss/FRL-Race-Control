import Link from "next/link";
import { ArrowLeft, MessageCircle, Users } from "lucide-react";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getTeamById } from "@/lib/master-data/queries";
import { entityIdSchema } from "@/lib/master-data/schemas";

type TeamDetailPageProps = {
  params: Promise<{ id: string }>;
};

export default async function TeamDetailPage({
  params,
}: TeamDetailPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const parsedId = entityIdSchema.safeParse((await params).id);

  if (!parsedId.success) notFound();

  const team = await getTeamById(parsedId.data);

  if (!team) notFound();

  const canManage = hasPermission(
    user.roles,
    Permission.ManageMasterData,
  );

  return (
    <AppLayout>
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <Link
            href="/teams"
            className="flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
          >
            <ArrowLeft size={16} />
            Zur Teamübersicht
          </Link>
          {canManage ? (
            <Link href="/admin/teams" className="wizard-primary-button">
              Team verwalten
            </Link>
          ) : null}
        </div>

        <section className="master-card overflow-hidden p-0">
          <div className="h-2" style={{ backgroundColor: team.color }} />
          <div className="p-6 lg:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-sm font-semibold uppercase tracking-widest text-blue-400">
                  {team.league.code} · {team.season?.name ?? "Keine Saison"}
                </p>
                <h1 className="mt-2 text-3xl font-bold text-white sm:text-4xl">
                  {team.name}
                </h1>
                <p className="mt-2 font-mono text-slate-400">
                  {team.shortName}
                </p>
              </div>
              <span
                className={`w-fit rounded-full px-3 py-1 text-sm font-semibold ${
                  team.active
                    ? "bg-green-500/15 text-green-300"
                    : "bg-slate-700 text-slate-300"
                }`}
              >
                {team.active ? "Aktiv" : "Inaktiv"}
              </span>
            </div>

            <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="text-blue-400" size={21} />
                  <h2 className="text-xl font-semibold text-white">
                    Fahreraufstellung
                  </h2>
                </div>
                <div className="mt-4 space-y-3">
                  {team.drivers.map((driver) => (
                    <Link
                      key={driver.id}
                      href={`/drivers/${driver.id}`}
                      className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/60 p-4 transition hover:border-blue-500"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{driver.flag}</span>
                        <div>
                          <p className="font-semibold text-white">
                            {driver.name}
                          </p>
                          <p className="text-xs text-slate-500">
                            {driver.active ? "Aktiver Fahrer" : "Inaktiv"}
                          </p>
                        </div>
                      </div>
                      <span className="rounded-lg bg-slate-800 px-3 py-2 font-bold text-white">
                        #{driver.number}
                      </span>
                    </Link>
                  ))}
                  {team.drivers.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-slate-700 p-8 text-center text-slate-400">
                      Noch keine Fahrer zugeordnet.
                    </div>
                  ) : null}
                </div>
              </div>

              <aside className="space-y-4">
                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-5">
                  <MessageCircle className="text-blue-400" size={22} />
                  <h2 className="mt-3 font-semibold text-white">
                    Team Principal
                  </h2>
                  <p className="mt-2 text-sm text-slate-400">
                    {team.principal?.displayName ?? "Nicht zugewiesen"}
                  </p>
                  {team.principal?.discordId ? (
                    <p className="mt-1 font-mono text-xs text-slate-500">
                      {team.principal.discordId}
                    </p>
                  ) : null}
                </div>
                <dl className="rounded-xl border border-slate-800 bg-slate-950/60 p-5 text-sm">
                  <div className="flex justify-between gap-4">
                    <dt className="text-slate-500">Teamfarbe</dt>
                    <dd className="flex items-center gap-2 font-mono text-white">
                      <span
                        className="h-3 w-3 rounded-full"
                        style={{ backgroundColor: team.color }}
                      />
                      {team.color}
                    </dd>
                  </div>
                  <div className="mt-3 flex justify-between gap-4">
                    <dt className="text-slate-500">Wertungseinträge</dt>
                    <dd className="text-white">{team.standingCount}</dd>
                  </div>
                </dl>
              </aside>
            </div>
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
