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
  const [color, setColor] = useState(organization?.color ?? "#2563EB");
  const [secondaryColor, setSecondaryColor] = useState(
    organization?.secondaryColor ?? "#0F172A",
  );
  const [contrastColor, setContrastColor] = useState(
    organization?.contrastColor ?? "#FFFFFF",
  );
  const action = organization
    ? updateTeamOrganizationAction.bind(null, organization.id)
    : createTeamOrganizationAction;
  const [state, formAction, pending] = useActionState(
    action,
    initialMasterDataActionState,
  );
  const currentSeasonName =
    organization?.currentSeasonName ??
    options.seasons.find((season) => season.active && !season.archived)?.name ??
    null;

  return (
    <form action={formAction} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="master-label">
          Teamname
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
        <ColorField
          label="Hauptfarbe"
          name="color"
          value={color}
          onChange={setColor}
        />
        <ColorField
          label="Sekundärfarbe"
          name="secondaryColor"
          value={secondaryColor}
          onChange={setSecondaryColor}
        />
        <ColorField
          label="Kontrastfarbe"
          name="contrastColor"
          value={contrastColor}
          onChange={setContrastColor}
        />
        <label className="master-label">
          Logo-URL (optional)
          <input
            name="logoUrl"
            type="url"
            maxLength={2_000}
            defaultValue={organization?.logoUrl ?? ""}
            placeholder="https://…"
            className="form-control mt-2"
          />
        </label>
        <label className="master-label sm:col-span-2">
          Teamchef {currentSeasonName ? `· ${currentSeasonName}` : "· aktuelle Saison"}
          <select
            name="principalUserId"
            defaultValue={organization?.principal?.id ?? ""}
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
      {organization ? (
        <>
          <input type="hidden" name="active" value="on" />
          <p className="rounded-xl border border-slate-800 px-4 py-3 text-sm text-slate-400">
            Status: Aktiv · Zum Deaktivieren die sichere Aktion „Archivieren“ verwenden.
          </p>
        </>
      ) : (
        <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-800 px-4 text-sm text-slate-300">
          <input
            type="checkbox"
            name="active"
            defaultChecked
            className="size-5 accent-blue-600"
          />
          Team aktiv
        </label>
      )}
      {!currentSeasonName ? (
        <p className="rounded-xl border border-amber-500/25 bg-amber-500/10 p-3 text-sm text-amber-100">
          Ohne aktive Saison kann noch kein aktueller Teamchef gespeichert werden.
        </p>
      ) : null}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button disabled={pending} className="wizard-primary-button min-h-11 w-full sm:w-auto">
          {pending ? "Speichert…" : organization ? "Team speichern" : "Team erstellen"}
        </button>
      </div>
    </form>
  );
}

function ColorField({
  label,
  name,
  value,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <label className="master-label">
      {label}
      <div className="mt-2 flex min-w-0 gap-3">
        <input
          type="color"
          name={name}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-12 w-16 shrink-0 rounded-lg border border-slate-700 bg-slate-900 p-1"
        />
        <input
          value={value.toUpperCase()}
          readOnly
          aria-label={`Aktuelle ${label}`}
          className="form-control min-w-0 opacity-60"
        />
      </div>
    </label>
  );
}
