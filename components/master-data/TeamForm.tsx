"use client";

import { useActionState, useState } from "react";
import {
  createTeamAction,
  updateTeamAction,
} from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type MasterDataOptions,
  type TeamItem,
} from "@/lib/master-data/types";
import ActionMessage from "./ActionMessage";

type TeamFormProps = {
  options: MasterDataOptions;
  team?: TeamItem;
};

export default function TeamForm({ options, team }: TeamFormProps) {
  const [color, setColor] = useState(team?.color ?? "#2563EB");
  const action = team
    ? updateTeamAction.bind(null, team.id)
    : createTeamAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialMasterDataActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="master-label">
          Teamname
          <input
            name="name"
            defaultValue={team?.name ?? ""}
            required
            maxLength={160}
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Kürzel
          <input
            name="shortName"
            defaultValue={team?.shortName ?? ""}
            required
            minLength={2}
            maxLength={12}
            className="form-control mt-2 uppercase"
          />
        </label>
        <label className="master-label">
          Teamfarbe
          <div className="mt-2 flex gap-3">
            <input
              type="color"
              name="color"
              value={color}
              onChange={(event) => setColor(event.target.value)}
              className="h-12 w-16 rounded-lg border border-slate-700 bg-slate-900 p-1"
            />
            <input
              value={color.toUpperCase()}
              readOnly
              aria-label="Aktuelle Teamfarbe"
              className="form-control opacity-60"
            />
          </div>
        </label>
        <label className="master-label">
          Liga
          <select
            name="leagueId"
            defaultValue={team?.league.id ?? options.leagues[0]?.id}
            className="form-control mt-2"
          >
            {options.leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.code} · {league.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Saison
          <select
            name="seasonId"
            defaultValue={team?.season?.id ?? options.seasons[0]?.id}
            className="form-control mt-2"
          >
            {options.seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {options.leagues.find(
                  (league) => league.id === season.leagueId,
                )?.code ?? "–"}{" "}
                · {season.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Team Principal
          <select
            name="principalUserId"
            defaultValue={team?.principal?.id ?? ""}
            className="form-control mt-2"
          >
            <option value="">Nicht zugewiesen</option>
            {options.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label sm:col-span-2">
          Fahreraufstellung
          <select
            multiple
            name="driverIds"
            defaultValue={
              team?.drivers.map((driver) => String(driver.id)) ?? []
            }
            className="form-control mt-2 min-h-36"
          >
            {options.drivers.map((driver) => (
              <option key={driver.id} value={driver.id}>
                #{driver.number} {driver.name}
                {driver.teamName ? ` · ${driver.teamName}` : ""}
                {driver.active ? "" : " · inaktiv"}
              </option>
            ))}
          </select>
          <span className="mt-2 block text-xs font-normal text-slate-500">
            Mit Strg/Cmd mehrere Fahrer auswählen. Fahrer anderer Teams werden
            beim Speichern in dieses Line-up verschoben.
          </span>
        </label>
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name="active"
          defaultChecked={team?.active ?? true}
          className="h-4 w-4 accent-blue-600"
        />
        Team aktiv
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button disabled={pending} className="wizard-primary-button">
          {pending
            ? "Speichert…"
            : team
              ? "Team speichern"
              : "Team erstellen"}
        </button>
      </div>
    </form>
  );
}
