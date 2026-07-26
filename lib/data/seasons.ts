import { seasonSchema } from "@/domain";

export const seasons = seasonSchema.array().parse([
  {
    id: 1,
    leagueId: 1,
    participatingLeagueIds: [1, 2, 3, 4, 5, 6],
    name: "Season 7",
    startsOn: "2026-01-01",
    endsOn: "2026-12-31",
    active: true,
    archivedAt: null,
  },
]);
