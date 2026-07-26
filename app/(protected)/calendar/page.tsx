import Link from "next/link";
import {
  CalendarDays,
  Clock3,
  EyeOff,
  Flag,
  Gauge,
  Sparkles,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import ListFilters from "@/components/master-data/ListFilters";
import {
  RaceStatus,
  raceStatusLabels,
} from "@/domain";
import {
  hasPermission,
  Permission,
} from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import {
  getMasterDataFilterOptions,
  getRaceItems,
  parseMasterDataListQuery,
} from "@/lib/master-data/queries";

type CalendarPageProps = {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

export default async function CalendarPage({
  searchParams,
}: CalendarPageProps) {
  const user = await requirePermission(Permission.ViewMasterData);
  const query = parseMasterDataListQuery(await searchParams);
  const [races, options] = await Promise.all([
    getRaceItems(query),
    getMasterDataFilterOptions(),
  ]);
  const canManage = hasPermission(
    user.roles,
    Permission.ManageMasterData,
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h1 className="text-3xl font-bold text-white">Rennkalender</h1>
            <p className="mt-2 text-slate-400">
              Alle Rennen mit lokaler Startzeit und Zeitzone.
            </p>
          </div>
          {canManage ? (
            <Link href="/admin/races" className="wizard-primary-button">
              Kalender verwalten
            </Link>
          ) : null}
        </div>

        <ListFilters
          action="/calendar"
          query={query}
          leagues={options.leagues}
          seasons={options.seasons}
          showStatus
        />

        <div className="grid gap-5 xl:grid-cols-2">
          {races.map((race) => (
            <article key={race.id} className="master-card relative overflow-hidden">
              <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
                    FRL · {race.season.name} · Runde{" "}
                    {race.round}
                  </p>
                  <h2 className="mt-2 text-2xl font-bold text-white">
                    {race.mystery ? <EyeOff className="mr-2 inline" size={20} /> : null}
                    {race.name}
                  </h2>
                  <p className="mt-2 text-slate-400">
                    {race.circuit ?? "Mystery Track"}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${
                    race.status === RaceStatus.Completed
                      ? "bg-green-500/15 text-green-300"
                      : race.status === RaceStatus.Cancelled
                        ? "bg-red-500/15 text-red-300"
                        : "bg-blue-500/15 text-blue-300"
                  }`}
                >
                  {raceStatusLabels[race.status]}
                </span>
              </div>
              <div className="mt-6 grid gap-3 text-sm text-slate-300 sm:grid-cols-2">
                <p className="flex items-center gap-2">
                  <CalendarDays size={17} className="text-blue-400" />
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "full",
                    timeZone: race.timezone,
                  }).format(new Date(race.scheduledAt))}
                </p>
                <p className="flex items-center gap-2">
                  <Clock3 size={17} className="text-blue-400" />
                  {new Intl.DateTimeFormat("de-DE", {
                    timeStyle: "short",
                    timeZone: race.timezone,
                  }).format(new Date(race.scheduledAt))}{" "}
                  · {race.timezone}
                </p>
                {race.countryCode ? (
                  <p className="flex items-center gap-2">
                    <Flag size={17} className="text-blue-400" />
                    {race.countryCode}
                  </p>
                ) : null}
                <p className="flex items-center gap-2">
                  <Gauge size={17} className="text-blue-400" />
                  {race.sprint ? "Sprint-Wochenende" : "Standard-Wochenende"}
                </p>
              </div>
              {race.doublePoints || race.mystery ? (
                <div className="mt-5 flex flex-wrap gap-2">
                  {race.doublePoints ? (
                    <span className="rounded-full bg-purple-500/15 px-3 py-1 text-xs text-purple-200">
                      <Sparkles className="mr-1 inline" size={13} />
                      Doppelte Punkte
                    </span>
                  ) : null}
                  {race.mystery ? (
                    <span className="rounded-full bg-amber-500/15 px-3 py-1 text-xs text-amber-200">
                      Mystery Track
                    </span>
                  ) : null}
                </div>
              ) : null}
              <Link
                href={`/results/${race.id}${
                  query.leagueId
                    ? `?leagueId=${query.leagueId}`
                    : ""
                }`}
                className="wizard-secondary-button mt-5 w-full sm:w-auto"
              >
                Ergebnisse ansehen
              </Link>
            </article>
          ))}
        </div>

        {races.length === 0 ? (
          <div className="master-card text-center">
            <CalendarDays className="mx-auto text-slate-500" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Keine Rennen gefunden
            </h2>
            <p className="mt-2 text-slate-400">
              Passe die Filter an oder lege ein Rennen an.
            </p>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
