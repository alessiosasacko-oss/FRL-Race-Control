import Link from "next/link";
import { Search, Settings, Trophy } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import Tabs from "@/components/ui/Tabs";
import CountryFlag from "@/components/ui/CountryFlag";
import DriverCharacter from "@/components/characters/DriverCharacter";
import TeamLogo from "@/components/teams/TeamLogo";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getChampionshipPageData,
  parseSportsListQuery,
} from "@/lib/championship/queries";

type ChampionshipPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

function points(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}

export default async function ChampionshipPage({
  searchParams,
}: ChampionshipPageProps) {
  const user = await requirePermission(Permission.ViewChampionship);
  const query = parseSportsListQuery(await searchParams);
  const data = await getChampionshipPageData(query);
  const canManage = hasPermission(user.roles, Permission.ManageScoring);
  const contextParams = new URLSearchParams();
  if (query.leagueId) contextParams.set("leagueId", String(query.leagueId));
  if (data.selectedSeason) {
    contextParams.set("seasonId", String(data.selectedSeason.id));
  }
  if (query.q) contextParams.set("q", query.q);
  const driverHref = `/championship?${new URLSearchParams([
    ...contextParams.entries(),
    ["table", "drivers"],
  ]).toString()}`;
  const teamHref = `/championship?${new URLSearchParams([
    ...contextParams.entries(),
    ["table", "teams"],
  ]).toString()}`;
  const teamPrincipalHref = data.selectedSeason
    ? `/championship/team-principals?seasonId=${data.selectedSeason.id}`
    : "/championship/team-principals";

  return (
    <AppLayout>
      <div className="page-stack page-accent-championship">
        <PageHeader
          title="Meisterschaft"
          subtitle="Motorsport-Standings mit klarer Spitze, Punkten und Leistungsdetails."
          eyebrow="Championship standings"
          icon={Trophy}
        >
          {canManage ? (
            <Link href="/admin/championship" className="wizard-primary-button">
              <Settings size={18} />
              Wertung verwalten
            </Link>
          ) : null}
        </PageHeader>

        <section className="flex flex-col gap-5 border-b border-slate-800 pb-6 sm:flex-row sm:items-end sm:justify-between">
          <Tabs
            items={[
              {
                label: "Fahrerwertung",
                href: driverHref,
                active: query.table === "drivers",
                count: data.drivers.length,
              },
              {
                label: "Teamwertung",
                href: teamHref,
                active: query.table === "teams",
                count: data.teams.length,
              },
              {
                label: "Teamchef-WM",
                href: teamPrincipalHref,
                active: false,
              },
            ]}
            label="Meisterschaftstabelle"
          />
          {data.selectedSeason ? (
            <div className="text-left sm:text-right">
              <p className="font-semibold text-white">
                {data.selectedSeason.league.code} · {data.selectedSeason.name}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                {data.updatedAt
                  ? `Stand ${new Intl.DateTimeFormat("de-DE", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    }).format(new Date(data.updatedAt))}`
                  : "Noch nicht berechnet"}
              </p>
            </div>
          ) : null}
        </section>

        <details className="rounded-2xl border border-slate-800 bg-[#101720]">
          <summary className="flex min-h-12 cursor-pointer items-center px-4 py-3 text-sm font-semibold text-slate-300">
            Liga, Saison & Suche
          </summary>
          <form
            action="/championship"
            className="grid gap-3 border-t border-slate-800 p-4 md:grid-cols-2 xl:grid-cols-4"
          >
            <input type="hidden" name="table" value={query.table} />
            <label className="master-label">
              Liga
              <select
                name="leagueId"
                defaultValue={
                  query.leagueId ?? data.selectedSeason?.league.id ?? ""
                }
                className="form-control mt-2"
              >
                <option value="">Alle Ligen</option>
                {data.leagues.map((league) => (
                  <option key={league.id} value={league.id}>
                    {league.code} · {league.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="master-label">
              Saison
              <select
                name="seasonId"
                defaultValue={data.selectedSeason?.id ?? ""}
                className="form-control mt-2"
              >
                {data.seasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {data.leagues.find(
                      (league) => league.id === season.leagueId,
                    )?.code ?? "–"}{" "}
                    · {season.name}
                    {season.archived ? " · Archiv" : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="master-label">
              Suche
              <span className="relative mt-2 block">
                <Search
                  size={17}
                  className="absolute left-3 top-3.5 text-slate-500"
                />
                <input
                  name="q"
                  defaultValue={query.q}
                  className="form-control pl-10"
                  placeholder="Fahrer oder Team"
                />
              </span>
            </label>
            <button className="wizard-primary-button self-end">
              Tabelle laden
            </button>
          </form>
        </details>

        {query.table === "drivers" && data.drivers.length > 0 ? (
          <section>
            <SectionHeader
              title="Fahrerwertung"
              description="Die Top 3 stehen im Rampenlicht; das gesamte Feld folgt darunter."
            />
            <div className="mb-5 grid gap-3 lg:grid-cols-3">
              {data.drivers.slice(0, 3).map((standing, index) => (
                <Link
                  key={standing.driver.id}
                  href={`/drivers/${standing.driver.id}`}
                  className={`relative overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-0.5 ${
                    index === 0
                      ? "border-amber-400/40 bg-amber-400/10 lg:-translate-y-2"
                      : index === 1
                        ? "border-slate-400/30 bg-slate-400/5"
                        : "border-orange-500/30 bg-orange-500/5"
                  }`}
                >
                  <span className="absolute right-3 top-[-0.25rem] font-mono text-7xl font-black text-white/[0.04]">
                    {standing.position}
                  </span>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-slate-500">
                    Position {standing.position}
                  </p>
                  <div className="mt-2 flex h-28 items-end justify-center overflow-hidden">
                    <DriverCharacter configuration={standing.driver.character.configuration} teamSuit={standing.driver.teamSuit.configuration} pose={standing.driver.character.normalPose} variant="portrait" driverNumber={standing.driver.number} driverInitials={standing.driver.name} alt={`Fahrercharakter von ${standing.driver.name}`} className="h-32 w-auto" showShadow={false} />
                  </div>
                  <p className="mt-3 flex items-center gap-2 text-lg font-bold text-white"><CountryFlag countryCode={null} fallbackFlag={standing.driver.flag} size="sm" />{standing.driver.name}</p>
                  <p className="mt-1 inline-flex items-center gap-2 text-sm text-slate-400">{standing.driver.team ? <TeamLogo logoUrl={standing.driver.team.logoUrl} teamName={standing.driver.team.name} shortName={standing.driver.team.shortName} primaryColor={standing.driver.team.color} size="xs" /> : null}{standing.driver.team?.name ?? "Ohne Team"}</p>
                  <p className="mt-5 text-3xl font-black text-white">
                    {points(standing.points)}
                    <span className="ml-1 text-sm font-semibold text-slate-500">
                      Pkt.
                    </span>
                  </p>
                </Link>
              ))}
            </div>
            <DriverStandings standings={data.drivers} />
          </section>
        ) : null}

        {query.table === "teams" && data.teams.length > 0 ? (
          <section>
            <SectionHeader
              title="Teamwertung"
              description="Konstrukteurswertung mit klaren Abständen zur Spitze."
            />
            <TeamStandings standings={data.teams} />
          </section>
        ) : null}

        {(query.table === "drivers"
          ? data.drivers.length
          : data.teams.length) === 0 ? (
          <EmptyState
            icon={<Trophy size={23} />}
            title="Noch keine Wertung vorhanden"
            description="Nach dem ersten gespeicherten Ergebnis wird die Tabelle automatisch berechnet."
          />
        ) : null}
      </div>
    </AppLayout>
  );
}

function DriverStandings({
  standings,
}: {
  standings: Awaited<
    ReturnType<typeof getChampionshipPageData>
  >["drivers"];
}) {
  const leaderPoints = standings[0]?.points ?? 0;

  return (
    <div className="data-table-shell">
      <div className="hidden grid-cols-[5rem_minmax(13rem,1.4fr)_minmax(9rem,1fr)_7rem_7rem_6rem] gap-4 border-b border-slate-700 bg-[#121923] px-6 py-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid">
        <span>Pos.</span>
        <span>Fahrer</span>
        <span>Team</span>
        <span className="text-right">Abstand</span>
        <span className="text-right">Punkte</span>
        <span className="text-right">Siege</span>
      </div>
      {standings.map((standing) => (
        <details
          key={standing.driver.id}
          className={`group border-b border-slate-800/80 last:border-b-0 ${
            standing.position <= 3 ? "bg-blue-500/[0.025]" : ""
          }`}
        >
          <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-blue-500/5 lg:grid-cols-[5rem_minmax(13rem,1.4fr)_minmax(9rem,1fr)_7rem_7rem_6rem] lg:gap-4 lg:px-6">
            <strong className="font-mono text-2xl text-white">
              {String(standing.position).padStart(2, "0")}
            </strong>
            <Link
              href={`/drivers/${standing.driver.id}`}
              className="min-w-0 font-semibold text-white hover:text-blue-300"
            >
              <DriverCharacter configuration={standing.driver.character.configuration} teamSuit={standing.driver.teamSuit.configuration} pose={standing.driver.character.normalPose} variant="tableThumbnail" driverNumber={standing.driver.number} alt={`Fahrercharakter von ${standing.driver.name}`} className="mr-2 inline-block size-10 align-middle" showShadow={false} />
              <CountryFlag countryCode={null} fallbackFlag={standing.driver.flag} size="sm" className="mr-2" />
              <span className="truncate">
                #{standing.driver.number} {standing.driver.name}
              </span>
            </Link>
            <span className="hidden min-w-0 items-center gap-2 truncate lg:flex">{standing.driver.team ? <TeamLogo logoUrl={standing.driver.team.logoUrl} teamName={standing.driver.team.name} shortName={standing.driver.team.shortName} primaryColor={standing.driver.team.color} size="xs" /> : null}<span className="truncate text-slate-400 lg:block">{standing.driver.team?.name ?? "Ohne Team"}</span></span>
            <span className="hidden text-right font-mono text-sm text-slate-500 lg:block">
              {standing.position === 1
                ? "Leader"
                : `-${points(leaderPoints - standing.points)}`}
            </span>
            <strong className="text-right text-lg text-blue-200">
              {points(standing.points)}
            </strong>
            <span className="hidden text-right text-slate-300 lg:block">
              {standing.wins}
            </span>
          </summary>
          <div className="grid gap-3 bg-slate-950/35 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
            <Stat label="Rennpunkte" value={standing.racePoints} />
            <Stat label="Sprintpunkte" value={standing.sprintPoints} />
            <Stat label="Bonus" value={standing.bonusPoints} />
            <Stat label="Anpassungen" value={standing.adjustments} />
            <Stat label="Starts" value={standing.starts} />
            <Stat label="Podien" value={standing.podiums} />
            <Stat label="DNF / DSQ" value={`${standing.dnfs} / ${standing.dsqs}`} />
            <Stat label="Tie-Break" value={standing.tieBreakSummary} />
          </div>
        </details>
      ))}
    </div>
  );
}

function TeamStandings({
  standings,
}: {
  standings: Awaited<
    ReturnType<typeof getChampionshipPageData>
  >["teams"];
}) {
  const leaderPoints = standings[0]?.points ?? 0;

  return (
    <div className="data-table-shell">
      <div className="hidden grid-cols-[5rem_minmax(14rem,1fr)_7rem_7rem_6rem] gap-4 border-b border-slate-700 bg-[#121923] px-6 py-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-slate-500 lg:grid">
        <span>Pos.</span>
        <span>Team</span>
        <span className="text-right">Abstand</span>
        <span className="text-right">Punkte</span>
        <span className="text-right">Siege</span>
      </div>
      {standings.map((standing) => (
        <details
          key={standing.team.id}
          className="group border-b border-slate-800/80 last:border-b-0"
        >
          <summary className="grid min-h-16 cursor-pointer list-none grid-cols-[3.25rem_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 transition hover:bg-blue-500/5 lg:grid-cols-[5rem_minmax(14rem,1fr)_7rem_7rem_6rem] lg:gap-4 lg:px-6">
            <strong className="font-mono text-2xl text-white">
              {String(standing.position).padStart(2, "0")}
            </strong>
            <Link
              href={`/teams/${standing.team.id}`}
              className="flex min-w-0 items-center gap-3 font-semibold text-white hover:text-blue-300"
            >
              <TeamLogo logoUrl={standing.team.logoUrl} teamName={standing.team.name} shortName={standing.team.shortName} primaryColor={standing.team.color} size="sm" />
              <span className="truncate">{standing.team.name}</span>
            </Link>
            <span className="hidden text-right font-mono text-sm text-slate-500 lg:block">
              {standing.position === 1
                ? "Leader"
                : `-${points(leaderPoints - standing.points)}`}
            </span>
            <strong className="text-right text-lg text-blue-200">
              {points(standing.points)}
            </strong>
            <span className="hidden text-right text-slate-300 lg:block">
              {standing.wins}
            </span>
          </summary>
          <div className="grid gap-3 bg-slate-950/35 px-4 py-4 text-sm sm:grid-cols-2 lg:grid-cols-4 lg:px-6">
            <Stat label="Rennpunkte" value={standing.racePoints} />
            <Stat label="Sprintpunkte" value={standing.sprintPoints} />
            <Stat label="Bonus" value={standing.bonusPoints} />
            <Stat label="Anpassungen" value={standing.adjustments} />
            <Stat label="Podien" value={standing.podiums} />
            <Stat label="Tie-Break" value={standing.tieBreakSummary} />
          </div>
        </details>
      ))}
    </div>
  );
}

function Stat({
  label,
  value,
}: {
  label: string;
  value: number | string;
}) {
  return (
    <p className="flex items-center justify-between gap-3 rounded-lg bg-slate-900/70 px-3 py-2">
      <span className="text-slate-500">{label}</span>
      <strong className="text-white">
        {typeof value === "number" ? points(value) : value}
      </strong>
    </p>
  );
}
