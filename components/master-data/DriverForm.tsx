"use client";

import { useActionState } from "react";
import {
  createDriverAction,
  updateDriverAction,
} from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type DriverItem,
  type MasterDataOptions,
} from "@/lib/master-data/types";
import ActionMessage from "./ActionMessage";

type DriverFormProps = {
  options: MasterDataOptions;
  driver?: DriverItem;
};

export default function DriverForm({
  options,
  driver,
}: DriverFormProps) {
  const action = driver
    ? updateDriverAction.bind(null, driver.id)
    : createDriverAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialMasterDataActionState,
  );

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="master-label">
          Name
          <input
            name="name"
            defaultValue={driver?.name ?? ""}
            required
            maxLength={160}
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Startnummer
          <input
            type="number"
            name="number"
            defaultValue={driver?.number ?? ""}
            min={1}
            max={999}
            required
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Flagge
          <input
            name="flag"
            defaultValue={driver?.flag ?? ""}
            required
            maxLength={16}
            placeholder="🇩🇪"
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Ländercode
          <input
            name="countryCode"
            defaultValue={driver?.countryCode ?? "DE"}
            required
            minLength={2}
            maxLength={2}
            className="form-control mt-2 uppercase"
          />
        </label>
        <label className="master-label">
          Liga
          <select
            name="leagueId"
            defaultValue={driver?.league.id ?? options.leagues[0]?.id}
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
          Team
          <select
            name="teamId"
            defaultValue={driver?.team?.id ?? ""}
            className="form-control mt-2"
          >
            <option value="">Kein Team</option>
            {options.teams.map((team) => (
              <option key={team.id} value={team.id}>
                {options.leagues.find(
                  (league) => league.id === team.leagueId,
                )?.code ?? "–"}{" "}
                · {team.name}
                {options.seasons.find(
                  (season) => season.id === team.seasonId,
                )
                  ? ` · ${
                      options.seasons.find(
                        (season) => season.id === team.seasonId,
                      )?.name
                    }`
                  : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label sm:col-span-2">
          Discord-Benutzer
          <select
            name="userId"
            defaultValue={driver?.userId ?? ""}
            className="form-control mt-2"
          >
            <option value="">Nicht verknüpft</option>
            {options.users.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
                {user.discordId ? ` · ${user.discordId}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name="active"
          defaultChecked={driver?.active ?? true}
          className="h-4 w-4 accent-blue-600"
        />
        Fahrer aktiv
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button disabled={pending} className="wizard-primary-button">
          {pending
            ? "Speichert…"
            : driver
              ? "Fahrer speichern"
              : "Fahrer erstellen"}
        </button>
      </div>
    </form>
  );
}
