import Link from "next/link";
import { ArrowRight, CalendarDays, EyeOff, Flag, Trophy } from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import CountryFlag from "@/components/ui/CountryFlag";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import { resultSessionLabels, type ResultSession } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getPrismaClient } from "@/lib/db/prisma";
import { publicRaceTrack } from "@/lib/races/visibility";

export default async function ResultsPage() {
  await requirePermission(Permission.ViewChampionship);
  const sessions = await getPrismaClient().raceResultSession.findMany({
    where: { publicationStatus: "PUBLISHED" },
    orderBy: [{ publishedAt: "desc" }, { updatedAt: "desc" }],
    take: 60,
    select: {
      id: true, session: true, leagueId: true, publishedAt: true,
      league: { select: { code: true, name: true } },
      race: { select: {
        id: true, name: true, circuit: true, countryCode: true, round: true,
        scheduledAt: true, timezone: true, mystery: true,
        season: { select: { name: true } },
      } },
      results: { orderBy: [{ finalPosition: { sort: "asc", nulls: "last" } }, { position: "asc" }], take: 1, select: { driver: { select: { name: true, flag: true } } } },
    },
  });
  const groups = new Map<string, typeof sessions>();
  for (const session of sessions) {
    const key = `${session.race.id}:${session.leagueId}`;
    groups.set(key, [...(groups.get(key) ?? []), session]);
  }
  const weekends = [...groups.values()].slice(0, 24);

  return (
    <AppLayout>
      <div className="page-stack page-accent-results">
        <PageHeader title="Ergebnisse" subtitle="Veröffentlichte Klassifikationen aus allen Rennwochenenden." eyebrow="Official classification" icon={Trophy} />
        {weekends.length ? (
          <section className="data-table-shell min-w-0" aria-label="Veröffentlichte Rennwochenenden">
            {weekends.map((weekend, index) => {
              const first = weekend[0]; const track = publicRaceTrack(first.race); const raceSession = weekend.find((item) => item.session === "RACE"); const winner = raceSession?.results[0]?.driver;
              return (
                <article key={`${first.race.id}:${first.leagueId}`} className="group relative grid min-w-0 gap-4 border-b border-slate-800/80 px-4 py-5 last:border-b-0 hover:bg-blue-500/[0.05] sm:px-6 lg:grid-cols-[4rem_7rem_minmax(13rem,1.4fr)_minmax(11rem,1fr)_minmax(10rem,auto)_3rem] lg:items-center">
                  <span className="absolute bottom-0 left-0 top-0 w-0.5 bg-blue-400 opacity-0 transition group-hover:opacity-100" />
                  <span className="font-mono text-xs font-bold text-slate-600">{String(index + 1).padStart(2, "0")}</span>
                  <span className="font-mono text-2xl font-black text-white">R{String(first.race.round).padStart(2, "0")}</span>
                  <span className="min-w-0"><span className="eyebrow">FRL {first.league.code} · {first.race.season.name}</span><span className="mt-1 flex items-center gap-2"><span className="truncate text-lg font-black text-white">{track.name}</span>{track.revealed && track.countryCode ? <CountryFlag countryCode={track.countryCode} size="sm" /> : <EyeOff className="shrink-0 text-amber-300" size={16} />}</span><span className="mt-1 block truncate text-sm text-slate-500">{track.circuit ?? "Mystery Track"}</span></span>
                  <span className="min-w-0 text-sm text-slate-400">{winner ? <span className="flex items-center gap-2"><Flag size={16} className="text-amber-300" /><span className="truncate">Sieger · <strong className="text-slate-200">{winner.name}</strong></span></span> : "Noch kein Rennsieger"}</span>
                  <span><span className="flex flex-wrap gap-1.5">{weekend.map((item) => <span key={item.id} className="border border-slate-700 bg-slate-900/70 px-2 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-300">{resultSessionLabels[item.session as ResultSession]}</span>)}</span><span className="mt-2 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} />{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: first.race.timezone }).format(first.race.scheduledAt)}</span></span>
                  <Link href={`/results/${first.race.id}?leagueId=${first.leagueId}`} aria-label={`Klassifikation ${track.name} öffnen`} className="absolute inset-0 lg:static lg:flex lg:size-11 lg:items-center lg:justify-center lg:border lg:border-slate-700 lg:text-slate-500 lg:transition lg:hover:border-blue-400 lg:hover:text-blue-300"><span className="sr-only">Klassifikation öffnen</span><ArrowRight className="hidden lg:block" size={17} /></Link>
                </article>
              );
            })}
          </section>
        ) : <EmptyState icon={<Trophy size={22} />} title="Noch keine Ergebnisse" description="Sobald eine Klassifikation veröffentlicht wurde, erscheint sie hier." />}
      </div>
    </AppLayout>
  );
}
