"use client";

import { useActionState, useState } from "react";
import {
  ChampionshipAdjustmentTarget,
  championshipAdjustmentTargetLabels,
} from "@/domain";
import { createChampionshipAdjustmentAction } from "@/lib/championship/actions";
import { initialSportsActionState } from "@/lib/championship/types";
import ActionMessage from "./ActionMessage";

type AdjustmentFormProps = {
  seasonId: number;
  drivers: Array<{ id: number; name: string; number: number }>;
  teams: Array<{ id: number; name: string }>;
  races: Array<{ id: number; name: string; round: number }>;
  tickets: Array<{ id: number; title: string }>;
};

export default function AdjustmentForm({
  seasonId,
  drivers,
  teams,
  races,
  tickets,
}: AdjustmentFormProps) {
  const [target, setTarget] = useState(
    ChampionshipAdjustmentTarget.Driver,
  );
  const [state, action, pending] = useActionState(
    createChampionshipAdjustmentAction,
    initialSportsActionState,
  );

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="seasonId" value={seasonId} />
      <div className="grid gap-4 md:grid-cols-2">
        <label className="master-label">
          Ziel
          <select
            name="target"
            value={target}
            onChange={(event) =>
              setTarget(
                event.target.value as ChampionshipAdjustmentTarget,
              )
            }
            className="form-control mt-2"
          >
            {Object.values(ChampionshipAdjustmentTarget).map(
              (value) => (
                <option key={value} value={value}>
                  {championshipAdjustmentTargetLabels[value]}
                </option>
              ),
            )}
          </select>
        </label>
        {target === ChampionshipAdjustmentTarget.Driver ? (
          <label className="master-label">
            Fahrer
            <select
              name="driverId"
              required
              className="form-control mt-2"
            >
              <option value="">Fahrer wählen</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  #{driver.number} {driver.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <label className="master-label">
            Team
            <select
              name="teamId"
              required
              className="form-control mt-2"
            >
              <option value="">Team wählen</option>
              {teams.map((team) => (
                <option key={team.id} value={team.id}>
                  {team.name}
                </option>
              ))}
            </select>
          </label>
        )}
        <label className="master-label">
          Punkte
          <input
            type="number"
            name="points"
            step="0.01"
            required
            className="form-control mt-2"
            placeholder="-5 oder 3"
          />
        </label>
        <label className="master-label">
          Zugehöriges Rennen
          <select name="raceId" className="form-control mt-2">
            <option value="">Kein Rennen</option>
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                R{race.round} · {race.name}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label">
          Zugehöriges FIA-Ticket
          <select name="fiaTicketId" className="form-control mt-2">
            <option value="">Kein FIA-Ticket</option>
            {tickets.map((ticket) => (
              <option key={ticket.id} value={ticket.id}>
                #{ticket.id} · {ticket.title}
              </option>
            ))}
          </select>
        </label>
        <label className="master-label md:col-span-2">
          Begründung
          <textarea
            name="reason"
            rows={3}
            minLength={3}
            maxLength={1000}
            required
            className="form-control mt-2"
          />
        </label>
      </div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <ActionMessage state={state} />
        <button
          disabled={pending}
          className="wizard-primary-button"
        >
          {pending ? "Erstellt und berechnet…" : "Anpassung erstellen"}
        </button>
      </div>
    </form>
  );
}
