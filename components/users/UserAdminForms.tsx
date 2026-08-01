"use client";

import { useActionState, useMemo, useState } from "react";
import { DriverLineupStatus, Role, roleLabels } from "@/domain";
import CountrySelect from "@/components/ui/CountrySelect";
import { initialUserAdminActionState } from "@/lib/users/action-state";
import {
  updateUserRolesAction,
  updateUserSportAssignmentAction,
  updateUserStatusAction,
} from "@/lib/users/actions";
import { activeUserRoleRequirementMessage } from "@/lib/users/policy";

const editableRoles = [
  Role.Driver,
  Role.TeamPrincipal,
  Role.Steward,
  Role.Admin,
  Role.SuperAdmin,
] as const;

type Options = {
  leagues: Array<{ id: number; code: string; name: string }>;
  seasons: Array<{ id: number; name: string; active: boolean; archivedAt: Date | null }>;
  organizations: Array<{ id: number; name: string; shortName: string; color: string }>;
  primaryAssignments: Array<{
    driverId: number;
    seasonId: number;
    leagueId: number;
    organizationId: number | null;
    driver: { name: string; number: number };
    season: { name: string };
    league: { code: string };
    organization: { name: string } | null;
  }>;
};

type Assignment = {
  seasonId: number;
  leagueId: number;
  organizationId: number | null;
  lineupStatus: DriverLineupStatus;
} | null;

export function RoleEditor({
  userId,
  roles,
  actorIsSuperAdmin,
}: {
  userId: number;
  roles: Role[];
  actorIsSuperAdmin: boolean;
}) {
  const [selected, setSelected] = useState<Role[]>(roles);
  const [state, action, pending] = useActionState(
    updateUserRolesAction.bind(null, userId),
    initialUserAdminActionState,
  );
  const changes = useMemo(() => [
    ...selected.filter((role) => !roles.includes(role)).map((role) => `${roleLabels[role]}: hinzugefügt`),
    ...roles.filter((role) => !selected.includes(role)).map((role) => `${roleLabels[role]}: entfernt`),
  ], [roles, selected]);
  const hasChanges = changes.length > 0;

  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-2 sm:grid-cols-2">
        {editableRoles.map((role) => (
          <label key={role} className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/35 px-4">
            <input
              type="checkbox"
              name="roles"
              value={role}
              checked={selected.includes(role)}
              disabled={role === Role.SuperAdmin && !actorIsSuperAdmin}
              onChange={(event) => setSelected((current) => event.target.checked ? [...current, role] : current.filter((item) => item !== role))}
              className="size-5 accent-blue-600"
            />
            <span>{roleLabels[role]}</span>
          </label>
        ))}
      </div>
      {roles.includes(Role.FiaPresident) ? (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
          FIA-Präsident ist eine Legacy-Rolle. Bestehende Leserechte bleiben erhalten; neue Freigabeschritte werden nicht erzeugt.
          <input type="hidden" name="roles" value={Role.FiaPresident} />
        </div>
      ) : null}
      <div className="rounded-xl border border-slate-800 bg-slate-950/35 p-4 text-sm">
        <p className="font-bold text-white">Änderungsübersicht</p>
        {changes.length ? (
          <ul className="mt-2 space-y-1 text-slate-300">{changes.map((change) => <li key={change}>{change}</li>)}</ul>
        ) : <p className="mt-2 text-slate-500">Keine Änderungen</p>}
      </div>
      <ReasonAndConfirmation />
      {selected.length === 0 ? (
        <p className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-200">
          {activeUserRoleRequirementMessage}
        </p>
      ) : null}
      <button disabled={pending || !hasChanges || selected.length === 0} className="wizard-primary-button min-h-11 w-full sm:w-auto">
        {pending ? "Speichert…" : "Rollen speichern"}
      </button>
      <ActionState state={state} />
    </form>
  );
}

