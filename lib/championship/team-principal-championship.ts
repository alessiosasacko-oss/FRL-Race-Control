import "server-only";

import {
  ChampionshipAuditAction,
  GlobalWeekendStatus,
  PenaltyType,
  type Prisma,
  type PrismaClient,
  RaceSession,
  ResultPublicationStatus,
  ResultSession,
} from "@/generated/prisma/client";
import {
  NotificationPriority,
  NotificationType,
  ResultSession as DomainResultSession,
} from "@/domain";
import { getPrismaClient } from "@/lib/db/prisma";
import { createNotifications } from "@/lib/notifications/service";
import {
  aggregateGlobalContributions,
  globalWeekendBlockReason,
  rankGlobalStandings,
  type GlobalWeekendBlockReason,
} from "./team-principal-policy";

type DatabaseClient = PrismaClient | Prisma.TransactionClient;

const blockReasonLabels: Record<GlobalWeekendBlockReason, string> = {
  NO_ACTIVE_LEAGUES: "Keine aktiven Liga-Zeitpläne vorhanden.",
  RESULTS_INCOMPLETE:
    "Noch nicht alle Ergebnisse der aktiven Ligen und Sessions sind veröffentlicht.",
  FIA_TICKETS_OPEN: "Noch nicht alle FIA-Tickets sind abgeschlossen.",
  FIA_PENALTIES_NOT_APPLIED:
    "Mindestens eine FIA-Strafe ist noch nicht im Ergebnis angewendet.",
  TEAM_ORGANIZATION_MISSING:
    "Mindestens ein Ergebnis-Team besitzt keine globale Organisation.",
};

function requiredResultSessions(
  sessions: readonly RaceSession[],
): ResultSession[] {
  const required = sessions.flatMap((session) => {
    if (session === RaceSession.QUALIFYING) {
      return [ResultSession.QUALIFYING];
    }
    if (session === RaceSession.SPRINT) return [ResultSession.SPRINT];
    if (session === RaceSession.RACE) return [ResultSession.RACE];
    return [];
  });
  return required.length > 0
    ? [...new Set(required)]
    : [ResultSession.RACE];
}

function hasResultImpact(
  penaltyType: PenaltyType,
): boolean {
  return (
    penaltyType === PenaltyType.TIME_PENALTY ||
    penaltyType === PenaltyType.DISQUALIFICATION
  );
}

function normalizedContributionKey(input: {
  organizationId: number;
  leagueId: number;
  racePoints: number;
  sprintPoints: number;
  points: number;
}): string {
  return [
    input.organizationId,
    input.leagueId,
    input.racePoints,
    input.sprintPoints,
    input.points,
  ].join(":");
}

export async function rebuildGlobalTeamPrincipalStandings(
  database: DatabaseClient,
  seasonId: number,
  actorId?: number,
): Promise<void> {
  const contributions = await database.globalTeamContribution.findMany({
    where: {
      race: {
        seasonId,
        globalWeekend: { is: { status: GlobalWeekendStatus.FINALIZED } },
      },
    },
    select: {
      raceId: true,
      leagueId: true,
      organizationId: true,
      racePoints: true,
      sprintPoints: true,
      points: true,
      organization: { select: { name: true } },
    },
  });
  const byOrganization = new Map<
    number,
    {
      organizationId: number;
      organizationName: string;
      racePoints: number;
      sprintPoints: number;
      points: number;
      leagueIds: Set<number>;
      raceIds: Set<number>;
    }
  >();
  for (const contribution of contributions) {
    const standing = byOrganization.get(contribution.organizationId) ?? {
      organizationId: contribution.organizationId,
      organizationName: contribution.organization.name,
      racePoints: 0,
      sprintPoints: 0,
      points: 0,
      leagueIds: new Set<number>(),
      raceIds: new Set<number>(),
    };
    standing.racePoints += contribution.racePoints;
    standing.sprintPoints += contribution.sprintPoints;
    standing.points += contribution.points;
    standing.leagueIds.add(contribution.leagueId);
    standing.raceIds.add(contribution.raceId);
    byOrganization.set(contribution.organizationId, standing);
  }
  const ranked = rankGlobalStandings([...byOrganization.values()]);

  await database.globalTeamStanding.deleteMany({ where: { seasonId } });
  if (ranked.length > 0) {
    await database.globalTeamStanding.createMany({
      data: ranked.map((standing) => ({
        seasonId,
        organizationId: standing.organizationId,
        position: standing.position,
        points: standing.points,
        racePoints: standing.racePoints,
        sprintPoints: standing.sprintPoints,
        leagueCount: standing.leagueIds.size,
        finalizedWeekendCount: standing.raceIds.size,
      })),
    });
  }
  await database.championshipAudit.create({
    data: {
      seasonId,
      actorId,
      action: ChampionshipAuditAction.GLOBAL_STANDINGS_REBUILT,
      entityType: "GlobalTeamStanding",
      entityId: seasonId,
      newState: {
        organizationCount: ranked.length,
        contributionCount: contributions.length,
      },
    },
  });
}

