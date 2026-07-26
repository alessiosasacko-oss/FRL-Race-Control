import Link from "next/link";
import {
  Calculator,
  CheckCircle2,
  ClipboardList,
  Settings,
  TriangleAlert,
} from "lucide-react";
import AppLayout from "@/components/layout/AppLayout";
import RecalculateForm from "@/components/championship/RecalculateForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getChampionshipValidationOverview } from "@/lib/championship/queries";

const tools = [
  {
    href: "/admin/results",
    title: "Ergebnisse",
    description: "Rennen und Sprint transaktional erfassen",
    icon: ClipboardList,
  },
  {
    href: "/admin/scoring",
    title: "Punktesystem",
    description: "Saisonregeln und Positionspunkte",
    icon: Settings,
  },
  {
    href: "/admin/adjustments",
    title: "Punkteanpassungen",
    description: "Begründete Korrekturen mit Audit-Historie",
    icon: Calculator,
  },
];

export default async function ChampionshipAdminPage() {
  await requirePermission(Permission.ManageScoring);
  const overview = await getChampionshipValidationOverview();

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Meisterschafts-Engine
          </h1>
          <p className="mt-2 text-slate-400">
            Konfiguration, Validierungsübersicht und kontrollierte
            Neuberechnung.
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <Link
                key={tool.href}
                href={tool.href}
                className="master-card transition hover:-translate-y-1 hover:border-blue-500"
              >
                <Icon className="text-blue-400" />
                <h2 className="mt-4 font-semibold text-white">
                  {tool.title}
                </h2>
                <p className="mt-2 text-sm text-slate-400">
                  {tool.description}
                </p>
              </Link>
            );
          })}
        </div>
        <section className="master-card">
          <h2 className="text-xl font-semibold text-white">
            Validierungsübersicht
          </h2>
          <div className="mt-5 space-y-3">
            {overview.map((season) => {
              const valid =
                season.hasScoring &&
                season.missingRaceResults === 0 &&
                season.missingSprintResults === 0;
              return (
                <article
                  key={`${season.id}-${season.leagueId}`}
                  className="flex flex-col gap-4 rounded-xl border border-slate-800 bg-slate-950/40 p-4 lg:flex-row lg:items-center lg:justify-between"
                >
                  <div className="flex gap-3">
                    {valid ? (
                      <CheckCircle2 className="text-green-400" />
                    ) : (
                      <TriangleAlert className="text-amber-400" />
                    )}
                    <div>
                      <h3 className="font-semibold text-white">
                        {season.label}
                      </h3>
                      <p className="mt-1 text-sm text-slate-400">
                        Punktesystem:{" "}
                        {season.hasScoring ? "vorhanden" : "fehlt"} ·
                        Fehlende Rennen: {season.missingRaceResults} ·
                        Fehlende Sprints: {season.missingSprintResults}
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        {season.driverStandings} Fahrer ·{" "}
                        {season.teamStandings} Teams
                        {season.recalculatedAt
                          ? ` · zuletzt ${new Intl.DateTimeFormat(
                              "de-DE",
                              {
                                dateStyle: "short",
                                timeStyle: "short",
                              },
                            ).format(
                              new Date(season.recalculatedAt),
                            )}`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <RecalculateForm
                    seasonId={season.id}
                    leagueId={season.leagueId}
                  />
                </article>
              );
            })}
            {overview.length === 0 ? (
              <p className="py-8 text-center text-slate-400">
                Noch keine Saisons vorhanden.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
