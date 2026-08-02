"use client";

import { useLiveActionState as useActionState } from "@/components/live/useLiveActionState";
import { ResultSession } from "@/domain";
import {
  recalculateChampionshipAction,
  saveScoringConfigurationAction,
} from "@/lib/championship/actions";
import {
  DEFAULT_RACE_POINTS,
  DEFAULT_SPRINT_POINTS,
} from "@/lib/championship/scoring";
import {
  initialSportsActionState,
} from "@/lib/championship/types";
import ActionMessage from "./ActionMessage";

type ScoringFormProps = {
  season: {
    id: number;
    league: { id: number };
    scoringConfiguration: {
      fastestLapPoint: number;
      fastestLapRequiresTopPosition: number | null;
      polePositionPoint: number;
      dnfScoresPoints: boolean;
      retiredScoresPoints: boolean;
      minimumClassifiedPercentage: number | null;
      teamPointsEnabled: boolean;
      substituteDriverPointsEnabled: boolean;
      deductPenaltyPoints: boolean;
      positions: Array<{
        session: string;
        position: number;
        points: number;
      }>;
    } | null;
  };
};

export default function ScoringForm({ season }: ScoringFormProps) {
  const [state, action, pending] = useActionState(
    saveScoringConfigurationAction,
    initialSportsActionState,
  );
  const [recalcState, recalcAction, recalculating] = useActionState(
    recalculateChampionshipAction,
    initialSportsActionState,
  );
  const configuration = season.scoringConfiguration;
  const racePoints =
    configuration?.positions
      .filter((position) => position.session === ResultSession.Race)
      .sort((left, right) => left.position - right.position)
      .map((position) => position.points)
      .join(", ") ?? DEFAULT_RACE_POINTS.join(", ");
  const sprintPoints =
    configuration?.positions
      .filter(
        (position) => position.session === ResultSession.Sprint,
      )
      .sort((left, right) => left.position - right.position)
      .map((position) => position.points)
      .join(", ") ?? DEFAULT_SPRINT_POINTS.join(", ");

  return (
    <div className="space-y-5">
      <form action={action} className="space-y-5">
        <input type="hidden" name="seasonId" value={season.id} />
        <input type="hidden" name="leagueId" value={season.league.id} />
        <div className="grid gap-4 md:grid-cols-2">
          <label className="master-label md:col-span-2">
            Rennpunkte nach Position
            <input
              name="racePoints"
              defaultValue={racePoints}
              required
              className="form-control mt-2"
              placeholder="25, 18, 15, 12, 10, 8, 6, 4, 2, 1"
            />
          </label>
          <label className="master-label md:col-span-2">
            Sprintpunkte nach Position
            <input
              name="sprintPoints"
              defaultValue={sprintPoints}
              className="form-control mt-2"
              placeholder="8, 7, 6, 5, 4, 3, 2, 1"
            />
          </label>
          <NumberInput
            name="fastestLapPoint"
            label="Punkt für schnellste Runde"
            value={configuration?.fastestLapPoint ?? 1}
          />
          <NumberInput
            name="fastestLapRequiresTopPosition"
            label="Schnellste Runde nur bis Position"
            value={
              configuration?.fastestLapRequiresTopPosition ?? 10
            }
            optional
          />
          <NumberInput
            name="polePositionPoint"
            label="Punkt für Pole-Position"
            value={configuration?.polePositionPoint ?? 0}
          />
          <NumberInput
            name="minimumClassifiedPercentage"
            label="Mindestdistanz in Prozent"
            value={configuration?.minimumClassifiedPercentage ?? 90}
            maximum={100}
            optional
          />
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <Check
            name="dnfScoresPoints"
            label="DNF kann Punkte erhalten"
            checked={configuration?.dnfScoresPoints ?? false}
          />
          <Check
            name="retiredScoresPoints"
            label="RETIRED kann Punkte erhalten"
            checked={configuration?.retiredScoresPoints ?? false}
          />
          <Check
            name="teamPointsEnabled"
            label="Teampunkte aktiv"
            checked={configuration?.teamPointsEnabled ?? true}
          />
          <Check
            name="substituteDriverPointsEnabled"
            label="Ersatzfahrer erhält Fahrerpunkte"
            checked={
              configuration?.substituteDriverPointsEnabled ?? true
            }
          />
          <Check
            name="deductPenaltyPoints"
            label="FIA-Punktabzüge berücksichtigen"
            checked={configuration?.deductPenaltyPoints ?? false}
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <ActionMessage state={state} />
          <button
            disabled={pending}
            className="wizard-primary-button"
          >
            {pending
              ? "Speichert und berechnet…"
              : "Punktesystem speichern"}
          </button>
        </div>
      </form>
      <form
        action={recalcAction}
        className="flex flex-col gap-3 border-t border-slate-800 pt-5 sm:flex-row sm:items-center sm:justify-between"
      >
        <input type="hidden" name="seasonId" value={season.id} />
        <input type="hidden" name="leagueId" value={season.league.id} />
        <ActionMessage state={recalcState} />
        <button
          disabled={recalculating}
          className="wizard-secondary-button"
        >
          {recalculating
            ? "Berechnet…"
            : "Meisterschaft neu berechnen"}
        </button>
      </form>
    </div>
  );
}

function NumberInput({
  name,
  label,
  value,
  maximum,
  optional,
}: {
  name: string;
  label: string;
  value: number;
  maximum?: number;
  optional?: boolean;
}) {
  return (
    <label className="master-label">
      {label}
      <input
        type="number"
        name={name}
        min={0}
        max={maximum}
        step="0.01"
        defaultValue={value}
        required={!optional}
        className="form-control mt-2"
      />
    </label>
  );
}

function Check({
  name,
  label,
  checked,
}: {
  name: string;
  label: string;
  checked: boolean;
}) {
  return (
    <label className="flex items-center gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-4 text-sm text-slate-300">
      <input
        type="checkbox"
        name={name}
        defaultChecked={checked}
        className="accent-blue-500"
      />
      {label}
    </label>
  );
}
