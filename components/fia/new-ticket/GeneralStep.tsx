"use client";

import {
  raceSessionLabels,
  type RaceSession,
} from "@/domain";
import type { TicketWizardOptions } from "@/lib/fia/types";
import type { TicketWizardDraft } from "./wizard-types";

type GeneralStepProps = {
  data: TicketWizardDraft;
  options: TicketWizardOptions;
  setData: React.Dispatch<React.SetStateAction<TicketWizardDraft>>;
};

export default function GeneralStep({
  data,
  options,
  setData,
}: GeneralStepProps) {
  const seasons = options.seasons.filter(
    (season) => season.leagueId === Number(data.leagueId),
  );
  const races = options.races.filter(
    (race) => race.seasonId === Number(data.seasonId),
  );
  const selectedRace = races.find(
    (race) => race.id === Number(data.raceId),
  );

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-white">
          Allgemeine Informationen
        </h2>
        <p className="mt-2 text-slate-400">
          Wähle Liga, Saison, Rennen und Session aus.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <label className="block text-sm font-medium text-slate-300">
          Liga
          <select
            value={data.leagueId}
            onChange={(event) =>
              setData((previous) => ({
                ...previous,
                leagueId: event.target.value,
                seasonId: "",
                raceId: "",
                driverIds: [],
              }))
            }
            className="form-control mt-2"
          >
            <option value="">Liga auswählen</option>
            {options.leagues.map((league) => (
              <option key={league.id} value={league.id}>
                {league.code} · {league.name}
              </option>
            ))}
          </select>
        </label>

        <label className="block text-sm font-medium text-slate-300">
          Saison
          <select
            value={data.seasonId}
            disabled={!data.leagueId}
            onChange={(event) =>
              setData((previous) => ({
                ...previous,
                seasonId: event.target.value,
                raceId: "",
              }))
            }
            className="form-control mt-2 disabled:opacity-50"
          >
            <option value="">Saison auswählen</option>
            {seasons.map((season) => (
              <option key={season.id} value={season.id}>
                {season.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label className="block text-sm font-medium text-slate-300">
        Grand Prix
        <select
          value={data.raceId}
          disabled={!data.seasonId}
          onChange={(event) => {
            const race = options.races.find(
              (item) => item.id === Number(event.target.value),
            );
            setData((previous) => ({
              ...previous,
              raceId: event.target.value,
              session: race?.sessions.at(-1) ?? previous.session,
            }));
          }}
          className="form-control mt-2 disabled:opacity-50"
        >
          <option value="">Grand Prix auswählen</option>
          {races.map((race) => (
            <option key={race.id} value={race.id}>
              {race.name} · {race.circuit}
            </option>
          ))}
        </select>
      </label>

      <label className="block text-sm font-medium text-slate-300">
        Session
        <select
          value={data.session}
          disabled={!selectedRace}
          onChange={(event) =>
            setData((previous) => ({
              ...previous,
              session: event.target.value as RaceSession,
            }))
          }
          className="form-control mt-2 disabled:opacity-50"
        >
          {(selectedRace?.sessions ?? []).map((session) => (
            <option key={session} value={session}>
              {raceSessionLabels[session]}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}