export async function synchronizeGlobalTeamPrincipalChampionship(
  database: DatabaseClient,
  raceId: number,
  actorId?: number,
): Promise<GlobalWeekendStatus> {
  const race = await database.race.findUnique({
    where: { id: raceId },
    select: {
      id: true,
      seasonId: true,
      sessions: true,
      leagueSchedules: {
        where: { league: { active: true } },
        select: { leagueId: true },
      },
      resultSessions: {
        select: {
          leagueId: true,
          session: true,
          publicationStatus: true,
          results: {
            select: {
              driverId: true,
              teamPoints: true,
              representedTeamId: true,
              representedTeam: { select: { organizationId: true } },
            },
          },
        },
      },
      tickets: {
        select: {
          id: true,
          leagueId: true,
          session: true,
          status: true,
          drivers: { select: { driverId: true } },
          decision: {
            select: {
              id: true,
              affectedDriverId: true,
              penaltyType: true,
              penalties: { select: { penaltyType: true } },
              resultPenaltyApplications: {
                where: { active: true },
                select: {
                  result: {
                    select: {
                      driverId: true,
                      resultSession: {
                        select: {
                          raceId: true,
                          leagueId: true,
                          session: true,
                        },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      globalWeekend: {
        select: {
          id: true,
          status: true,
          reason: true,
          version: true,
        },
      },
      globalTeamContributions: {
        select: {
          organizationId: true,
          leagueId: true,
          racePoints: true,
          sprintPoints: true,
          points: true,
        },
      },
    },
  });
  if (!race) throw new Error("RACE_NOT_FOUND");

  const activeLeagueIds = [
    ...new Set(race.leagueSchedules.map(({ leagueId }) => leagueId)),
  ];
  const requiredSessions = requiredResultSessions(race.sessions);
  const publishedSessionKeys = new Set(
    race.resultSessions
      .filter(
        ({ publicationStatus }) =>
          publicationStatus === ResultPublicationStatus.PUBLISHED,
      )
      .map(({ leagueId, session }) => `${leagueId}:${session}`),
  );
  const openTicketCount = race.tickets.filter(
    (ticket) => ticket.status !== "RESOLVED" || ticket.decision === null,
  ).length;
  let unappliedPenaltyCount = 0;
  for (const ticket of race.tickets) {
    if (!ticket.decision) continue;
    const penalties =
      ticket.decision.penalties.length > 0
        ? ticket.decision.penalties
        : [{ penaltyType: ticket.decision.penaltyType }];
    if (!penalties.some(({ penaltyType }) => hasResultImpact(penaltyType))) {
      continue;
    }
    const resultSession =
      ticket.session === RaceSession.QUALIFYING
        ? ResultSession.QUALIFYING
        : ticket.session === RaceSession.SPRINT
          ? ResultSession.SPRINT
          : ResultSession.RACE;
    const affectedDriverIds = ticket.decision.affectedDriverId
      ? [ticket.decision.affectedDriverId]
      : ticket.drivers.map(({ driverId }) => driverId);
    for (const driverId of affectedDriverIds) {
      const applied =
        ticket.decision.resultPenaltyApplications.some(
          ({ result }) =>
            result.driverId === driverId &&
            result.resultSession.raceId === race.id &&
            result.resultSession.leagueId === ticket.leagueId &&
            result.resultSession.session === resultSession,
        );
      if (!applied) unappliedPenaltyCount += 1;
    }
  }
  const publishedPointSessions = race.resultSessions.filter(
    (session) =>
      session.publicationStatus === ResultPublicationStatus.PUBLISHED &&
      (session.session === ResultSession.RACE ||
        session.session === ResultSession.SPRINT),
  );
  const unmappedTeamIds = [
    ...new Set(
      publishedPointSessions.flatMap((session) =>
        session.results.flatMap((result) =>
          result.representedTeam.organizationId === null
            ? [result.representedTeamId]
            : [],
        ),
      ),
    ),
  ];
  const blockReason = globalWeekendBlockReason({
    activeLeagueIds,
    requiredSessions: requiredSessions as DomainResultSession[],
    publishedSessionKeys,
    openTicketCount,
    unappliedPenaltyCount,
    unmappedTeamIds,
  });

  if (blockReason) {
    const nextStatus =
      race.globalWeekend?.status === GlobalWeekendStatus.FINALIZED
        ? GlobalWeekendStatus.INVALIDATED
        : race.globalWeekend?.status === GlobalWeekendStatus.INVALIDATED
          ? GlobalWeekendStatus.INVALIDATED
          : GlobalWeekendStatus.PENDING;
    const reason = blockReasonLabels[blockReason];
    if (
      race.globalWeekend?.status === nextStatus &&
      race.globalWeekend.reason === reason &&
      race.globalTeamContributions.length === 0
    ) {
      return nextStatus;
    }
    const weekend = await database.globalRaceWeekend.upsert({
      where: { raceId: race.id },
      update: {
        status: nextStatus,
        reason,
        invalidatedAt:
          nextStatus === GlobalWeekendStatus.INVALIDATED
            ? new Date()
            : null,
        finalizedAt: null,
        version: { increment: 1 },
      },
      create: {
        raceId: race.id,
        status: nextStatus,
        reason,
        invalidatedAt:
          nextStatus === GlobalWeekendStatus.INVALIDATED
            ? new Date()
            : null,
      },
      select: { id: true },
    });
    if (race.globalTeamContributions.length > 0) {
      await database.globalTeamContribution.deleteMany({
        where: { raceId: race.id },
      });
      await rebuildGlobalTeamPrincipalStandings(
        database,
        race.seasonId,
        actorId,
      );
    }
    if (
      race.globalWeekend?.status !== nextStatus ||
      race.globalWeekend?.reason !== reason
    ) {
      await database.championshipAudit.create({
        data: {
          seasonId: race.seasonId,
          raceId: race.id,
          actorId,
          action: ChampionshipAuditAction.GLOBAL_WEEKEND_INVALIDATED,
          entityType: "GlobalRaceWeekend",
          entityId: weekend.id,
          previousState: race.globalWeekend ?? undefined,
          newState: { status: nextStatus, reason },
        },
      });
    }
    return nextStatus;
  }

  const contributions = aggregateGlobalContributions(
    publishedPointSessions.flatMap((session) =>
      session.results.flatMap((result) =>
        result.representedTeam.organizationId === null
          ? []
          : [
              {
                organizationId: result.representedTeam.organizationId,
                leagueId: session.leagueId,
                session: session.session as DomainResultSession,
                points: result.teamPoints,
              },
            ],
      ),
    ),
  );
  const currentKeys = race.globalTeamContributions
    .map(normalizedContributionKey)
    .sort();
  const nextKeys = contributions.map(normalizedContributionKey).sort();
  const unchanged =
    race.globalWeekend?.status === GlobalWeekendStatus.FINALIZED &&
    JSON.stringify(currentKeys) === JSON.stringify(nextKeys);
  if (unchanged) return GlobalWeekendStatus.FINALIZED;

  const now = new Date();
  const weekend = await database.globalRaceWeekend.upsert({
    where: { raceId: race.id },
    update: {
      status: GlobalWeekendStatus.FINALIZED,
      reason: null,
      finalizedAt: now,
      invalidatedAt: null,
      version: { increment: 1 },
    },
    create: {
      raceId: race.id,
      status: GlobalWeekendStatus.FINALIZED,
      finalizedAt: now,
    },
    select: { id: true },
  });
  await database.globalTeamContribution.deleteMany({
    where: { raceId: race.id },
  });
  if (contributions.length > 0) {
    await database.globalTeamContribution.createMany({
      data: contributions.map((contribution) => ({
        raceId: race.id,
        ...contribution,
      })),
    });
  }
  await rebuildGlobalTeamPrincipalStandings(
    database,
    race.seasonId,
    actorId,
  );
  await database.championshipAudit.create({
    data: {
      seasonId: race.seasonId,
      raceId: race.id,
      actorId,
      action: ChampionshipAuditAction.GLOBAL_WEEKEND_FINALIZED,
      entityType: "GlobalRaceWeekend",
      entityId: weekend.id,
      previousState: race.globalWeekend ?? undefined,
      newState: {
        status: GlobalWeekendStatus.FINALIZED,
        contributionCount: contributions.length,
      },
    },
  });
  const principalAssignments =
    await database.teamOrganizationSeason.findMany({
      where: {
        seasonId: race.seasonId,
        organizationId: {
          in: [
            ...new Set(
              contributions.map(
                ({ organizationId }) => organizationId,
              ),
            ),
          ],
        },
        principalUserId: { not: null },
      },
      select: { principalUserId: true },
    });
  await createNotifications(
    database,
    principalAssignments.flatMap(({ principalUserId }) =>
      principalUserId === null ? [] : [principalUserId],
    ),
    {
      type: NotificationType.ChampionshipUpdated,
      priority: NotificationPriority.Normal,
      title: `Teamchef-WM: Runde finalisiert`,
      message:
        "Alle Liga-Ergebnisse und FIA-Entscheidungen sind verarbeitet.",
      href: `/championship/team-principals?seasonId=${race.seasonId}`,
      relatedEntity: { type: "Race", id: race.id },
      dedupeKey: `team-principal-weekend:${race.id}:${
        (race.globalWeekend?.version ?? 0) + 1
      }`,
    },
    { allowDiscord: false },
  );
  return GlobalWeekendStatus.FINALIZED;
}

export async function getTeamPrincipalChampionshipData(
  seasonId?: number,
) {
  const database = getPrismaClient();
  const seasons = await database.season.findMany({
    orderBy: [{ active: "desc" }, { startsOn: "desc" }],
    select: {
      id: true,
      name: true,
      active: true,
      archivedAt: true,
    },
  });
  const selectedSeason =
    seasons.find((season) => season.id === seasonId) ??
    seasons.find((season) => season.active && !season.archivedAt) ??
    seasons[0] ??
    null;
  if (!selectedSeason) {
    return {
      seasons,
      selectedSeason: null,
      standings: [],
      weekends: [],
      updatedAt: null,
    };
  }
  const [standings, weekends] = await database.$transaction([
    database.globalTeamStanding.findMany({
      where: { seasonId: selectedSeason.id },
      orderBy: { position: "asc" },
      include: {
        organization: {
          include: {
            seasons: {
              where: { seasonId: selectedSeason.id },
              select: {
                principal: {
                  select: {
                    id: true,
                    displayName: true,
                    avatarUrl: true,
                  },
                },
              },
            },
            teams: {
              where: { seasonId: selectedSeason.id },
              orderBy: { league: { displayOrder: "asc" } },
              select: {
                id: true,
                name: true,
                league: { select: { id: true, code: true, name: true } },
              },
            },
          },
        },
      },
    }),
    database.race.findMany({
      where: { seasonId: selectedSeason.id },
      orderBy: { round: "asc" },
      select: {
        id: true,
        name: true,
        round: true,
        globalWeekend: {
          select: {
            status: true,
            reason: true,
            version: true,
            finalizedAt: true,
            updatedAt: true,
          },
        },
        leagueSchedules: {
          where: { league: { active: true } },
          select: { leagueId: true },
        },
      },
    }),
  ]);
  return {
    seasons,
    selectedSeason,
    standings: standings.map((standing) => ({
      position: standing.position,
      points: standing.points,
      racePoints: standing.racePoints,
      sprintPoints: standing.sprintPoints,
      leagueCount: standing.leagueCount,
      finalizedWeekendCount: standing.finalizedWeekendCount,
      organization: {
        id: standing.organization.id,
        name: standing.organization.name,
        shortName: standing.organization.shortName,
        color: standing.organization.color,
        principal:
          standing.organization.seasons[0]?.principal ?? null,
        teams: standing.organization.teams,
      },
    })),
    weekends: weekends.map((race) => ({
      id: race.id,
      name: race.name,
      round: race.round,
      activeLeagueCount: race.leagueSchedules.length,
      status:
        race.globalWeekend?.status ?? GlobalWeekendStatus.PENDING,
      reason:
        race.globalWeekend?.reason ??
        blockReasonLabels.RESULTS_INCOMPLETE,
      version: race.globalWeekend?.version ?? 0,
      finalizedAt:
        race.globalWeekend?.finalizedAt?.toISOString() ?? null,
    })),
    updatedAt:
      standings.reduce<Date | null>(
        (latest, standing) =>
          !latest || standing.updatedAt > latest
            ? standing.updatedAt
            : latest,
        null,
      )?.toISOString() ?? null,
  };
}
