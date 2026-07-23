"use client";

import { useActionState } from "react";
import { updateLeagueAction } from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type LeagueAdminItem,
} from "@/lib/master-data/types";
import ActionMessage from "./ActionMessage";

export default function LeagueForm({
  league,
}: {
  league: LeagueAdminItem;
}) {
  const action = updateLeagueAction.bind(null, league.id);
  const [state, formAction, pending] = useActionState(
    action,
    initialMasterDataActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="master-label">
          Code
          <input value={league.code} disabled className="form-control mt-2 opacity-60" />
        </label>
        <label className="master-label">
          Name
          <input
            name="name"
            defaultValue={league.name}
            required
            maxLength={160}
            className="form-control mt-2"
          />
        </label>
      </div>
      <label className="master-label">
        Beschreibung
        <textarea
          name="description"
          defaultValue={league.description ?? ""}
          rows={3}
          maxLength={5000}
          className="form-control mt-2"
        />
      </label>
      <label className="master-label">
        Aktuelle Saison
        <select
          name="currentSeasonId"
          defaultValue={league.currentSeasonId ?? ""}
          className="form-control mt-2"
        >
          <option value="">Keine aktuelle Saison</option>
          {league.seasons.map((season) => (
            <option
              key={season.id}
              value={season.id}
              disabled={!season.active || season.archived}
            >
              {season.name}
              {season.archived
                ? " (archiviert)"
                : season.active
                  ? ""
                  : " (inaktiv)"}
            </option>
          ))}
        </select>
      </label>
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name="active"
          defaultChecked={league.active}
          className="h-4 w-4 accent-blue-600"
        />
        Liga aktiv
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button disabled={pending} className="wizard-primary-button">
          {pending ? "Speichert…" : "Liga speichern"}
        </button>
      </div>
    </form>
  );
}
