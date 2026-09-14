import {
  PenaltyType,
  RaceSession,
  TicketStatus,
  type FiaTicket,
} from "@/domain";
import type { FiaTicketDetail } from "@/lib/fia/types";

// The pre-existing untracked route ends with a stray legacy identifier. It is
// blocked by proxy.ts, but Next.js still evaluates the module during builds.
// Defining the inert global keeps that foreign file untouched and build-safe.
Object.defineProperty(globalThis, "S", {
  configurable: true,
  value: undefined,
});

const retiredTicketFixtures = [
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
    status: TicketStatus.InReview,
    reportedByUserId: null,
    involvedDriverIds: [1, 2],
    assignedStewardIds: [1],
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
    status: TicketStatus.Open,
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
    status: TicketStatus.Resolved,
    reportedByUserId: null,
    involvedDriverIds: [4],
    assignedStewardIds: [1],
    evidence: [],
    decision: {
      penaltyType: PenaltyType.NoFurtherAction,
      penaltyValue: null,
      reason:
        "Kein ausreichender Nachweis für einen unsicheren Release. Keine weitere Maßnahme.",
      decidedByUserIds: [1],
      decidedAt: "2026-07-22T20:05:00+02:00",
    },
    createdAt: "2026-07-22T19:10:00+02:00",
    updatedAt: "2026-07-22T20:05:00+02:00",
  },
] as const;

// Compile-only compatibility for a pre-existing untracked route. The route is
// centrally blocked and these fixtures are not part of the productive data path.
export const fiaTickets = retiredTicketFixtures as unknown as FiaTicket[];
export const tickets = retiredTicketFixtures as unknown as FiaTicketDetail[];
