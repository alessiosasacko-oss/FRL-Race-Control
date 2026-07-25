import "server-only";
import {
  ChampionshipAuditAction as PrismaAuditAction,
  PenaltyType as PrismaPenaltyType,
  type Prisma,
  type PrismaClient,
  ResultSession as PrismaResultSession,
} from "@/generated/prisma/client";
import {
  ChampionshipAdjustmentTarget,
  DiscordChannelPurpose,
  NotificationType,
  ResultSession,
  ResultStatus,
  WebhookEventType,
} from "@/domain";
import { enqueueDiscordDelivery } from "@/lib/discord/outbox";
import { recordWebhookEvent } from "@/lib/integrations/events";
import {
  calculateResultPoints,
  defaultPositionRows,
  scoringPositionKey,
} from "./scoring";
import {
  createNotifications,
  leagueUserIds,
} from "@/lib/notifications/service";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

type StandingAccumulator = {
  id: number;
  racePoints: number;
  sprintPoints: number;
  bonusPoints: number;
  adjustments: number;
  penaltyPoints: number;
  wins: number;
  podiums: number;
  polePositions: number;
  fastestLaps: number;
  starts: number;
  dnfs: number;
  dsqs: number;
  bestResult: number | null;
  substituteStarts: number;
  finishCounts: Map<number, number>;
  recentResults: number[];
};

function accumulator(id: number): StandingAccumulator {
  return {
    id,
    racePoints: 0,
    sprintPoints: 0,
    bonusPoints: 0,
    adjustments: 0,
    penaltyPoints: 0,
    wins: 0,
    podiums: 0,
    polePositions: 0,
    fastestLaps: 0,
    starts: 0,
    dnfs: 0,
    dsqs: 0,
    bestResult: null,
    substituteStarts: 0,
    finishCounts: new Map(),
    recentResults: [],
  };
}

function totalPoints(item: StandingAccumulator): number {
  return (
    item.racePoints +
    item.sprintPoints +
    item.bonusPoints +
    item.adjustments -
    item.penaltyPoints
  );
}

function compareStandings(
  left: StandingAccumulator,
  right: StandingAccumulator,
  maximumPosition: number,
): number {
  const byPoints = totalPoints(right) - totalPoints(left);
  if (byPoints !== 0) return byPoints;
  if (right.wins !== left.wins) return right.wins - left.wins;

  for (let position = 2; position <= maximumPosition; position += 1) {
    const difference =
      (right.finishCounts.get(position) ?? 0) -
      (left.finishCounts.get(position) ?? 0);
    if (difference !== 0) return difference;
  }

  const recentCount = Math.max(
    left.recentResults.length,
    right.recentResults.length,
  );
  for (let index = 1; index <= recentCount; index += 1) {
    const leftResult =
      left.recentResults.at(-index) ?? Number.MAX_SAFE_INTEGER;
    const rightResult =
      right.recentResults.at(-index) ?? Number.MAX_SAFE_INTEGER;
    if (leftResult !== rightResult) return leftResult - rightResult;
  }

  return left.id - right.id;
}

function resultStatus(value: string): ResultStatus {
  return value as ResultStatus;
}

function resultSession(value: string): ResultSession {
  return value as ResultSession;
}

export async function ensureScoringConfiguration(
  database: DatabaseClient,
  seasonId: number,
) {
  const existing = await database.scoringConfiguration.findUnique({
    where: { seasonId },
    include: { positions: true },
  });

  if (existing) return existing;

  return database.scoringConfiguration.create({
    data: {
      seasonId,
      fastestLapPoint: 1,
      fastestLapRequiresTopPosition: 10,
      polePositionPoint: 0,
      dnfScoresPoints: false,
      retiredScoresPoints: false,
      minimumClassifiedPercentage: 90,
      teamPointsEnabled: true,
      substituteDriverPointsEnabled: true,
      deductPenaltyPoints: false,
      positions: {
        create: defaultPositionRows().map((position) => ({
          session: position.session as PrismaResultSession,
          position: position.position,
          points: position.points,
        })),
      },
    },
    include: { positions: true },
  });
}

