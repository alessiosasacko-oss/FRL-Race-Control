import AppLayout from "@/components/layout/AppLayout";
import ScoringForm from "@/components/championship/ScoringForm";
import { Permission } from "@/lib/auth/permissions";
import { requirePermission } from "@/lib/auth/session";
import { getScoringAdminData } from "@/lib/championship/queries";
import { entityIdSchema } from "@/lib/master-data/schemas";
import { getMasterDataFilterOptions } from "@/lib/master-data/queries";

type ScoringAdminPageProps = {
  searchParams: Promise<
    Record<string, string | string[] | undefined>
  >;
};

export default async function ScoringAdminPage({
  searchParams,
}: ScoringAdminPageProps) {
  await requirePermission(Permission.ManageScoring);
  const params = await searchParams;
  const raw = params.seasonId;
  const rawLeagueId = params.leagueId;
  const parsedSeasonId = entityIdSchema.safeParse(
    Array.isArray(raw) ? raw[0] : raw,
  );
  const parsedLeagueId = entityIdSchema.safeParse(
    Array.isArray(rawLeagueId) ? rawLeagueId[0] : rawLeagueId,
  );
  const [data, filterOptions] = await Promise.all([
    getScoringAdminData(
      parsedSeasonId.success ? parsedSeasonId.data : undefined,
      parsedLeagueId.success ? parsedLeagueId.data : undefined,
    ),
    getMasterDataFilterOptions(),
  ]);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-white">
            Punktesystem konfigurieren
          </h1>
          <p className="mt-2 text-slate-400">
            Eine zentrale Konfiguration steuert Rennen, Sprint,
            Bonuspunkte und Klassifizierung.
          </p>
        </div>
        <form
          action="/admin/scoring"
          className="master-card grid gap-3 sm:grid-cols-[180px_1fr_auto] sm:items-end"
        >
          <label className="master-label">
            Liga
            <select
              name="leagueId"
              defaultValue={data.selected?.league.id ?? ""}
              className="form-control mt-2"
            >
              {filterOptions.leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.code}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label flex-1">
            Saison
            <select
              name="seasonId"
              defaultValue={data.selected?.id ?? ""}
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
        {data.selected ? (
          <section className="master-card">
            <h2 className="mb-5 text-xl font-semibold text-white">
              {data.selected.league.code} · {data.selected.name}
            </h2>
            <ScoringForm season={data.selected} />
          </section>
        ) : (
          <div className="master-card text-center text-slate-400">
            Noch keine Saison vorhanden.
          </div>
        )}
      </div>
    </AppLayout>
  );
}
