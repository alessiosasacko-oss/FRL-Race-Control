export type Driver = {
  id: number;
  name: string;
  number: number;
  flag: string;
  teamId: number;
  league: string;
};

export const drivers: Driver[] = [
  {
    id: 1,
    name: "Max Müller",
    number: 23,
    flag: "🇩🇪",
    teamId: 1,
    league: "F1",
  },
  {
    id: 2,
    name: "Luca Rossi",
    number: 44,
    flag: "🇮🇹",
    teamId: 2,
    league: "F1",
  },
];