export async function recalculateChampionship(
  database: DatabaseClient,
  seasonId: number,
  actorId: number | null,
): Promise<void> {
  const scoring = await ensureScoringConfiguration(database, seasonId);
  const season = await database.season.findUnique({
    where: { id: seasonId },
    include: {
      championship: { select: { id: true, updatedAt: true } },
      league: {
        include: {
          drivers: {
            where: {
              active: true,
              team: { seasonId },
            },
            select: { id: true },
          },
        },
      },
      teams: { select: { id: true } },
      races: {
        orderBy: { round: "asc" },
        include: {
          resultSessions: {
            include: {
              results: {
                orderBy: [{ position: "asc" }, { id: "asc" }],
              },
            },
          },
        },
      },
      championshipAdjustments: true,
      tickets: {
        where: {
          decision: {
            is: { penaltyType: PrismaPenaltyType.POINTS_DEDUCTION },
          },
        },
        include: {
          decision: true,
          drivers: { select: { driverId: true } },
        },
      },
    },
  });

  if (!season) throw new Error("SEASON_NOT_FOUND");

  const championship =
    season.championship ??
    (await database.championship.create({
      data: {
        seasonId,
        name: `${season.name} Championship`,
      },
      select: { id: true, updatedAt: true },
    }));
  const positionPoints = new Map(
    scoring.positions.map((position) => [
      scoringPositionKey(
        resultSession(position.session),
        position.position,
      ),
      position.points,
    ]),
  );
  const drivers = new Map<number, StandingAccumulator>(
    season.league.drivers.map((driver) => [
      driver.id,
      accumulator(driver.id),
    ]),
  );
  const teams = new Map<number, StandingAccumulator>(
    season.teams.map((team) => [team.id, accumulator(team.id)]),
  );
  let maximumPosition = 1;

  for (const race of season.races) {
    for (const resultSessionRow of race.resultSessions) {
      const session = resultSession(resultSessionRow.session);
      const teamRecentResults = new Map<number, number>();
      const sessionDistance = Math.max(
        0,
        ...resultSessionRow.results.map(
          (result) => result.lapsCompleted,
        ),
      );

      for (const result of resultSessionRow.results) {
        const driver =
          drivers.get(result.driverId) ?? accumulator(result.driverId);
        const team =
          teams.get(result.representedTeamId) ??
          accumulator(result.representedTeamId);
        drivers.set(result.driverId, driver);
        teams.set(result.representedTeamId, team);

        const points = calculateResultPoints(
          {
            position: result.position,
            status: resultStatus(result.status),
            fastestLap: result.fastestLap,
            polePosition: result.polePosition,
            classifiedPercentage:
              sessionDistance > 0
                ? (result.lapsCompleted / sessionDistance) * 100
                : null,
            substitute: result.substitute,
          },
          session,
          scoring,
          positionPoints,
          race.doublePoints,
        );

        await database.raceResult.update({
          where: { id: result.id },
          data: {
            racePoints: points.driverBase,
            bonusPoints: points.driverBonus,
            teamPoints: points.teamBase + points.teamBonus,
            classifiedPercentage:
              sessionDistance > 0
                ? (result.lapsCompleted / sessionDistance) * 100
                : null,
          },
        });

        if (session === ResultSession.Race) {
          driver.racePoints += points.driverBase;
          team.racePoints += points.teamBase;
        } else {
          driver.sprintPoints += points.driverBase;
          team.sprintPoints += points.teamBase;
        }
        driver.bonusPoints += points.driverBonus;
        team.bonusPoints += points.teamBonus;

        if (result.status !== ResultStatus.Dns) {
          driver.starts += 1;
        }
        if (
          result.status === ResultStatus.Dnf ||
          result.status === ResultStatus.Retired
        ) {
          driver.dnfs += 1;
        }
        if (result.status === ResultStatus.Dsq) driver.dsqs += 1;
        if (result.fastestLap) {
          driver.fastestLaps += 1;
          team.fastestLaps += 1;
        }
        if (result.polePosition) {
          driver.polePositions += 1;
          team.polePositions += 1;
        }
        if (result.substitute) driver.substituteStarts += 1;

        if (
          session === ResultSession.Race &&
          result.position !== null &&
          result.status !== ResultStatus.Dsq &&
          result.status !== ResultStatus.Dns
        ) {
          maximumPosition = Math.max(maximumPosition, result.position);
          driver.finishCounts.set(
            result.position,
            (driver.finishCounts.get(result.position) ?? 0) + 1,
          );
          team.finishCounts.set(
            result.position,
            (team.finishCounts.get(result.position) ?? 0) + 1,
          );
          driver.recentResults.push(result.position);
          teamRecentResults.set(
            team.id,
            Math.min(
              teamRecentResults.get(team.id) ??
                Number.MAX_SAFE_INTEGER,
              result.position,
            ),
          );
          driver.bestResult =
            driver.bestResult === null
              ? result.position
              : Math.min(driver.bestResult, result.position);
          if (result.position === 1) {
            driver.wins += 1;
            team.wins += 1;
          }
          if (result.position <= 3) {
            driver.podiums += 1;
            team.podiums += 1;
          }
        }
      }

      if (session === ResultSession.Race) {
        for (const [teamId, position] of teamRecentResults) {
          teams.get(teamId)?.recentResults.push(position);
        }
      }
    }
  }

  for (const adjustment of season.championshipAdjustments) {
    if (
      adjustment.target === ChampionshipAdjustmentTarget.Driver &&
      adjustment.driverId
    ) {
      const driver =
        drivers.get(adjustment.driverId) ??
        accumulator(adjustment.driverId);
      driver.adjustments += adjustment.points;
      drivers.set(adjustment.driverId, driver);
    }
    if (
      adjustment.target === ChampionshipAdjustmentTarget.Team &&
      adjustment.teamId
    ) {
      const team =
        teams.get(adjustment.teamId) ?? accumulator(adjustment.teamId);
      team.adjustments += adjustment.points;
      teams.set(adjustment.teamId, team);
    }
  }

  if (scoring.deductPenaltyPoints) {
    for (const ticket of season.tickets) {
      const deduction = Math.max(0, ticket.decision?.penaltyValue ?? 0);
      for (const link of ticket.drivers) {
        const driver =
          drivers.get(link.driverId) ?? accumulator(link.driverId);
        driver.penaltyPoints += deduction;
        drivers.set(link.driverId, driver);
      }
    }
  }

  const driverRows = [...drivers.values()].sort((left, right) =>
    compareStandings(left, right, maximumPosition),
  );
  const teamRows = [...teams.values()].sort((left, right) =>
    compareStandings(left, right, maximumPosition),
  );

  await database.driverStanding.deleteMany({
    where: { championshipId: championship.id },
  });
  await database.teamStanding.deleteMany({
    where: { championshipId: championship.id },
  });

  if (driverRows.length > 0) {
    await database.driverStanding.createMany({
      data: driverRows.map((driver, index) => ({
        championshipId: championship.id,
        driverId: driver.id,
        position: index + 1,
        points: totalPoints(driver),
        racePoints: driver.racePoints,
        sprintPoints: driver.sprintPoints,
        bonusPoints: driver.bonusPoints,
        adjustments: driver.adjustments,
        wins: driver.wins,
        podiums: driver.podiums,
        polePositions: driver.polePositions,
        fastestLaps: driver.fastestLaps,
        starts: driver.starts,
        dnfs: driver.dnfs,
        dsqs: driver.dsqs,
        bestResult: driver.bestResult,
        substituteStarts: driver.substituteStarts,
        penaltyPoints: driver.penaltyPoints,
        tieBreak: {
          finishCounts: Object.fromEntries(driver.finishCounts),
          recentResults: driver.recentResults,
        },
      })),
    });
  }

  if (teamRows.length > 0) {
    await database.teamStanding.createMany({
      data: teamRows.map((team, index) => ({
        championshipId: championship.id,
        teamId: team.id,
        position: index + 1,
        points: totalPoints(team),
        racePoints: team.racePoints,
        sprintPoints: team.sprintPoints,
        bonusPoints: team.bonusPoints,
        adjustments: team.adjustments,
        wins: team.wins,
        podiums: team.podiums,
        polePositions: team.polePositions,
        fastestLaps: team.fastestLaps,
        tieBreak: {
          finishCounts: Object.fromEntries(team.finishCounts),
          recentResults: team.recentResults,
        },
      })),
    });
  }

  await database.championshipAudit.create({
    data: {
      seasonId,
      actorId,
      action: PrismaAuditAction.CHAMPIONSHIP_RECALCULATED,
      entityType: "Championship",
      entityId: championship.id,
      newState: {
        driverCount: driverRows.length,
        teamCount: teamRows.length,
      },
    },
  });

  const recipients = await leagueUserIds(database, season.leagueId);
  await createNotifications(database, recipients, {
    type: NotificationType.ChampionshipUpdated,
    title: `${season.name}: Meisterschaft aktualisiert`,
    message:
      "Die Fahrer- und Teamwertung wurde anhand der aktuellen Ergebnisse neu berechnet.",
    href: `/championship?leagueId=${season.leagueId}&seasonId=${season.id}`,
    relatedEntity: { type: "Season", id: season.id },
    dedupeKey: `championship-updated:${season.id}:${championship.updatedAt?.getTime?.() ?? Date.now()}`,
  });

  const [driverTop, teamTop] = await Promise.all([
    database.driverStanding.findMany({
      where: { championshipId: championship.id },
      orderBy: { position: "asc" },
      take: 5,
      include: { driver: { select: { name: true } } },
    }),
    database.teamStanding.findMany({
      where: { championshipId: championship.id },
      orderBy: { position: "asc" },
      take: 5,
      include: { team: { select: { name: true } } },
    }),
  ]);
  const href = `/championship?leagueId=${season.leagueId}&seasonId=${season.id}`;
  await enqueueDiscordDelivery(database, {
    purpose: DiscordChannelPurpose.DriverStandings,
    leagueId: season.leagueId,
    payload: {
      title: `${season.name}: Fahrerwertung`,
      description: "Aktueller Stand nach der Neuberechnung.",
      href,
      league: season.league.name,
      season: season.name,
      fields: driverTop.map((standing) => ({
        name: `${standing.position}. ${standing.driver.name}`,
        value: `${standing.points} Punkte`,
        inline: false,
      })),
    },
    dedupeKey: `driver-standings:${season.id}:${championship.updatedAt.getTime()}`,
  });
  await enqueueDiscordDelivery(database, {
    purpose: DiscordChannelPurpose.TeamStandings,
    leagueId: season.leagueId,
    payload: {
      title: `${season.name}: Teamwertung`,
      description: "Aktueller Stand nach der Neuberechnung.",
      href,
      league: season.league.name,
      season: season.name,
      fields: teamTop.map((standing) => ({
        name: `${standing.position}. ${standing.team.name}`,
        value: `${standing.points} Punkte`,
        inline: false,
      })),
    },
    dedupeKey: `team-standings:${season.id}:${championship.updatedAt.getTime()}`,
  });
  await recordWebhookEvent(database, {
    type: WebhookEventType.ChampionshipRecalculated,
    source: "championship-recalculation",
    dedupeKey: `championship-recalculated:${season.id}:${championship.updatedAt.getTime()}`,
    payload: {
      championshipId: championship.id,
      seasonId: season.id,
      leagueId: season.leagueId,
      driverCount: driverRows.length,
      teamCount: teamRows.length,
    },
  });
}
