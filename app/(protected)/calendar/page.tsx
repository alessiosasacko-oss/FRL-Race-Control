import Link from "next/link";
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock3,
  EyeOff,
  Flag,
  Gauge,
  Settings,
  Sparkles,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ListFilters from "@/components/master-data/ListFilters";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import { RaceStatus, raceStatusLabels } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataFilterOptions,
  getRaceItems,
  parseMasterDataListQuery,
} from "@/lib/master-data/queries";
import type { RaceItem } from "@/lib/master-data/types";

type CalendarPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

const statusStyles: Record<RaceStatus, string> = {
  [RaceStatus.Scheduled]:
    "border-blue-500/30 bg-blue-500/10 text-blue-200",
  [RaceStatus.InProgress]:
    "border-cyan-500/30 bg-cyan-500/10 text-cyan-200",
  [RaceStatus.Completed]:
    "border-emerald-500/25 bg-emerald-500/10 text-emerald-200",
  [RaceStatus.Cancelled]:
    "border-red-500/25 bg-red-500/10 text-red-200",
};

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const query = parseMasterDataListQuery(await searchParams);
  const [racesResult, optionsResult] = await Promise.allSettled([
    getRaceItems(query),
    getMasterDataFilterOptions(),
  ]);
  if (racesResult.status === "rejected") {
    console.error("[calendar] Unable to load race list.", racesResult.reason);
  }
  if (optionsResult.status === "rejected") {
    console.error(
      "[calendar] Unable to load filter options.",
      optionsResult.reason,
    );
  }
  const races =
    racesResult.status === "fulfilled" ? racesResult.value : [];
  const options =
    optionsResult.status === "fulfilled"
      ? optionsResult.value
      : { leagues: [], seasons: [] };
  const canManage = hasPermission(user.roles, Permission.ManageMasterData);
  const nextRace = races.find(
    (race) =>
      race.status === RaceStatus.InProgress ||
      race.status === RaceStatus.Scheduled,
  );
  const remainingRaces = nextRace
    ? races.filter((race) => race.id !== nextRace.id)
    : races;

  return (
    <AppLayout>
      <div className="page-stack page-accent-calendar">
        <PageHeader
          title="Rennkalender"
          subtitle="Die gemeinsame FRL-Saison als klare Abfolge von Rennwochenenden."
          eyebrow="Season schedule"
          icon={CalendarDays}
        >
          {canManage ? (
            <Link href="/admin/races" className="wizard-primary-button">
              <Settings size={17} />
              Kalender verwalten
            </Link>
          ) : null}
        </PageHeader>

        {nextRace ? <NextRaceHero race={nextRace} leagueId={query.leagueId} /> : null}

        <section>
          <SectionHeader
            title="Saisonübersicht"
            description="Vergangene Rennen treten zurück, kommende Termine bleiben im Fokus."
          />
          <details className="mb-5 rounded-2xl border border-slate-800 bg-[#101720]">
            <summary className="flex min-h-12 cursor-pointer items-center gap-2 px-4 py-3 text-sm font-semibold text-slate-300">
              Filter & Suche
            </summary>
            <div className="border-t border-slate-800 p-4">
              <ListFilters
                action="/calendar"
                query={query}
                leagues={options.leagues}
                seasons={options.seasons}
                showStatus
              />
            </div>
          </details>

          <div className="relative space-y-3 before:absolute before:bottom-8 before:left-[1.22rem] before:top-8 before:w-px before:bg-slate-800 sm:before:left-[2.22rem]">
            {remainingRaces.map((race) => (
              <RaceTimelineItem
                key={race.id}
                race={race}
                leagueId={query.leagueId}
              />
            ))}
          </div>
        </section>

        {races.length === 0 ? (
          <EmptyState
            icon={<CalendarDays size={23} />}
            title="Keine Rennen gefunden"
            description="Passe die Filter an oder lege in der Administration ein Rennen an."
          />
        ) : null}
      </div>
    </AppLayout>
  );
}

