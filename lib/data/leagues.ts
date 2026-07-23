import { leagueSchema } from "@/domain";

export const leagues = leagueSchema.array().parse([
  {
    id: 1,
    name: "Formula 1",
    code: "F1",
    description: "Höchste Liga der F1 Realistic League.",
    currentSeasonId: 1,
    active: true,
  },
  {
    id: 2,
    name: "Formula 2",
    code: "F2",
    description: "Zweite Liga der F1 Realistic League.",
    currentSeasonId: null,
    active: true,
  },
  {
    id: 3,
    name: "Formula 3",
    code: "F3",
    description: "Dritte Liga der F1 Realistic League.",
    currentSeasonId: null,
    active: true,
  },
  {
    id: 4,
    name: "Formula 4",
    code: "F4",
    description: "Vierte Liga der F1 Realistic League.",
    currentSeasonId: null,
    active: true,
  },
  {
    id: 5,
    name: "Formula 5",
    code: "F5",
    description: "Fünfte Liga der F1 Realistic League.",
    currentSeasonId: null,
    active: true,
  },
  {
    id: 6,
    name: "Formula 6",
    code: "F6",
    description: "Sechste Liga der F1 Realistic League.",
    currentSeasonId: null,
    active: true,
  },
]);