export function SportAssignmentEditor({
  userId,
  displayName,
  driver,
  assignment,
  options,
}: {
  userId: number;
  displayName: string;
  driver: { id: number; name: string; number: number; countryCode: string; active: boolean } | null;
  assignment: Assignment;
  options: Options;
}) {
  const [state, action, pending] = useActionState(
    updateUserSportAssignmentAction.bind(null, userId),
    initialUserAdminActionState,
  );
  return (
    <form action={action} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="master-label">Fahrername<input name="driverName" defaultValue={driver?.name ?? displayName} className="form-control mt-2" required /></label>
        <label className="master-label">Fahrernummer<input name="number" type="number" min={1} max={999} defaultValue={driver?.number ?? ""} className="form-control mt-2" required /></label>
        <label className="master-label">Saison<select name="seasonId" defaultValue={assignment?.seasonId ?? options.seasons[0]?.id} className="form-control mt-2">{options.seasons.map((season) => <option key={season.id} value={season.id}>{season.name}{season.archivedAt ? " · Archiv" : ""}</option>)}</select></label>
        <label className="master-label">Liga<select name="leagueId" defaultValue={assignment?.leagueId ?? options.leagues[0]?.id} className="form-control mt-2">{options.leagues.map((league) => <option key={league.id} value={league.id}>{league.code} · {league.name}</option>)}</select></label>
        <label className="master-label">Team<select name="organizationId" defaultValue={assignment?.organizationId ?? ""} className="form-control mt-2"><option value="">Ohne Team</option>{options.organizations.map((organization) => <option key={organization.id} value={organization.id}>{organization.name}</option>)}</select></label>
        <label className="master-label">Fahrerstatus<select name="lineupStatus" defaultValue={assignment?.lineupStatus ?? DriverLineupStatus.Primary} className="form-control mt-2"><option value={DriverLineupStatus.Primary}>Stammfahrer</option><option value={DriverLineupStatus.Substitute}>Ersatzfahrer</option></select></label>
        <label className="master-label sm:col-span-2">Optional Stammfahrer ersetzen<select name="replacementDriverId" defaultValue="" className="form-control mt-2"><option value="">Niemanden ersetzen</option>{options.primaryAssignments.filter((item) => item.driverId !== driver?.id).map((item) => <option key={`${item.driverId}-${item.seasonId}`} value={item.driverId}>#{item.driver.number} {item.driver.name} · {item.season.name} · {item.league.code} · {item.organization?.name ?? "Ohne Team"}</option>)}</select></label>
        <label className="master-label">Land<CountrySelect defaultValue={driver?.countryCode ?? "DE"} /></label>
      </div>
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-800 px-4 text-sm"><input type="checkbox" name="active" defaultChecked={driver?.active ?? true} className="size-5 accent-blue-600" />Sportlich aktiv</label>
      <p className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-4 text-sm text-blue-100">
        Liga und globales Team werden getrennt gespeichert. Historische Ergebnisse und Anmeldungen werden nicht verändert.
      </p>
      <ReasonAndConfirmation />
      <ActionState state={state} />
      <button disabled={pending} className="wizard-primary-button w-full sm:w-auto">{pending ? "Speichert…" : "Sportliche Zuordnung speichern"}</button>
    </form>
  );
}

export function AccountStatusEditor({ userId, active }: { userId: number; active: boolean }) {
  const [state, action, pending] = useActionState(updateUserStatusAction.bind(null, userId), initialUserAdminActionState);
  return (
    <form action={action} className="space-y-4">
      <label className="flex min-h-12 items-center gap-3 rounded-xl border border-slate-800 px-4"><input type="checkbox" name="active" defaultChecked={active} className="size-5 accent-blue-600" />Konto aktiv</label>
      <ReasonAndConfirmation />
      <ActionState state={state} />
      <button disabled={pending} className="wizard-secondary-button w-full sm:w-auto">Kontostatus speichern</button>
    </form>
  );
}

function ReasonAndConfirmation() {
  return (
    <div className="space-y-3">
      <label className="master-label">Optionaler Grund<textarea name="reason" maxLength={500} rows={2} className="form-control mt-2" /></label>
      <label className="flex min-h-12 items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100"><input type="checkbox" name="confirmed" required className="mt-0.5 size-5 accent-amber-500" />Ich habe die Änderungsübersicht und Auswirkungen geprüft.</label>
    </div>
  );
}

function ActionState({ state }: { state: typeof initialUserAdminActionState }) {
  if (state.status === "idle") return null;
  return <div role="status" className={`rounded-xl border p-3 text-sm ${state.status === "success" ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-200" : "border-red-500/30 bg-red-500/10 text-red-200"}`}>{state.message}{state.changes?.length ? <ul className="mt-2">{state.changes.map((change) => <li key={change}>{change}</li>)}</ul> : null}</div>;
}
