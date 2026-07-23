import { seasonSchema } from "@/domain";

export const seasons = seasonSchema.array().parse([
  {
    id: 1,
    leagueId: 1,
    name: "Season 7",
    startsOn: "2026-01-01",
    endsOn: "2026-12-31",
    active: true,
  },
]);
