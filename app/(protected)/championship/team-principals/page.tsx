import Link from "next/link";
import { Building2, Settings, Trophy } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import Tabs from "@/components/ui/Tabs";
import {
  GlobalWeekendStatus,
  globalWeekendStatusLabels,
} from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getTeamPrincipalChampionshipData } from "@/lib/championship/team-principal-championship";
import { entityIdSchema } from "@/lib/master-data/schemas";

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function points(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function TeamPrincipalChampionshipPage({
  searchParams,
}: Props) {
  const user = await requirePermission(Permission.ViewChampionship);
  const params = await searchParams;
  const parsedSeasonId = entityIdSchema.safeParse(
    Array.isArray(params.seasonId)
      ? params.seasonId[0]
      : params.seasonId,
  );
  const data = await getTeamPrincipalChampionshipData(
    parsedSeasonId.success ? parsedSeasonId.data : undefined,
  );
  const canManage = hasPermission(
    user.roles,
    Permission.ManageMasterData,
  );
  const seasonSuffix = data.selectedSeason
    ? `?seasonId=${data.selectedSeason.id}`
    : "";

  return (
    <AppLayout>
      <div className="page-stack">
        <PageHeader
          title="Teamchef-WM"
          subtitle="Globale Organisationswertung aus den finalisierten Liga-Ergebnissen eines gemeinsamen Rennwochenendes."
          eyebrow="Cross-league championship"
          icon={Building2}
        >
          {canManage ? (
            <Link href="/admin/teams" className="wizard-primary-button">
              <Settings size={18} />
              Organisationen verwalten
            </Link>
          ) : null}
        </PageHeader>

        <Tabs
          items={[
            {
              label: "Fahrerwertung",
              href: `/championship${seasonSuffix}`,
              active: false,
            },
            {
              label: "Teamwertung",
              href: `/championship${seasonSuffix}${
                seasonSuffix ? "&" : "?"
              }table=teams`,
              active: false,
            },
            {
              label: "Teamchef-WM",
              href: `/championship/team-principals${seasonSuffix}`,
              active: true,
              count: data.standings.length,
            },
          ]}
          label="Meisterschaftstabelle"
        />

        <form
          action="/championship/team-principals"
          className="grid gap-3 rounded-2xl border border-slate-800 bg-[#101720] p-4 sm:grid-cols-[minmax(0,1fr)_auto]"
        >
          <label className="master-label">
            Saison
            <select
              name="seasonId"
              defaultValue={data.selectedSeason?.id ?? ""}
              className="form-control mt-2"
            >
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.archivedAt ? " · Archiv" : ""}
                </option>
              ))}
            </select>
          </label>
          <button className="wizard-primary-button self-end">
            Wertung laden
          </button>
        </form>

        {data.standings.length > 0 ? (
          <section className="data-table-shell">
            <div className="hidden grid-cols-[5rem_minmax(15rem,1.4fr)_minmax(11rem,1fr)_7rem_7rem_7rem] gap-4 border-b border-slate-700 bg-[#121923] px-6 py-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid">
              <span>Pos.</span>
              <span>Organisation</span>
              <span>Teamchef</span>
              <span className="text-right">Ligen</span>
              <span className="text-right">Wochenenden</span>
              <span className="text-right">Punkte</span>
            </div>
            {data.standings.map((standing) => (
              <details
                key={standing.organization.id}
                className="border-b border-slate-800/80 last:border-b-0"
              >
                <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[3rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 lg:grid-cols-[5rem_minmax(15rem,1.4fr)_minmax(11rem,1fr)_7rem_7rem_7rem] lg:gap-4 lg:px-6">
                  <strong className="font-mono text-2xl text-white">
                    {String(standing.position).padStart(2, "0")}
                  </strong>
                  <span className="flex min-w-0 items-center gap-3">
                    <span
                      className="h-9 w-1.5 shrink-0 rounded-full"
                      style={{
                        backgroundColor: standing.organization.color,
                      }}
                    />
                    <span className="min-w-0">
                      <strong className="block truncate text-white">
                        {standing.organization.name}
                      </strong>
                      <span className="text-xs text-slate-500">
                        {standing.organization.shortName}
                      </span>
                    </span>
                  </span>
                  <span className="hidden truncate text-slate-300 lg:block">
                    {standing.organization.principal?.displayName ??
                      "Nicht zugewiesen"}
                  </span>
                  <span className="hidden text-right text-slate-300 lg:block">
                    {standing.leagueCount}
                  </span>
                  <span className="hidden text-right text-slate-300 lg:block">
                    {standing.finalizedWeekendCount}
                  </span>
                  <strong className="text-right text-lg text-blue-200">
                    {points(standing.points)}
                  </strong>
                </summary>
                <div className="grid gap-3 bg-slate-950/35 p-4 text-sm sm:grid-cols-3 md:px-6">
                  <Stat label="Rennpunkte" value={points(standing.racePoints)} />
                  <Stat
                    label="Sprintpunkte"
                    value={points(standing.sprintPoints)}
                  />
                  <Stat
                    label="Liga-Teams"
                    value={standing.organization.teams
                      .map((team) => team.league.code)
                      .join(", ")}
                  />
                </div>
              </details>
            ))}
          </section>
        ) : (
          <EmptyState
            icon={<Trophy size={23} />}
            title="Noch keine globale Wertung"
            description="Die Teamchef-WM erscheint, sobald alle aktiven Ligen eines Rennwochenendes veröffentlicht und alle FIA-Fälle abgeschlossen sind."
          />
        )}

        <section>
          <h2 className="text-xl font-bold text-white">
            Finalisierungsstatus der Rennwochenenden
          </h2>
          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {data.weekends.map((weekend) => (
              <article
                key={weekend.id}
                className="rounded-2xl border border-slate-800 bg-[#101720] p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Runde {weekend.round} · {weekend.activeLeagueCount} Ligen
                    </p>
                    <h3 className="mt-1 font-semibold text-white">
                      {weekend.name}
                    </h3>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-bold ${
                      weekend.status === GlobalWeekendStatus.Finalized
                        ? "bg-green-500/15 text-green-200"
                        : weekend.status ===
                            GlobalWeekendStatus.Invalidated
                          ? "bg-orange-500/15 text-orange-200"
                          : "bg-slate-700 text-slate-200"
                    }`}
                  >
                    {globalWeekendStatusLabels[weekend.status]}
                  </span>
                </div>
                {weekend.status !== GlobalWeekendStatus.Finalized ? (
                  <p className="mt-3 text-sm text-slate-400">
                    {weekend.reason}
                  </p>
                ) : null}
              </article>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-xl bg-slate-900/70 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <strong className="text-white">{value || "–"}</strong>
    </p>
  );
}
