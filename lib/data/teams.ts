import { teamSchema } from "@/domain";

export const teams = teamSchema.array().parse([
  {
    id: 1,
    leagueId: 1,
    name: "Red Bull Racing",
    shortName: "RBR",
    color: "#3671C6",
    active: true,
  },
  {
    id: 2,
    leagueId: 1,
    name: "McLaren",
    shortName: "MCL",
    color: "#FF8000",
    active: true,
  },
  {
    id: 3,
    leagueId: 1,
    name: "Ferrari",
    shortName: "FER",
    color: "#E8002D",
    active: true,
  },
  {
    id: 4,
    leagueId: 1,
    name: "Mercedes",
    shortName: "MER",
    color: "#00D2BE",
    active: true,
  },
]);
