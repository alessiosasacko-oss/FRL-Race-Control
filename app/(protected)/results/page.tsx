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
      race: { include: { season: { select: { name: true } } } },
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
          <section className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-3" aria-label="Veröffentlichte Rennwochenenden">
            {weekends.map((weekend) => {
              const first = weekend[0]; const track = publicRaceTrack(first.race); const raceSession = weekend.find((item) => item.session === "RACE"); const winner = raceSession?.results[0]?.driver;
              return (
                <article key={`${first.race.id}:${first.leagueId}`} className="surface-panel group relative min-w-0 overflow-hidden p-5 transition hover:-translate-y-1 hover:border-blue-400/40 sm:p-6">
                  <div aria-hidden="true" className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-cyan-300/70 to-transparent" />
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="eyebrow">{first.league.code} · Runde {first.race.round}</span>
                    <span className="rounded-full border border-slate-700 px-2.5 py-1 text-[0.65rem] font-bold uppercase tracking-wider text-slate-400">{first.race.season.name}</span>
                  </div>
                  <h2 className="mt-5 break-words text-2xl font-black tracking-tight text-white">{track.name}</h2>
                  <p className="mt-2 flex items-center gap-2 text-sm text-slate-400">{track.revealed && track.countryCode ? <CountryFlag countryCode={track.countryCode} size="sm" /> : <EyeOff size={16} />} {track.circuit ?? "Mystery Track"}</p>
                  {winner ? <p className="mt-5 flex items-center gap-2 rounded-xl border border-amber-400/20 bg-amber-400/5 px-3 py-2.5 text-sm text-amber-100"><Flag size={16} /> Sieger: <strong>{winner.name}</strong></p> : null}
                  <div className="mt-5 flex flex-wrap gap-2">{weekend.map((item) => <span key={item.id} className="rounded-lg bg-slate-900/80 px-2.5 py-1 text-xs text-slate-300">{resultSessionLabels[item.session as ResultSession]}</span>)}</div>
                  <p className="mt-5 flex items-center gap-2 text-xs text-slate-500"><CalendarDays size={14} />{new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeZone: first.race.timezone }).format(first.race.scheduledAt)}</p>
                  <Link href={`/results/${first.race.id}?leagueId=${first.leagueId}`} className="mt-5 inline-flex min-h-11 items-center gap-2 font-bold text-cyan-300 transition group-hover:text-cyan-200">Klassifikation öffnen <ArrowRight size={17} /></Link>
                </article>
              );
            })}
          </section>
        ) : <EmptyState icon={<Trophy size={22} />} title="Noch keine Ergebnisse" description="Sobald eine Klassifikation veröffentlicht wurde, erscheint sie hier." />}
      </div>
    </AppLayout>
  );
}
