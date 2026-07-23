import { RaceSession, raceSchema } from "@/domain";

export const races = raceSchema.array().parse([
  {
    id: 1,
    seasonId: 1,
    name: "Belgium Grand Prix",
    circuit: "Circuit de Spa-Francorchamps",
    countryCode: "BE",
    round: 7,
    scheduledAt: "2026-07-27T20:00:00+02:00",
    sessions: [
      RaceSession.Practice,
      RaceSession.Qualifying,
      RaceSession.Race,
    ],
    completed: false,
  },
  {
    id: 2,
    seasonId: 1,
    name: "Italy Grand Prix",
    circuit: "Autodromo Nazionale Monza",
    countryCode: "IT",
    round: 8,
    scheduledAt: "2026-08-03T20:00:00+02:00",
    sessions: [
      RaceSession.Practice,
      RaceSession.Qualifying,
      RaceSession.Race,
    ],
    completed: false,
  },
  {
    id: 3,
    seasonId: 1,
    name: "British Grand Prix",
    circuit: "Silverstone Circuit",
    countryCode: "GB",
    round: 6,
    scheduledAt: "2026-07-20T20:00:00+02:00",
    sessions: [
      RaceSession.Practice,
      RaceSession.Qualifying,
      RaceSession.Race,
    ],
    completed: true,
  },
]);
