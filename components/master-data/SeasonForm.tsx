"use client";

import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";
import {
  archiveSeasonAction,
  createSeasonAction,
  updateSeasonAction,
} from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type LeagueOption,
  type SeasonAdminItem,
} from "@/lib/master-data/types";
import ActionMessage from "./ActionMessage";

type SeasonFormProps = {
  leagues: LeagueOption[];
  season?: SeasonAdminItem;
};

export default function SeasonForm({
  leagues,
  season,
}: SeasonFormProps) {
  const saveAction = season
    ? updateSeasonAction.bind(null, season.id)
    : createSeasonAction;
  const archiveAction = archiveSeasonAction.bind(null, season?.id ?? 0);
  const [state, formAction, pending] = useActionState(
    saveAction,
    initialMasterDataActionState,
  );
  const [archiveState, archiveFormAction, archivePending] = useActionState(
    archiveAction,
    initialMasterDataActionState,
  );

  return (
    <div className="space-y-4">
      <form action={formAction} className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="master-label">
            Liga
            <select
              name="leagueId"
              defaultValue={season?.leagueId ?? leagues[0]?.id}
              required
              className="form-control mt-2"
            >
              {leagues.map((league) => (
                <option key={league.id} value={league.id}>
                  {league.code} · {league.name}
                </option>
              ))}
            </select>
          </label>
          <label className="master-label">
            Name
            <input
              name="name"
              defaultValue={season?.name ?? ""}
              required
              maxLength={160}
              placeholder="Season 8"
              className="form-control mt-2"
            />
          </label>
          <label className="master-label">
            Startdatum
            <input
              type="date"
              name="startsOn"
              defaultValue={season?.startsOn ?? ""}
              required
              className="form-control mt-2"
            />
          </label>
          <label className="master-label">
            Enddatum
            <input
              type="date"
              name="endsOn"
              defaultValue={season?.endsOn ?? ""}
              required
              className="form-control mt-2"
            />
          </label>
        </div>
        <label className="flex items-center gap-3 text-sm text-slate-300">
          <input
            type="checkbox"
            name="active"
            defaultChecked={season?.active ?? true}
            className="h-4 w-4 accent-blue-600"
          />
          Saison aktiv
        </label>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ActionMessage state={state} />
          <button disabled={pending} className="wizard-primary-button">
            {pending
              ? "Speichert…"
              : season
                ? "Saison speichern"
                : "Saison erstellen"}
          </button>
        </div>
      </form>

      {season && !season.archived ? (
        <form
          action={archiveFormAction}
          className="flex flex-col gap-3 border-t border-slate-800 pt-4 sm:flex-row sm:items-center sm:justify-between"
        >
          <ActionMessage state={archiveState} />
          <button
            disabled={archivePending}
            className="rounded-xl border border-amber-500/40 px-5 py-3 text-sm font-semibold text-amber-200 transition hover:bg-amber-500/10 disabled:opacity-50"
          >
            {archivePending ? "Archiviert…" : "Saison archivieren"}
          </button>
        </form>
      ) : null}
    </div>
  );
}
