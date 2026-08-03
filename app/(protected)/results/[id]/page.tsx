import Link from "next/link";
import Image from "next/image";
import { Download, EyeOff, Flag, Medal, Timer, Trophy } from "lucide-react";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import EmptyState from "@/components/ui/EmptyState";
import PageHeader from "@/components/ui/PageHeader";
import SectionHeader from "@/components/ui/SectionHeader";
import CountryFlag from "@/components/ui/CountryFlag";
import DriverCharacter from "@/components/characters/DriverCharacter";
import TeamLogo from "@/components/teams/TeamLogo";
import { ResultGraphicType, resultGraphicTypeLabels, resultSessionLabels, resultStatusLabels } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getRaceResults } from "@/lib/championship/queries";
import { getPrismaClient } from "@/lib/db/prisma";
import { entityIdSchema } from "@/lib/master-data/schemas";

type ResultPageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};

type ResultData = NonNullable<Awaited<ReturnType<typeof getRaceResults>>>;
type SessionResult = ResultData["sessions"][number]["results"][number];

function duration(value: number | null): string {
  if (value === null) return "–";
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(3)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
}

export default async function ResultPage({
  params,
  searchParams,
}: ResultPageProps) {
  await requirePermission(Permission.ViewChampionship);
  const parsedId = entityIdSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();

  const rawLeagueId = (await searchParams).leagueId;
  const parsedLeagueId = entityIdSchema.safeParse(
    Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId,
  );
  const data = await getRaceResults(
    parsedId.data,
    parsedLeagueId.success ? parsedLeagueId.data : undefined,
  );
  if (!data) notFound();
  const graphicRows = await getPrismaClient().resultGraphic.findMany({
    where: {
      raceId: data.race.id,
      leagueId: data.race.season.league.id,
      renderStatus: "COMPLETED",
      publicUrl: { not: null },
    },
    orderBy: [{ version: "desc" }, { generatedAt: "desc" }],
    select: { id: true, type: true, publicUrl: true, version: true },
  });
  const graphics = [...new Map(graphicRows.map((graphic) => [graphic.type, graphic])).values()];

  return (
    <AppLayout>
      <div className="page-stack page-accent-results">
        <PageHeader
          title={data.race.name}
          subtitle={`${data.race.season.league.code} · ${data.race.season.name} · Runde ${data.race.round}`}
          eyebrow="Official classification"
          backHref="/calendar"
          backLabel="Zurück zum Kalender"
          icon={Flag}
        />

        <section className="race-hero relative isolate overflow-hidden rounded-[1.5rem] border p-6 sm:p-8">
          <div
            aria-hidden="true"
            className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_85%_0%,rgba(37,99,235,0.28),transparent_32%)]"
          />
          <p className="flex items-center gap-2 text-lg font-semibold text-white">
            {data.race.revealMystery && data.race.countryCode !== "–" ? <CountryFlag countryCode={data.race.countryCode} size="sm" /> : null}
            <span>{data.race.revealMystery ? data.race.circuit : "Mystery Track"}</span>
          </p>
          {!data.race.revealMystery ? (
            <p className="mt-4 flex max-w-2xl items-start gap-2 rounded-xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm text-amber-100">
              <EyeOff className="mt-0.5 shrink-0" size={17} />
              Details dieses Mystery Tracks bleiben bis eine Stunde vor
              Rennstart verborgen.
            </p>
          ) : null}
        </section>

        {graphics.length > 0 ? (
          <section>
            <SectionHeader title="Offizielle FRL-Grafiken" eyebrow="Downloads" icon={Trophy} description="Aktuellste veröffentlichte Versionen dieses Rennwochenendes" />
            <div className="grid min-w-0 gap-4 xl:grid-cols-2">
              {graphics.map((graphic) => (
                <article key={graphic.id} className="min-w-0 overflow-hidden rounded-2xl border border-slate-800 bg-slate-950/45">
                  <Image src={graphic.publicUrl!} alt={`${resultGraphicTypeLabels[graphic.type as ResultGraphicType]} für ${data.race.name}`} width={1920} height={1080} className="h-auto w-full object-contain" />
                  <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0"><p className="truncate font-bold text-white">{resultGraphicTypeLabels[graphic.type as ResultGraphicType]}</p><p className="text-xs text-slate-500">Version {graphic.version}</p></div>
                    <a href={graphic.publicUrl!} download className="wizard-secondary-button min-h-11 justify-center"><Download size={17} />PNG herunterladen</a>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ) : null}

        {data.sessions.map((session) => (
          <section key={session.id}>
            <SectionHeader
              title={resultSessionLabels[session.session]}
              eyebrow="Result"
              icon={Flag}
              description={`${session.results.length} klassifizierte Fahrer`}
            />

            {session.results.length >= 3 ? (
              <div className="mb-5 grid gap-3 md:grid-cols-3">
                {session.results.slice(0, 3).map((result, index) => (
                  <PodiumResult key={result.id} result={result} index={index} />
                ))}
              </div>
            ) : null}

            <div className="data-table-shell hidden overflow-x-auto lg:block">
              <table className="data-table min-w-[980px]">
                <thead>
                  <tr>
                    <th>Pos.</th>
                    <th>Fahrer</th>
                    <th>Team</th>
                    <th>Status</th>
                    <th className="text-right">Punkte</th>
                    <th className="text-right">Abstand</th>
                    <th className="text-right">Vorheriger</th>
                    <th className="text-right">Runden</th>
                    <th>Marker</th>
                  </tr>
                </thead>
                <tbody>
                  {session.results.map((result) => (
                    <ResultRow key={result.id} result={result} />
                  ))}
                </tbody>
              </table>
            </div>

            <div className="space-y-3 lg:hidden">
              {session.results.map((result) => (
                <MobileResult key={result.id} result={result} />
              ))}
            </div>

            {session.results.length === 0 ? (
              <EmptyState
                icon={<Flag size={22} />}
                title="Noch keine Ergebnisse"
                description="Für diese Sitzung wurde noch keine Klassifikation veröffentlicht."
              />
            ) : null}

            {session.results.some((result) => result.notes) ? (
              <details className="mt-5 border-t border-slate-800 pt-4">
                <summary className="min-h-11 cursor-pointer text-sm font-semibold text-slate-300">
                  Öffentliche Hinweise
                </summary>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  {session.results
                    .filter((result) => result.notes)
                    .map((result) => (
                      <li key={result.id}>
                        <Timer className="mr-2 inline text-cyan-400" size={14} />
                        {result.driver.name}: {result.notes}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </section>
        ))}

        {data.sessions.length === 0 ? (
          <EmptyState
            icon={<Flag size={22} />}
            title="Noch keine Ergebnisse"
            description="Für dieses Rennen wurde noch keine Sitzung veröffentlicht."
          />
        ) : null}
      </div>
    </AppLayout>
  );
}

function PodiumResult({
  result,
  index,
}: {
  result: SessionResult;
  index: number;
}) {
  const classes = [
    "border-amber-400/40 bg-amber-400/10 md:-translate-y-2",
    "border-slate-400/30 bg-slate-400/5",
    "border-orange-500/30 bg-orange-500/5",
  ][index];

  return (
    <Link
      href={`/drivers/${result.driver.id}`}
      className={`relative overflow-hidden rounded-2xl border p-5 transition hover:-translate-y-1 ${classes}`}
    >
      <span className="absolute right-2 top-[-0.5rem] font-mono text-8xl font-black text-white/[0.04]">
        {index + 1}
      </span>
      {index === 0 ? (
        <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.18em] text-amber-300"><Trophy size={22} /> Race Winner</div>
      ) : (
        <Medal
          className={index === 1 ? "text-slate-300" : "text-orange-300"}
          size={22}
        />
      )}
      <div className="mt-1 flex h-32 items-end justify-center overflow-hidden">
        <DriverCharacter configuration={result.driver.character.configuration} teamSuit={result.representedTeam.teamSuit.configuration} pose={index === 0 ? result.driver.character.winnerPose : result.driver.character.normalPose} variant={index === 0 ? "winner" : "portrait"} driverNumber={result.driver.number} driverInitials={result.driver.name} teamLogoUrl={result.representedTeam.logoUrl} alt={`Fahrercharakter von ${result.driver.name}`} className="h-36 w-auto" showShadow={false} />
      </div>
      <p className="mt-4 flex items-center gap-2 text-lg font-bold text-white"><CountryFlag countryCode={null} fallbackFlag={result.driver.flag} size="sm" />{result.driver.name}</p>
      <p className="mt-1 text-sm text-slate-400">
        <span className="inline-flex items-center gap-2"><TeamLogo logoUrl={result.representedTeam.logoUrl} teamName={result.representedTeam.name} shortName={result.representedTeam.shortName} primaryColor={result.representedTeam.color} size="xs" />{result.representedTeam.name}</span>
      </p>
      <p className="mt-4 text-2xl font-black text-white">
        {formatPoints(result.racePoints + result.bonusPoints)} Pkt.
      </p>
    </Link>
  );
}

function ResultRow({ result }: { result: SessionResult }) {
  return (
    <tr>
      <td className="font-mono text-xl font-black text-white">
        {result.finalPosition ?? result.position ?? "–"}
      </td>
      <td>
        <Link
          href={`/drivers/${result.driver.id}`}
          className="font-semibold text-white hover:text-blue-300"
        >
          <span className="inline-flex items-center gap-2"><DriverCharacter configuration={result.driver.character.configuration} teamSuit={result.representedTeam.teamSuit.configuration} pose={result.driver.character.normalPose} variant="tableThumbnail" alt={`Fahrercharakter von ${result.driver.name}`} className="size-9" showShadow={false} /><CountryFlag countryCode={null} fallbackFlag={result.driver.flag} size="sm" />#{result.driver.number} {result.driver.name}</span>
        </Link>
        {result.substitute ? (
          <p className="mt-1 text-xs text-amber-300">
            EF für {result.expectedDriver?.name ?? "Stammfahrer"}
          </p>
        ) : null}
      </td>
      <td className="text-slate-300"><span className="inline-flex items-center gap-2"><TeamLogo logoUrl={result.representedTeam.logoUrl} teamName={result.representedTeam.name} shortName={result.representedTeam.shortName} primaryColor={result.representedTeam.color} size="xs" />{result.representedTeam.name}</span></td>
      <td className="text-slate-300">{resultStatusLabels[result.status]}</td>
      <td className="text-right font-bold text-blue-200">
        {formatPoints(result.racePoints + result.bonusPoints)}
      </td>
      <td className="text-right font-mono text-slate-400">
        {result.lapsBehind > 0
          ? `+${result.lapsBehind} ${
              result.lapsBehind === 1 ? "Runde" : "Runden"
            }`
          : duration(result.gapToWinnerMs)}
      </td>
      <td className="text-right font-mono text-slate-400">
        {duration(result.gapToPreviousMs)}
      </td>
      <td className="text-right text-slate-300">{result.lapsCompleted}</td>
      <td>
        <ResultMarkers result={result} />
      </td>
    </tr>
  );
}

function MobileResult({ result }: { result: SessionResult }) {
  return (
    <article className="surface-panel rounded-2xl p-4">
      <div className="grid grid-cols-[2.5rem_2.75rem_minmax(0,1fr)_auto] items-center gap-2 sm:gap-3">
        <span className="font-mono text-2xl font-black text-white">
          {result.finalPosition ?? result.position ?? "–"}
        </span>
        <DriverCharacter configuration={result.driver.character.configuration} teamSuit={result.representedTeam.teamSuit.configuration} pose={result.driver.character.normalPose} variant="tableThumbnail" alt={`Fahrercharakter von ${result.driver.name}`} className="size-11" showShadow={false} />
        <div className="min-w-0">
          <Link
            href={`/drivers/${result.driver.id}`}
            className="block truncate font-semibold text-white"
          >
            <span className="inline-flex items-center gap-2"><CountryFlag countryCode={null} fallbackFlag={result.driver.flag} size="sm" />{result.driver.name}</span>
          </Link>
          <p className="mt-1 truncate text-xs text-slate-500">
            <span className="inline-flex items-center gap-2"><TeamLogo logoUrl={result.representedTeam.logoUrl} teamName={result.representedTeam.name} shortName={result.representedTeam.shortName} primaryColor={result.representedTeam.color} size="xs" />{result.representedTeam.name}</span> · {resultStatusLabels[result.status]}
          </p>
        </div>
        <strong className="text-right text-blue-200">
          {formatPoints(result.racePoints + result.bonusPoints)}
          <span className="block text-[0.62rem] font-medium text-slate-500">
            Punkte
          </span>
        </strong>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-800 pt-3">
        <span className="font-mono text-sm text-cyan-200">
          {result.lapsBehind > 0
            ? `+${result.lapsBehind} R.`
            : duration(result.gapToWinnerMs)}
        </span>
        <ResultMarkers result={result} />
      </div>
    </article>
  );
}

function ResultMarkers({ result }: { result: SessionResult }) {
  return (
    <div className="flex flex-wrap gap-1">
      {result.fastestLap ? (
        <span className="rounded border border-violet-500/25 bg-violet-500/10 px-2 py-1 text-xs text-violet-200">
          SR{result.fastestLapMs ? ` · ${duration(result.fastestLapMs)}` : ""}
        </span>
      ) : null}
      {result.polePosition ? (
        <span className="rounded border border-blue-500/25 bg-blue-500/10 px-2 py-1 text-xs text-blue-200">
          Pole
        </span>
      ) : null}
      {result.substitute ? (
        <span className="rounded border border-amber-500/25 bg-amber-500/10 px-2 py-1 text-xs text-amber-200">
          EF
        </span>
      ) : null}
      {result.effectivePenaltyMs > 0 ? (
        <span className="rounded border border-red-500/25 bg-red-500/10 px-2 py-1 text-xs text-red-200">
          +{result.effectivePenaltyMs / 1000}s
        </span>
      ) : null}
    </div>
  );
}

function formatPoints(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    maximumFractionDigits: 2,
  }).format(value);
}
