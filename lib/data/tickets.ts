import {
  fiaTicketSchema,
  RaceSession,
  TicketPriority,
  TicketStatus,
  type FiaTicketWithRelations,
} from "@/domain";
import { drivers } from "./drivers";
import { races } from "./races";
import { teams } from "./teams";

export const fiaTickets = fiaTicketSchema.array().parse([
  {
    id: 24,
    title: "Kollision in Turn 1",
    description:
      "Kontakt beim Anbremsen von Turn 1. Beide Fahrer melden den Vorfall der FIA.",
    leagueId: 1,
    seasonId: 1,
    raceId: 2,
    session: RaceSession.Race,
    lap: 24,
    corner: "Turn 1",
    status: TicketStatus.InReview,
    priority: TicketPriority.High,
    reportedByUserId: null,
    involvedDriverIds: [1, 2],
    assignedStewardIds: [],
    evidence: [],
    decision: null,
    createdAt: "2026-07-23T14:22:00+02:00",
    updatedAt: "2026-07-23T14:35:00+02:00",
  },
  {
    id: 23,
    title: "Track Limits",
    description: "Mehrfaches Verlassen der Strecke.",
    leagueId: 1,
    seasonId: 1,
    raceId: 3,
    session: RaceSession.Race,
    lap: 18,
    corner: "Turn 9",
    status: TicketStatus.Open,
    priority: TicketPriority.Normal,
    reportedByUserId: null,
    involvedDriverIds: [3],
    assignedStewardIds: [],
    evidence: [],
    decision: null,
    createdAt: "2026-07-23T13:50:00+02:00",
    updatedAt: "2026-07-23T13:50:00+02:00",
  },
  {
    id: 22,
    title: "Unsafe Release",
    description: "Unsicheres Herausfahren aus der Boxengasse.",
    leagueId: 1,
    seasonId: 1,
    raceId: 1,
    session: RaceSession.Race,
    lap: 12,
    corner: "Pit Exit",
    status: TicketStatus.Resolved,
    priority: TicketPriority.Low,
    reportedByUserId: null,
    involvedDriverIds: [4],
    assignedStewardIds: [],
    evidence: [],
    decision: null,
    createdAt: "2026-07-22T19:10:00+02:00",
    updatedAt: "2026-07-22T20:05:00+02:00",
  },
]);

function findRequiredById<T extends { id: number }>(
  records: T[],
  id: number,
  entityName: string,
): T {
  const record = records.find((item) => item.id === id);

  if (!record) {
    throw new Error(`${entityName} ${id} is missing from fixture data.`);
  }

  return record;
}

export const tickets: FiaTicketWithRelations[] = fiaTickets.map((ticket) => ({
  ...ticket,
  race: findRequiredById(races, ticket.raceId, "Race"),
  drivers: ticket.involvedDriverIds.map((driverId) => {
    const driver = findRequiredById(drivers, driverId, "Driver");

    if (driver.teamId === null) {
      throw new Error(`Driver ${driver.id} has no team assigned.`);
    }

    return {
      ...driver,
      team: findRequiredById(teams, driver.teamId, "Team"),
    };
  }),
}));
