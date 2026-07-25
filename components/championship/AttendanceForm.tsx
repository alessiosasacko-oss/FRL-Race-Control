"use client";

import { useActionState } from "react";
import {
  AttendanceStatus,
  attendanceStatusLabels,
} from "@/domain";
import { updateAttendanceAction } from "@/lib/championship/actions";
import {
  initialSportsActionState,
  type AttendanceEntryView,
} from "@/lib/championship/types";
import ActionMessage from "./ActionMessage";

type AttendanceFormProps = {
  raceId: number;
  entry: AttendanceEntryView;
  canAssignSubstitute: boolean;
  teams: Array<{ id: number; name: string }>;
  substituteDrivers: Array<{
    id: number;
    name: string;
    number: number;
    flag: string;
  }>;
};

export default function AttendanceForm({
  raceId,
  entry,
  canAssignSubstitute,
  teams,
  substituteDrivers,
}: AttendanceFormProps) {
  const [state, action, pending] = useActionState(
    updateAttendanceAction,
    initialSportsActionState,
  );

  return (
    <form action={action} className="mt-4 space-y-3">
      <input type="hidden" name="raceId" value={raceId} />
      <input type="hidden" name="driverId" value={entry.driver.id} />
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="master-label">
          Antwort
          <select
            name="status"
            defaultValue={
              entry.status === AttendanceStatus.NoResponse
                ? AttendanceStatus.Registered
                : entry.status
            }
            className="form-control mt-2"
          >
            <option value={AttendanceStatus.Registered}>
              {attendanceStatusLabels[AttendanceStatus.Registered]}
            </option>
            <option value={AttendanceStatus.Declined}>
              {attendanceStatusLabels[AttendanceStatus.Declined]}
            </option>
          </select>
        </label>
        {canAssignSubstitute ? (
          <label className="master-label">
            Ersatzfahrer
            <select
              name="substituteDriverId"
              defaultValue={entry.substitute?.id ?? ""}
              className="form-control mt-2"
            >
              <option value="">Kein Ersatzfahrer</option>
              {substituteDrivers
                .filter((driver) => driver.id !== entry.driver.id)
                .map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.flag} #{driver.number} {driver.name}
                  </option>
                ))}
            </select>
          </label>
        ) : null}
        {canAssignSubstitute ? (
          <label className="master-label sm:col-span-2">
            Vertretenes Team
            <select
              name="representedTeamId"
              defaultValue={
                entry.representedTeam?.id ??
                entry.driver.team?.id ??
                ""
              }
              className="form-control mt-2"
            >
              <option value="">Kein Team</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        ) : null}
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button
          disabled={pending}
          className="wizard-primary-button"
        >
          {pending ? "Speichert…" : "Antwort speichern"}
        </button>
      </div>
    </form>
  );
}
