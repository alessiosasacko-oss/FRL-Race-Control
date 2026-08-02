"use client";

import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";
import {
  createDriverAction,
  updateDriverAction,
} from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type DriverFormOptions,
  type DriverItem,
} from "@/lib/master-data/types";
import { DriverLineupStatus } from "@/domain";
import CountrySelect from "@/components/ui/CountrySelect";
import ActionMessage from "./ActionMessage";

type DriverFormProps = {
  options: DriverFormOptions;
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
  const assignment = driver?.assignment;
  const availableUsers = options.users.filter(
    (user) => user.driverId === null || user.driverId === driver?.id,
  );
  const defaultSeasonId =
    assignment?.season.id ?? options.seasons[0]?.id;
  const configurationReady =
    options.seasons.length > 0 && options.leagues.length > 0;

  return (
    <form action={formAction} className="min-w-0 space-y-4 overflow-x-hidden">
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
          Land
          <CountrySelect defaultValue={driver?.countryCode ?? "DE"} />
        </label>
        <label className="master-label">
          Saison
          <select
            name="seasonId"
            defaultValue={defaultSeasonId}
            required
            className="form-control mt-2"
          >
            {options.seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Liga
          <select
            name="leagueId"
            defaultValue={assignment?.league.id ?? driver?.league.id ?? options.leagues[0]?.id}
            required
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
            name="organizationId"
            defaultValue={assignment?.organization?.id ?? driver?.team?.id ?? ""}
            className="form-control mt-2"
          >
            <option value="">Kein Team</option>
            {options.organizations.map((organization) => (
              <option key={organization.id} value={organization.id}>
                {organization.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Fahrerstatus
          <select
            name="lineupStatus"
            defaultValue={assignment?.lineupStatus ?? DriverLineupStatus.Primary}
            className="form-control mt-2"
          >
            <option value={DriverLineupStatus.Primary}>Stammfahrer</option>
            <option value={DriverLineupStatus.Substitute}>Ersatzfahrer</option>
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
            {availableUsers.map((user) => (
              <option key={user.id} value={user.id}>
                {user.displayName}
                {user.discordId ? ` · ${user.discordId}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>
      {!configurationReady ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-100">
          Zum Speichern werden mindestens eine aktive Saison und eine aktive FRL-Liga benötigt.
        </p>
      ) : null}
      <label className="flex min-h-11 items-center gap-3 text-sm text-slate-300">
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
        <button disabled={pending || !configurationReady} className="wizard-primary-button min-h-11 w-full sm:w-auto">
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
