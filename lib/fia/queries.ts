import "server-only";
import {
  EvidenceType,
  PenaltyType,
  RaceSession,
  TicketAuditAction,
  TicketStatus,
} from "@/domain";
import {
  Prisma,
  TicketStatus as PrismaTicketStatus,
  RaceSession as PrismaRaceSession,
} from "@/generated/prisma/client";
import { getPrismaClient } from "@/lib/db/prisma";
import { fiaTicketListParamsSchema } from "@/lib/fia/schemas";
import { getVideoUploadLimits } from "@/lib/storage/evidence-config";
import { publicRaceTrack } from "@/lib/races/visibility";
import type {
  FiaListFilterOptions,
  FiaTicketDetail,
  FiaTicketListData,
  FiaTicketListItem,
  FiaTicketListParams,
  FiaTicketStatsData,
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
        {
          race: {
            AND: [
              {
                OR: [
                  { mystery: false },
                  {
                    scheduledAt: {
                      lte: new Date(Date.now() + 60 * 60 * 1000),
                    },
                  },
                ],
              },
              {
                name: { contains: query.q, mode: "insensitive" },
              },
            ],
          },
        },
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
      session: true,
      lap: true,
      createdAt: true,
      updatedAt: true,
      race: {
        select: {
          id: true,
          name: true,
          circuit: true,
          countryCode: true,
          mystery: true,
          scheduledAt: true,
        },
      },
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

  const items: FiaTicketListItem[] = rows.map((ticket) => {
    const track = publicRaceTrack(ticket.race);
    return {
      id: ticket.id,
      title: ticket.title,
      description: ticket.description,
      status: ticket.status as TicketStatus,
      session: ticket.session as RaceSession,
      lap: ticket.lap,
      createdAt: ticket.createdAt.toISOString(),
      updatedAt: ticket.updatedAt.toISOString(),
      race: { id: ticket.race.id, name: track.name },
      league: ticket.league,
      drivers: ticket.drivers.map(({ driver }) => driver),
      counts: {
        evidence: ticket._count.evidence,
        discussionMessages: ticket._count.discussionMessages,
        votes: ticket._count.votes,
      },
    };
  });

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
      select: {
        id: true,
        leagueId: true,
        name: true,
        participatingLeagues: { select: { id: true } },
      },
    }),
    prisma.race.findMany({
      orderBy: [{ scheduledAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        seasonId: true,
        name: true,
        circuit: true,
        countryCode: true,
        mystery: true,
        scheduledAt: true,
      },
    }),
  ]);

  return {
    leagues,
    seasons: seasons.map((season) => ({
      id: season.id,
      leagueId: season.leagueId,
      name: season.name,
    })),
    races: races.map((race) => ({
      id: race.id,
      seasonId: race.seasonId,
      name: publicRaceTrack(race).name,
    })),
  };
}

export async function getTicketWizardOptions(): Promise<TicketWizardOptions> {
  const prisma = getPrismaClient();
  const [leagues, races, drivers] = await prisma.$transaction([
    prisma.league.findMany({
      where: { active: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true, code: true },
    }),
    prisma.race.findMany({
      where: {
        season: {
          active: true,
          participatingLeagues: { some: { active: true } },
        },
      },
      orderBy: [{ scheduledAt: "desc" }, { name: "asc" }],
      select: {
        id: true,
        seasonId: true,
        season: {
          select: {
            name: true,
            participatingLeagues: {
              where: { active: true },
              select: { id: true },
            },
          },
        },
        name: true,
        circuit: true,
        countryCode: true,
        mystery: true,
        scheduledAt: true,
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
    races: races.flatMap((race) => {
      const track = publicRaceTrack(race);
      return race.season.participatingLeagues.map((league) => ({
        id: race.id,
        leagueId: league.id,
        seasonId: race.seasonId,
        seasonName: race.season.name,
        name: track.name,
        circuit: track.circuit,
        sessions: race.sessions as RaceSession[],
      }));
    }),
    drivers,
    uploadLimits: getVideoUploadLimits(),
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
        select: {
          id: true,
          name: true,
          circuit: true,
          countryCode: true,
          mystery: true,
          scheduledAt: true,
          round: true,
        },
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

  const track = publicRaceTrack(ticket.race);

  return {
    id: ticket.id,
    title: ticket.title,
    description: ticket.description,
    status: ticket.status as TicketStatus,
    session: ticket.session as RaceSession,
    lap: ticket.lap,
    createdAt: ticket.createdAt.toISOString(),
    updatedAt: ticket.updatedAt.toISOString(),
    league: ticket.league,
    season: ticket.season,
    race: {
      id: ticket.race.id,
      name: track.name,
      circuit: track.circuit,
      round: ticket.race.round,
    },
    reportedBy: ticket.reportedBy,
    drivers: ticket.drivers.map(({ driver }) => driver),
    evidence: ticket.evidence.map((evidence) => ({
      id: evidence.id,
      type: evidence.type as EvidenceType,
      url: evidence.url,
      viewUrl: evidence.storagePath
        ? `/api/fia/evidence/${evidence.id}`
        : evidence.url,
      label: evidence.label,
      storagePath: evidence.storagePath,
      originalFilename: evidence.originalFilename,
      mimeType: evidence.mimeType,
      fileSize: evidence.fileSize,
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
