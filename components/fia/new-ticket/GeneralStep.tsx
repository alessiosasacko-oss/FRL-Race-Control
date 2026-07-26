"use client";

import {
  fiaRaceSessions,
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
  const races = options.races.filter(
    (race) => race.leagueId === Number(data.leagueId),
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
          Wähle Liga, Rennen und Session aus. Die Saison wird automatisch
          aus dem Rennen übernommen.
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
                raceId: "",
                driverIds: [],
              }))
            }
            className="form-control mt-2 min-h-12"
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
          Grand Prix
          <select
            value={data.raceId}
            disabled={!data.leagueId}
            onChange={(event) => {
              const race = options.races.find(
                (item) => item.id === Number(event.target.value),
              );
              const allowedSessions = race?.sessions.filter((session) =>
                fiaRaceSessions.includes(
                  session as (typeof fiaRaceSessions)[number],
                ),
              );
              setData((previous) => ({
                ...previous,
                raceId: event.target.value,
                session: allowedSessions?.at(-1) ?? previous.session,
              }));
            }}
            className="form-control mt-2 min-h-12 disabled:opacity-50"
          >
            <option value="">Grand Prix auswählen</option>
            {races.map((race) => (
              <option key={race.id} value={race.id}>
                {race.name}
                {race.circuit ? ` · ${race.circuit}` : ""}
              </option>
            ))}
          </select>
        </label>
      </div>

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
          className="form-control mt-2 min-h-12 disabled:opacity-50"
        >
          {(selectedRace?.sessions ?? [])
            .filter((session) =>
              fiaRaceSessions.includes(
                session as (typeof fiaRaceSessions)[number],
              ),
            )
            .map((session) => (
            <option key={session} value={session}>
              {raceSessionLabels[session]}
            </option>
            ))}
        </select>
      </label>
    </div>
  );
}
