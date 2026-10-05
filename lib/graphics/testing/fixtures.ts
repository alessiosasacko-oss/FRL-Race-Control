// Synthetic fixtures for local verification only. Never imported by production routes.
import { QualifyingFormat, ResultGapMode, ResultPublicationStatus, ResultSession, ResultStatus } from "@/domain/enums";
import type { RaceResultsView, ResultRowView, ResultSessionView } from "@/lib/championship/types";
import type { ResultGraphicRenderData } from "../templates/types";

export function resultFixture(position: number): ResultRowView {
  return {
    id: position, driverId: position, representedTeamId: 1, expectedDriverId: null,
    position, finalPosition: position, startingPosition: 4 - position,
    baseStatus: ResultStatus.Finished, status: ResultStatus.Finished,
    gapToWinnerMs: (position - 1) * 1000, gapToPreviousMs: position === 1 ? 0 : 1000,
    lapsBehind: 0, totalTimeMs: 3600000 + position * 1000, adjustedTimeMs: 3600000 + position * 1000,
    fastestLapMs: 78000 + position * 100, qualifyingTimeMs: 77000 + position * 100,
    qualifyingLaps: 4, q1TimeMs: 79000 + position * 100, q2TimeMs: 78000 + position * 100,
    q3TimeMs: 77000 + position * 100, q1Laps: 3, q2Laps: 3, q3Laps: 3,
    tireCompound: null, fastestLap: position === 1, polePosition: position === 1,
    lapsCompleted: 57, classifiedPercentage: 100, penaltySeconds: 0, effectivePenaltyMs: 0,
    notes: null, substitute: false, racePoints: 25 - position, bonusPoints: 0, teamPoints: 25 - position,
    driver: { id: position, name: `Test Driver ${position}`, number: position * 11, flag: "DE", imageUrl: null },
    representedTeam: { id: 1, name: "Test Racing", shortName: "TEST", color: "#FF278B", logoUrl: null },
    expectedDriver: null, penaltyApplications: [],
  };
}
export function sessionFixture(): ResultSessionView {
  return { id: 1, session: ResultSession.Race, gapMode: ResultGapMode.ToLeader, publicationStatus: ResultPublicationStatus.Published,
    qualifyingFormat: QualifyingFormat.Full, revision: 1, lockedAt: null, publishedAt: "2026-10-05T12:00:00Z", updatedAt: "2026-10-05T12:00:00Z", draftPayload: null,
    results: [resultFixture(3), resultFixture(1), resultFixture(2)] };
}
export function raceFixture(): RaceResultsView {
  return { race: { id: 1, name: "Test Grand Prix", circuit: "Test Circuit", countryCode: "DE", round: 6, leagueScheduleId: 1, scheduledAt: "2026-10-05T12:00:00Z", timezone: "Europe/Berlin", sprint: false, doublePoints: false, mystery: false, revealMystery: true, status: "COMPLETED", season: { id: 1, name: "Test Season", archived: false, league: { id: 1, name: "Test League", code: "TEST" } } }, sessions: [sessionFixture()] };
}
export function graphicFixture(count = 22): ResultGraphicRenderData {
  const names = ["Alex Morgan", "Jamie Rivera", "Taylor Schmidt"];
  const highlights = [1, 2, 3].map((position) => ({ name: names[position - 1], position, number: position * 11,
    teamName: position === 2 ? "Apex Racing" : "Velocity Motorsport", teamColor: position === 2 ? "#38E8E1" : "#FF278B",
    teamLogoDataUrl: null, imageDataUrl: null, primary: position === 1 ? "1:24.381" : `+${position}.120` }));
  return { title: "RACE CLASSIFICATION", subtitle: "TEST DATA · LOCAL DESIGN REVIEW", leagueCode: "TEST", seasonName: "Design Preview", raceName: "TEST DATA — NOT OFFICIAL RESULTS", round: 6, circuit: "Circuit preview", frlLogoDataUrl: null, leaderLabel: "WINNER", leader: highlights[0], highlights,
    rows: Array.from({ length: count }, (_, index) => ({ ...highlights[index % 3], name: index < 3 ? names[index] : `Test Driver ${index + 1}`, position: index + 1, primary: index === 0 ? "1:32:24.381" : `+${index}.120`, secondary: `${Math.max(0, 25 - index)} PTS`, status: index === count - 1 ? "DSQ" : "FINISHED" })) };
}
