import AppLayout from "@/components/layout/AppLayout";
import AdjustmentForm from "@/components/championship/AdjustmentForm";
import { championshipAdjustmentTargetLabels } from "@/domain";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getAdjustmentAdminData } from "@/lib/championship/queries";
import { entityIdSchema } from "@/lib/master-data/schemas";

type AdjustmentsPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function AdjustmentsPage({
  searchParams,
}: AdjustmentsPageProps) {
  await requirePermission(Permission.ManageChampionshipAdjustments);
  const raw = (await searchParams).seasonId;
  const parsed = entityIdSchema.safeParse(
    Array.isArray(raw) ? raw[0] : raw,
  );
  const data = await getAdjustmentAdminData(
    parsed.success ? parsed.data : undefined,
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Manuelle Punkteanpassungen
          </h1>
          <p className="mt-2 text-slate-400">
            Append-only Korrekturen ergänzen berechnete Punkte, ohne
            Ergebnisdaten zu überschreiben.
          </p>
        </div>
        <form
          action="/admin/adjustments"
          className="master-card flex flex-col gap-3 sm:flex-row sm:items-end"
        >
          <label className="master-label flex-1">
            Saison
            <select
              name="seasonId"
              defaultValue={data.selectedSeasonId ?? ""}
              className="form-control mt-2"
            >
              {data.seasons.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.league.code} · {season.name}
                </option>
              ))}
            </select>
          </label>
          <button className="wizard-primary-button">Laden</button>
        </form>

        {data.selectedSeasonId ? (
          <section className="master-card">
            <h2 className="mb-5 text-xl font-semibold text-white">
              Neue Anpassung
            </h2>
            <AdjustmentForm
              seasonId={data.selectedSeasonId}
              drivers={data.drivers}
              teams={data.teams}
              races={data.races}
              tickets={data.tickets}
            />
          </section>
        ) : null}

        <section className="master-card">
          <h2 className="text-xl font-semibold text-white">
            Unveränderbare Historie
          </h2>
          <div className="mt-4 space-y-3">
            {data.adjustments.map((adjustment) => (
              <article
                key={adjustment.id}
                className="rounded-xl border border-slate-800 bg-slate-950/40 p-4"
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <p className="font-semibold text-white">
                    {
                      championshipAdjustmentTargetLabels[
                        adjustment.target
                      ]
                    }
                    :{" "}
                    {adjustment.driver?.name ??
                      adjustment.team?.name ??
                      "Unbekannt"}
                  </p>
                  <strong
                    className={
                      adjustment.points >= 0
                        ? "text-green-300"
                        : "text-red-300"
                    }
                  >
                    {adjustment.points >= 0 ? "+" : ""}
                    {adjustment.points} Punkte
                  </strong>
                </div>
                <p className="mt-2 text-sm text-slate-300">
                  {adjustment.reason}
                </p>
                <p className="mt-2 text-xs text-slate-500">
                  {adjustment.actor.displayName} ·{" "}
                  {new Intl.DateTimeFormat("de-DE", {
                    dateStyle: "medium",
                    timeStyle: "short",
                  }).format(adjustment.createdAt)}
                  {adjustment.race
                    ? ` · ${adjustment.race.name}`
                    : ""}
                  {adjustment.fiaTicket
                    ? ` · FIA #${adjustment.fiaTicket.id}`
                    : ""}
                </p>
              </article>
            ))}
            {data.adjustments.length === 0 ? (
              <p className="py-8 text-center text-slate-400">
                Noch keine manuellen Anpassungen.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
