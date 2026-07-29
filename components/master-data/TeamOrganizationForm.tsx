"use client";

import { useActionState, useState } from "react";
import {
  createTeamOrganizationAction,
  updateTeamOrganizationAction,
} from "@/lib/master-data/actions";
import {
  initialMasterDataActionState,
  type MasterDataOptions,
  type TeamOrganizationItem,
} from "@/lib/master-data/types";
import ActionMessage from "./ActionMessage";

export default function TeamOrganizationForm({
  options,
  organization,
}: {
  options: MasterDataOptions;
  organization?: TeamOrganizationItem;
}) {
  const [color, setColor] = useState(
    organization?.color ?? "#2563EB",
  );
  const action = organization
    ? updateTeamOrganizationAction.bind(null, organization.id)
    : createTeamOrganizationAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialMasterDataActionState,
  );
  const latestAssignment = organization?.seasons[0];

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="master-label">
          Organisationsname
          <input
            name="name"
            required
            maxLength={160}
            defaultValue={organization?.name ?? ""}
            className="form-control mt-2"
          />
        </label>
        <label className="master-label">
          Kürzel
          <input
            name="shortName"
            required
            minLength={2}
            maxLength={12}
            defaultValue={organization?.shortName ?? ""}
            className="form-control mt-2 uppercase"
          />
        </label>
        <label className="master-label">
          Organisationsfarbe
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
              aria-label="Aktuelle Organisationsfarbe"
              className="form-control opacity-60"
            />
          </div>
        </label>
        <label className="master-label">
          Saison für Teamchef-Zuordnung
          <select
            name="seasonId"
            defaultValue={latestAssignment?.seasonId ?? ""}
            className="form-control mt-2"
          >
            <option value="">Keine Zuordnung ändern</option>
            {options.seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
                {season.archived ? " · Archiv" : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Teamchef in dieser Saison
          <select
            name="principalUserId"
            defaultValue={latestAssignment?.principal?.id ?? ""}
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
      </div>
      {organization && organization.seasons.length > 0 ? (
        <div className="rounded-xl border border-slate-800 bg-slate-950/30 p-3 text-sm text-slate-400">
          {organization.seasons.map((season) => (
            <p key={season.seasonId}>
              {season.seasonName}:{" "}
              <strong className="text-slate-200">
                {season.principal?.displayName ?? "nicht zugewiesen"}
              </strong>
            </p>
          ))}
        </div>
      ) : null}
      <label className="flex items-center gap-3 text-sm text-slate-300">
        <input
          type="checkbox"
          name="active"
          defaultChecked={organization?.active ?? true}
          className="h-4 w-4 accent-blue-600"
        />
        Organisation aktiv
      </label>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button disabled={pending} className="wizard-primary-button">
          {pending
            ? "Speichert…"
            : organization
              ? "Organisation speichern"
              : "Organisation erstellen"}
        </button>
      </div>
    </form>
  );
}
