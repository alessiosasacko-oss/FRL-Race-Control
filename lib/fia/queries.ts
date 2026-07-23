import "server-only";
import {
  EvidenceType,
  NotificationType,
  PenaltyType,
  RaceSession,
  TicketAuditAction,
  TicketPriority,
  TicketStatus,
} from "@/domain";
import {
  Prisma,
  TicketPriority as PrismaTicketPriority,
  TicketStatus as PrismaTicketStatus,
  RaceSession as PrismaRaceSession,
  NotificationType as PrismaNotificationType,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { fiaTicketListParamsSchema } from "@/lib/fia/schemas";
import type {
  FiaListFilterOptions,
  FiaTicketDetail,
  FiaTicketListData,
  FiaTicketListItem,
  FiaTicketListParams,
  FiaTicketStatsData,
  FiaNotificationItem,
  TicketWizardOptions,
} from "@/lib/fia/types";

type RawSearchParams = Record<string, string | string[] | undefined>;

export function parseFiaTicketListParams(
  searchParams: RawSearchParams,
): FiaTicketListParams {
  return fiaTicketListParamsSchema.parse(searchParams);
}

function buildTicketWhere(
  query: FiaTicketListParams,
): Prisma.FiaTicketWhereInput {
  const searchConditions: Prisma.FiaTicketWhereInput[] = query.q
    ? [
        { title: { contains: query.q, mode: "insensitive" } },
        { description: { contains: query.q, mode: "insensitive" } },
        { corner: { contains: query.q, mode: "insensitive" } },
        { race: { name: { contains: query.q, mode: "insensitive" } } },
        { league: { name: { contains: query.q, mode: "insensitive" } } },
        {
          drivers: {
            some: {
              driver: {
                OR: [
                  { name: { contains: query.q, mode: "insensitive" } },
                  {
                    team: {
                      name: { contains: query.q, mode: "insensitive" },
                    },
                  },
                ],
              },
            },
          },
        },
      ]
    : [];

  const numericTicketId = Number(query.q);

  if (query.q && Number.isInteger(numericTicketId) && numericTicketId > 0) {
    searchConditions.push(
      { id: numericTicketId },
      {
        drivers: {
          some: {
            driver: { number: numericTicketId },
          },
        },
      },
    );
  }

  return {
    leagueId: query.leagueId,
    seasonId: query.seasonId,
    raceId: query.raceId,
    status: query.status as PrismaTicketStatus | undefined,
    priority: query.priority as PrismaTicketPriority | undefined,
    session: query.session as PrismaRaceSession | undefined,
    OR: searchConditions.length > 0 ? searchConditions : undefined,
  };
}

function ticketOrderBy(
  query: FiaTicketListParams,
): Prisma.FiaTicketOrderByWithRelationInput {
  switch (query.sort) {
    case "createdAt":
      return { createdAt: query.direction };
    case "title":
      return { title: query.direction };
    case "status":
      return { status: query.direction };
    default:
      return { updatedAt: query.direction };
  }
}

export async function getFiaTicketList(
  query: FiaTicketListParams,
): Promise<FiaTicketListData> {
  const prisma = getPrismaClient();
  const where = buildTicketWhere(query);
  const total = await prisma.fiaTicket.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);

  const rows = await prisma.fiaTicket.findMany({
    where,
    orderBy: [ticketOrderBy(query), { id: "desc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: {
      id: true,
      title: true,
      description: true,
      status: true,
      priority: true,
      session: true,
      lap: true,
      corner: true,
      createdAt: true,
      updatedAt: true,
      race: { select: { id: true, name: true } },
      league: { select: { id: true, code: true } },
      drivers: {
        orderBy: { driver: { number: "asc" } },
        select: {
          driver: {
            select: {
              id: true,
              name: true,
              number: true,
              flag: true,
              leagueId: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  color: true,
                },
              },
            },
          },
        },
      },
      _count: {
        select: {
          evidence: true,
          discussionMessages: true,
          votes: true,
        },
      },
    },
  });

  const items: FiaTicketListItem[] = rows.map((ticket) => ({
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status as TicketStatus,
    priority: ticket.priority as TicketPriority,
    session: ticket.session as RaceSession,
    lap: ticket.lap,
    corner: ticket.corner,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    race: ticket.race,
    league: ticket.league,
    drivers: ticket.drivers.map(({ driver }) => driver),
    counts: {
      evidence: ticket._count.evidence,
      discussionMessages: ticket._count.discussionMessages,
      votes: ticket._count.votes,
    },
  }));

  return {
    items,
    total,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getFiaTicketStats(): Promise<FiaTicketStatsData> {
  const prisma = getPrismaClient();
  const [open, inReview, resolved, total] = await prisma.$transaction([
    prisma.fiaTicket.count({ where: { status: PrismaTicketStatus.OPEN } }),
    prisma.fiaTicket.count({
      where: { status: PrismaTicketStatus.IN_REVIEW },
    }),
    prisma.fiaTicket.count({
      where: { status: PrismaTicketStatus.RESOLVED },
    }),
    prisma.fiaTicket.count(),
  ]);

  return { open, inReview, resolved, total };
}

export async function getFiaListFilterOptions(): Promise<FiaListFilterOptions> {
  const prisma = getPrismaClient();
  const [leagues, seasons, races] = await prisma.$transaction([
    prisma.league.findMany({
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.season.findMany({
      orderBy: [{ startsOn: "desc" }, { name: "asc" }],
      select: { id: true, leagueId: true, name: true },
    }),
    prisma.race.findMany({
      orderBy: [{ scheduledAt: "desc" }, { name: "asc" }],
      select: { id: true, seasonId: true, name: true },
    }),
  ]);

  return { leagues, seasons, races };
}

export async function getTicketWizardOptions(): Promise<TicketWizardOptions> {
  const prisma = getPrismaClient();
  const [leagues, seasons, races, drivers] = await prisma.$transaction([
    prisma.league.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.season.findMany({
      where: { active: true },
      orderBy: [{ startsOn: "desc" }, { name: "asc" }],
      select: { id: true, leagueId: true, name: true },
    }),
    prisma.race.findMany({
      orderBy: [{ scheduledAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        seasonId: true,
        name: true,
        circuit: true,
        sessions: true,
      },
    }),
    prisma.driver.findMany({
      where: { active: true },
      orderBy: [{ name: "asc" }],
      select: {
        id: true,
        name: true,
        number: true,
        flag: true,
        leagueId: true,
        team: {
          select: {
            id: true,
            name: true,
            shortName: true,
            color: true,
          },
        },
      },
    }),
  ]);

  return {
    leagues,
    seasons,
    races: races.map((race) => ({
      ...race,
      sessions: race.sessions as RaceSession[],
    })),
    drivers,
  };
}

export async function getFiaTicketById(
  ticketId: number,
): Promise<FiaTicketDetail | null> {
  const prisma = getPrismaClient();
  const ticket = await prisma.fiaTicket.findUnique({
    where: { id: ticketId },
    include: {
      league: { select: { id: true, name: true, code: true } },
      season: { select: { id: true, name: true } },
      race: {
        select: { id: true, name: true, circuit: true, round: true },
      },
      reportedBy: {
        select: { id: true, displayName: true, avatarUrl: true },
      },
      drivers: {
        orderBy: { driver: { number: "asc" } },
        select: {
          driver: {
            select: {
              id: true,
              userId: true,
              name: true,
              number: true,
              flag: true,
              leagueId: true,
              team: {
                select: {
                  id: true,
                  name: true,
                  shortName: true,
                  color: true,
                },
              },
            },
          },
        },
      },
      evidence: {
        orderBy: { createdAt: "desc" },
        include: {
          submittedBy: { select: { id: true, displayName: true } },
        },
      },
      discussionMessages: {
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true } },
        },
      },
      votes: {
        orderBy: { updatedAt: "desc" },
        include: {
          voter: { select: { id: true, displayName: true } },
        },
      },
      decision: {
        include: {
          stewards: {
            include: {
              user: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      auditLog: {
        orderBy: { createdAt: "desc" },
        include: {
          actor: { select: { id: true, displayName: true } },
        },
      },
    },
  });

  if (!ticket) {
    return null;
  }

  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status as TicketStatus,
    priority: ticket.priority as TicketPriority,
    session: ticket.session as RaceSession,
    lap: ticket.lap,
    corner: ticket.corner,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    league: ticket.league,
    season: ticket.season,
    race: ticket.race,
    reportedBy: ticket.reportedBy,
    drivers: ticket.drivers.map(({ driver }) => driver),
    evidence: ticket.evidence.map((evidence) => ({
      id: evidence.id,
      type: evidence.type as EvidenceType,
      url: evidence.url,
      label: evidence.label,
      createdAt: evidence.createdAt.toISOString(),
      submittedBy: evidence.submittedBy,
    })),
    discussionMessages: ticket.discussionMessages.map((message) => ({
      id: message.id,
      message: message.message,
      createdAt: message.createdAt.toISOString(),
      author: message.author,
    })),
    votes: ticket.votes.map((vote) => ({
      id: vote.id,
      penaltyType: vote.penaltyType as PenaltyType,
      penaltyValue: vote.penaltyValue,
      reason: vote.reason,
      updatedAt: vote.updatedAt.toISOString(),
      voter: vote.voter,
    })),
    decision: ticket.decision
      ? {
          id: ticket.decision.id,
          penaltyType: ticket.decision.penaltyType as PenaltyType,
          penaltyValue: ticket.decision.penaltyValue,
          reason: ticket.decision.reason,
          decidedAt: ticket.decision.decidedAt.toISOString(),
          stewards: ticket.decision.stewards.map(({ user }) => user),
        }
      : null,
    auditLog: ticket.auditLog.map((entry) => ({
      id: entry.id,
      action: entry.action as TicketAuditAction,
      fromStatus: entry.fromStatus as TicketStatus | null,
      toStatus: entry.toStatus as TicketStatus | null,
      details: entry.details,
      createdAt: entry.createdAt.toISOString(),
      actor: entry.actor,
    })),
  };
}

export async function getUserFiaNotifications(
  userId: number,
): Promise<FiaNotificationItem[]> {
  const prisma = getPrismaClient();
  const notifications = await prisma.notification.findMany({
    where: {
      userId,
      type: {
        in: [
          PrismaNotificationType.FIA_TICKET,
          PrismaNotificationType.FIA_DECISION,
        ],
      },
    },
    orderBy: { createdAt: "desc" },
    take: 100,
    select: {
      id: true,
      type: true,
      title: true,
      message: true,
      href: true,
      readAt: true,
      createdAt: true,
    },
  });

  return notifications.map((notification) => ({
    ...notification,
    type: notification.type as NotificationType,
    readAt: notification.readAt?.toISOString() ?? null,
    createdAt: notification.createdAt.toISOString(),
  }));
}