function NextRaceHero({
  race,
  leagueId,
}: {
  race: RaceItem;
  leagueId?: number;
}) {
  return (
    <section className="race-hero relative isolate overflow-hidden rounded-[1.75rem] border p-6 sm:p-8 lg:p-10">
      <div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_82%_15%,rgba(37,99,235,0.35),transparent_32%),linear-gradient(120deg,transparent_0_70%,rgba(34,211,238,0.06)_70%_71%,transparent_71%_100%)]"
      />
      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-end">
        <div>
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full border border-blue-400/30 bg-blue-500/15 px-3 py-1 text-xs font-bold uppercase tracking-[0.12em] text-blue-200">
              Als Nächstes · Runde {race.round}
            </span>
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold ${statusStyles[race.status]}`}
            >
              {raceStatusLabels[race.status]}
            </span>
          </div>
          <h2 className="mt-5 text-4xl font-black tracking-[-0.04em] text-white sm:text-5xl">
            {race.mystery ? <EyeOff className="mr-3 inline" size={30} /> : null}
            {race.name}
          </h2>
          <p className="mt-3 text-lg text-slate-300">
            {race.circuit ?? "Mystery Track"}
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href={`/calendar/${race.id}`} className="wizard-primary-button">
              <Gauge size={18} />
              Race Weekend öffnen
            </Link>
            <Link href="/attendance" className="wizard-primary-button">
              <CheckCircle2 size={18} />
              Zur Rennanmeldung
            </Link>
            <Link
              href={resultHref(race.id, leagueId)}
              className="wizard-secondary-button"
            >
              Ergebnisse ansehen
              <ArrowRight size={17} />
            </Link>
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-5 backdrop-blur-sm">
          <p className="eyebrow text-cyan-300">Race time</p>
          <p className="mt-3 flex items-center gap-2 font-semibold text-white">
            <CalendarDays size={18} className="text-blue-300" />
            {formatDate(race)}
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <Clock3 size={18} className="text-cyan-300" />
            {formatTime(race)} · {race.timezone}
          </p>
          <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
            <Gauge size={18} className="text-violet-300" />
            {race.sprint ? "Sprint-Wochenende" : "Standard-Wochenende"}
          </p>
        </div>
      </div>
    </section>
  );
}

function RaceTimelineItem({
  race,
  leagueId,
}: {
  race: RaceItem;
  leagueId?: number;
}) {
  const past =
    race.status === RaceStatus.Completed ||
    race.status === RaceStatus.Cancelled;

  return (
    <article
      className={`relative ml-10 grid gap-4 rounded-2xl px-4 py-5 transition sm:ml-16 sm:grid-cols-[5rem_minmax(0,1fr)_auto] sm:items-center sm:px-6 ${
        past
          ? "border border-slate-800/60 bg-slate-950/20 opacity-70 hover:opacity-100"
          : "border border-slate-800 bg-[#101720] hover:border-blue-500/40"
      }`}
    >
      <span
        className={`absolute -left-[2.05rem] top-7 flex size-5 items-center justify-center rounded-full border-4 border-[#070a0f] sm:-left-[2.8rem] ${
          past ? "bg-slate-600" : "bg-blue-400"
        }`}
      />
      <div>
        <p className="text-[0.65rem] font-bold uppercase tracking-[0.15em] text-slate-500">
          Runde
        </p>
        <p className="mt-1 font-mono text-3xl font-black text-white">
          {String(race.round).padStart(2, "0")}
        </p>
      </div>
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate text-lg font-bold text-white">
            {race.mystery ? <EyeOff className="mr-2 inline" size={17} /> : null}
            {race.name}
          </h3>
          <span
            className={`rounded-full border px-2.5 py-1 text-[0.68rem] font-semibold ${statusStyles[race.status]}`}
          >
            {raceStatusLabels[race.status]}
          </span>
        </div>
        <p className="mt-1 text-sm text-slate-400">
          {race.circuit ?? "Mystery Track"} · {formatDate(race)} · {formatTime(race)}
        </p>
        <div className="mt-2 flex flex-wrap gap-2">
          {race.sprint ? (
            <span className="text-xs text-violet-300">Sprint</span>
          ) : null}
          {race.doublePoints ? (
            <span className="text-xs text-violet-300">
              <Sparkles className="mr-1 inline" size={12} />
              Doppelte Punkte
            </span>
          ) : null}
          {race.ticketCount > 0 ? (
            <span className="text-xs text-amber-300">
              {race.ticketCount} FIA-Ticket(s)
            </span>
          ) : null}
        </div>
      </div>
      <Link
        href={resultHref(race.id, leagueId)}
        aria-label={`Ergebnisse für ${race.name} ansehen`}
        className="flex min-h-11 items-center justify-center gap-2 rounded-xl border border-slate-700 px-3 text-sm font-semibold text-slate-300 transition hover:border-blue-500 hover:text-white"
      >
        <Flag size={16} />
        <span className="sm:hidden xl:inline">Ergebnisse</span>
        <ArrowRight size={15} />
      </Link>
    </article>
  );
}

function resultHref(raceId: number, leagueId?: number): string {
  return `/results/${raceId}${leagueId ? `?leagueId=${leagueId}` : ""}`;
}

function formatDate(race: RaceItem): string {
  return new Intl.DateTimeFormat("de-DE", {
    dateStyle: "full",
    timeZone: race.timezone,
  }).format(new Date(race.scheduledAt));
}

function formatTime(race: RaceItem): string {
  return new Intl.DateTimeFormat("de-DE", {
    timeStyle: "short",
    timeZone: race.timezone,
  }).format(new Date(race.scheduledAt));
}
