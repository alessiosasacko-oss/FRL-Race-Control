import Link from "next/link";
import { ArrowLeft, Flag, Timer } from "lucide-react";
import { notFound } from "next/navigation";
import AppLayout from "@/components/layout/AppLayout";
import {
  resultSessionLabels,
  resultStatusLabels,
} from "@/domain";
import { requirePermission } from "@/lib/auth/session";
import { Permission } from "@/lib/auth/permissions";
import { getRaceResults } from "@/lib/championship/queries";
import { entityIdSchema } from "@/lib/master-data/schemas";

type ResultPageProps = {
  params: Promise<{ id: string }>;
};

function duration(value: number | null): string {
  if (value === null) return "–";
  const seconds = value / 1000;
  if (seconds < 60) return `${seconds.toFixed(3)} s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${(seconds % 60).toFixed(3).padStart(6, "0")}`;
}

export default async function ResultPage({ params }: ResultPageProps) {
  await requirePermission(Permission.ViewChampionship);
  const parsedId = entityIdSchema.safeParse((await params).id);
  if (!parsedId.success) notFound();

  const data = await getRaceResults(parsedId.data);
  if (!data) notFound();

  return (
    <AppLayout>
      <div className="space-y-6">
        <Link
          href="/calendar"
          className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
        >
          <ArrowLeft size={16} />
          Zurück zum Kalender
        </Link>

        <section className="master-card relative overflow-hidden">
          <div className="absolute left-0 top-0 h-full w-1 bg-blue-500" />
          <p className="text-xs font-semibold uppercase tracking-widest text-blue-400">
            {data.race.season.league.code} · {data.race.season.name} ·
            Runde {data.race.round}
          </p>
          <h1 className="mt-2 text-3xl font-bold text-white">
            {data.race.name}
          </h1>
          <p className="mt-2 text-slate-400">
            {data.race.circuit} · {data.race.countryCode}
          </p>
          {!data.race.revealMystery ? (
            <p className="mt-4 rounded-xl bg-amber-500/10 p-4 text-sm text-amber-200">
              Details dieses Mystery Race bleiben bis zum Abschluss
              verborgen.
            </p>
          ) : null}
        </section>

        {data.sessions.map((session) => (
          <section key={session.id} className="space-y-3">
            <div className="flex items-center gap-2">
              <Flag className="text-blue-400" size={20} />
              <h2 className="text-2xl font-semibold text-white">
                {resultSessionLabels[session.session]}
              </h2>
            </div>
            <div className="overflow-x-auto rounded-2xl border border-slate-800 bg-[#151B24]">
              <table className="min-w-[980px] w-full text-left text-sm">
                <thead className="border-b border-slate-800 text-xs uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="px-4 py-4">Pos.</th>
                    <th className="px-4 py-4">Fahrer</th>
                    <th className="px-4 py-4">Team</th>
                    <th className="px-4 py-4">Status</th>
                    <th className="px-4 py-4">Punkte</th>
                    <th className="px-4 py-4">Abstand</th>
                    <th className="px-4 py-4">Vorheriger</th>
                    <th className="px-4 py-4">Runden</th>
                    <th className="px-4 py-4">Marker</th>
                  </tr>
                </thead>
                <tbody>
                  {session.results.map((result) => (
                    <tr
                      key={result.id}
                      className="border-b border-slate-800/70 last:border-b-0"
                    >
                      <td className="px-4 py-4 text-xl font-bold text-white">
                        {result.position ?? "–"}
                      </td>
                      <td className="px-4 py-4">
                        <Link
                          href={`/drivers/${result.driver.id}`}
                          className="font-semibold text-white hover:text-blue-300"
                        >
                          {result.driver.flag} #{result.driver.number}{" "}
                          {result.driver.name}
                        </Link>
                        {result.substitute ? (
                          <p className="mt-1 text-xs text-amber-300">
                            EF für{" "}
                            {result.expectedDriver?.name ?? "Stammfahrer"}
                          </p>
                        ) : null}
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {result.representedTeam.name}
                      </td>
                      <td className="px-4 py-4">
                        {resultStatusLabels[result.status]}
                      </td>
                      <td className="px-4 py-4 font-semibold text-blue-300">
                        {new Intl.NumberFormat("de-DE", {
                          maximumFractionDigits: 2,
                        }).format(
                          result.racePoints + result.bonusPoints,
                        )}
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        {duration(result.gapToWinnerMs)}
                      </td>
                      <td className="px-4 py-4 text-slate-400">
                        {duration(result.gapToPreviousMs)}
                      </td>
                      <td className="px-4 py-4 text-slate-300">
                        {result.lapsCompleted}
                      </td>
                      <td className="px-4 py-4">
                        <div className="flex flex-wrap gap-1">
                          {result.fastestLap ? (
                            <span className="rounded bg-purple-500/15 px-2 py-1 text-xs text-purple-200">
                              SR
                            </span>
                          ) : null}
                          {result.polePosition ? (
                            <span className="rounded bg-blue-500/15 px-2 py-1 text-xs text-blue-200">
                              Pole
                            </span>
                          ) : null}
                          {result.substitute ? (
                            <span className="rounded bg-amber-500/15 px-2 py-1 text-xs text-amber-200">
                              EF
                            </span>
                          ) : null}
                          {result.penaltySeconds > 0 ? (
                            <span className="rounded bg-red-500/15 px-2 py-1 text-xs text-red-200">
                              +{result.penaltySeconds}s
                            </span>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {session.results.length === 0 ? (
                <div className="p-10 text-center text-slate-400">
                  Noch keine Ergebnisse eingetragen.
                </div>
              ) : null}
            </div>
            {session.results.some((result) => result.notes) ? (
              <details className="master-card">
                <summary className="cursor-pointer text-sm font-semibold text-slate-300">
                  Öffentliche Hinweise
                </summary>
                <ul className="mt-3 space-y-2 text-sm text-slate-400">
                  {session.results
                    .filter((result) => result.notes)
                    .map((result) => (
                      <li key={result.id}>
                        <Timer className="mr-2 inline" size={14} />
                        {result.driver.name}: {result.notes}
                      </li>
                    ))}
                </ul>
              </details>
            ) : null}
          </section>
        ))}

        {data.sessions.length === 0 ? (
          <div className="master-card text-center">
            <Flag className="mx-auto text-slate-500" />
            <h2 className="mt-4 text-xl font-semibold text-white">
              Noch keine Ergebnisse
            </h2>
          </div>
        ) : null}
      </div>
    </AppLayout>
  );
}
