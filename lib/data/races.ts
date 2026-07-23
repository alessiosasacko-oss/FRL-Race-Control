export type Race = {
  id: number;
  name: string;
  league: string;
  season: string;
  date: string;
};

export const races: Race[] = [
  {
    id: 1,
    name: "Belgium Grand Prix",
    league: "F1",
    season: "Season 6",
    date: "2026-07-27",
  },
  {
    id: 2,
    name: "Italy Grand Prix",
    league: "F1",
    season: "Season 6",
    date: "2026-08-03",
  },
];