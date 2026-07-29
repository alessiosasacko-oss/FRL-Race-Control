import "server-only";
import {
  DiscussionMessageType,
  EvidenceType,
  PenaltyProposalStatus,
  PenaltyType,
  ProposalVoteChoice,
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
import {
  fiaArchiveListParamsSchema,
  fiaTicketListParamsSchema,
} from "@/lib/fia/schemas";
import { getVideoUploadLimits } from "@/lib/storage/evidence-config";
import { publicRaceTrack } from "@/lib/races/visibility";
import type {
  FiaListFilterOptions,
  FiaArchiveFilterOptions,
  FiaArchiveListData,
  FiaArchiveListParams,
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

export function parseFiaArchiveListParams(
  searchParams: RawSearchParams,
): FiaArchiveListParams {
  return fiaArchiveListParamsSchema.parse(searchParams);
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
    archivedAt: null,
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
  const [open, inReview, resolved, total] = await Promise.all([
    prisma.fiaTicket.count({
      where: { archivedAt: null, status: PrismaTicketStatus.OPEN },
    }),
    prisma.fiaTicket.count({
      where: {
        archivedAt: null,
        status: PrismaTicketStatus.IN_REVIEW,
      },
    }),
    prisma.fiaTicket.count({
      where: {
        archivedAt: null,
        status: PrismaTicketStatus.RESOLVED,
      },
    }),
    prisma.fiaTicket.count({ where: { archivedAt: null } }),
  ]);

  return { open, inReview, resolved, total };
}

function archiveDateRange(
  query: FiaArchiveListParams,
): Prisma.DateTimeNullableFilter<"FiaTicket"> {
  const end = query.archivedTo
    ? new Date(`${query.archivedTo}T23:59:59.999Z`)
    : undefined;
  return {
    not: null,
    gte: query.archivedFrom
      ? new Date(`${query.archivedFrom}T00:00:00.000Z`)
      : undefined,
    lte: end,
  };
}

function archiveWhere(
  query: FiaArchiveListParams,
): Prisma.FiaTicketWhereInput {
  const numericId = Number(query.q);
  const search: Prisma.FiaTicketWhereInput[] = query.q
    ? [
        { title: { contains: query.q, mode: "insensitive" as const } },
        {
          description: {
            contains: query.q,
            mode: "insensitive" as const,
          },
        },
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
                name: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
            ],
          },
        },
        {
          drivers: {
            some: {
              driver: {
                name: {
                  contains: query.q,
                  mode: "insensitive" as const,
                },
              },
            },
          },
        },
      ]
    : [];
  if (query.q && Number.isSafeInteger(numericId) && numericId > 0) {
    search.push({ id: numericId });
  }

  return {
    archivedAt: archiveDateRange(query),
    leagueId: query.leagueId,
    seasonId: query.seasonId,
    raceId: query.raceId,
    drivers: query.driverId
      ? { some: { driverId: query.driverId } }
      : undefined,
    decision: query.decision
      ? { penaltyType: query.decision }
      : { isNot: null },
    OR: search.length > 0 ? search : undefined,
  };
}

export async function getFiaArchiveList(
  query: FiaArchiveListParams,
): Promise<FiaArchiveListData> {
  const prisma = getPrismaClient();
  const where = archiveWhere(query);
  const total = await prisma.fiaTicket.count({ where });
  const pageCount = Math.max(1, Math.ceil(total / query.pageSize));
  const page = Math.min(query.page, pageCount);
  const rows = await prisma.fiaTicket.findMany({
    where,
    orderBy: [{ archivedAt: "desc" }, { id: "desc" }],
    skip: (page - 1) * query.pageSize,
    take: query.pageSize,
    select: {
      id: true,
      title: true,
      archivedAt: true,
      archivedBy: { select: { id: true, displayName: true } },
      league: { select: { id: true, code: true } },
      season: { select: { id: true, name: true } },
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
      drivers: {
        orderBy: { driver: { number: "asc" } },
        select: {
          driver: {
            select: {
              id: true,
              name: true,
              number: true,
              flag: true,
            },
          },
        },
      },
      decision: {
        select: {
          penaltyType: true,
          penaltyValue: true,
          reason: true,
          decidedAt: true,
        },
      },
    },
  });

  return {
    items: rows.flatMap((ticket) =>
      ticket.archivedAt && ticket.decision
        ? [
            {
              id: ticket.id,
              title: ticket.title,
              archivedAt: ticket.archivedAt.toISOString(),
              archivedBy: ticket.archivedBy,
              completedAt: ticket.decision.decidedAt.toISOString(),
              league: ticket.league,
              season: ticket.season,
              race: {
                id: ticket.race.id,
                name: publicRaceTrack(ticket.race).name,
              },
              drivers: ticket.drivers.map(({ driver }) => driver),
              decision: {
                penaltyType:
                  ticket.decision.penaltyType as PenaltyType,
                penaltyValue: ticket.decision.penaltyValue,
                reason: ticket.decision.reason,
              },
            },
          ]
        : [],
    ),
    total,
    page,
    pageSize: query.pageSize,
    pageCount,
  };
}

export async function getFiaArchiveFilterOptions(): Promise<FiaArchiveFilterOptions> {
  const [base, drivers] = await Promise.all([
    getFiaListFilterOptions(),
    getPrismaClient().driver.findMany({
      where: {
        ticketLinks: {
          some: { ticket: { archivedAt: { not: null } } },
        },
      },
      orderBy: [{ name: "asc" }, { number: "asc" }],
      select: { id: true, name: true, number: true },
    }),
  ]);
  return { ...base, drivers };
}

export async function getFiaListFilterOptions(): Promise<FiaListFilterOptions> {
  const prisma = getPrismaClient();
  const [leagues, seasons, races] = await Promise.all([
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
  options: { includeInternal?: boolean } = {},
): Promise<FiaTicketDetail | null> {
  const prisma = getPrismaClient();
  const includeInternal = options.includeInternal ?? false;
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
      archivedBy: {
        select: { id: true, displayName: true },
      },
      stewardAssignments: {
        orderBy: { createdAt: "asc" },
        select: {
          user: { select: { id: true, displayName: true } },
        },
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
        where: includeInternal ? undefined : { id: -1 },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, displayName: true } },
          proposal: {
            include: {
              creator: { select: { id: true, displayName: true } },
              affectedDriver: {
                select: {
                  id: true,
                  name: true,
                  number: true,
                  flag: true,
                },
              },
              reviewedBy: {
                select: { id: true, displayName: true },
              },
              evidence: {
                orderBy: { createdAt: "asc" },
                include: {
                  evidence: {
                    select: {
                      id: true,
                      label: true,
                      url: true,
                      storagePath: true,
                    },
                  },
                },
              },
              votes: {
                orderBy: { createdAt: "asc" },
                include: {
                  voter: {
                    select: { id: true, displayName: true },
                  },
                  _count: { select: { changes: true } },
                },
              },
              decision: { select: { id: true } },
            },
          },
        },
      },
      votes: {
        where: includeInternal
          ? { proposalId: null }
          : { id: -1 },
        orderBy: { updatedAt: "desc" },
        include: {
          voter: { select: { id: true, displayName: true } },
        },
      },
      decision: {
        include: {
          affectedDriver: {
            select: { id: true, name: true, number: true },
          },
          stewards: {
            where: includeInternal ? undefined : { id: -1 },
            include: {
              user: { select: { id: true, displayName: true } },
            },
          },
        },
      },
      auditLog: {
        where: includeInternal
          ? undefined
          : {
              action: {
                in: [
                  "CREATED",
                  "STATUS_CHANGED",
                  "EVIDENCE_ADDED",
                  "EVIDENCE_REMOVED",
                  "DECISION_PUBLISHED",
                ],
              },
            },
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
    archivedAt: ticket.archivedAt?.toISOString() ?? null,
    archivedBy: ticket.archivedBy,
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
    assignedStewards: ticket.stewardAssignments.map(
      ({ user }) => user,
    ),
    drivers: ticket.drivers.map(({ driver }) => driver),
    evidence: ticket.evidence.map((evidence) => ({
      id: evidence.id,
      type: evidence.type as EvidenceType,
      url: evidence.url,
      viewUrl: evidence.storagePath
        ? `/api/fia/evidence/${evidence.id}`
        : evidence.url,
      label: evidence.label,
      isStoredVideo: evidence.storagePath !== null,
      originalFilename: evidence.originalFilename,
      mimeType: evidence.mimeType,
      fileSize: evidence.fileSize,
      createdAt: evidence.createdAt.toISOString(),
      submittedBy: evidence.submittedBy,
    })),
    discussionMessages: ticket.discussionMessages.map((message) => ({
      id: message.id,
      type: message.type as DiscussionMessageType,
      message: message.message,
      createdAt: message.createdAt.toISOString(),
      updatedAt: message.updatedAt.toISOString(),
      author: message.author,
      proposal: message.proposal
        ? {
            id: message.proposal.id,
            affectedDriver: message.proposal.affectedDriver,
            creator: message.proposal.creator,
            penaltyType:
              message.proposal.penaltyType as PenaltyType,
            penaltyValue: message.proposal.penaltyValue,
            reason: message.proposal.reason,
            status:
              message.proposal.status as PenaltyProposalStatus,
            revision: message.proposal.revision,
            closesAt:
              message.proposal.closesAt?.toISOString() ?? null,
            closeWhenAllVoted:
              message.proposal.closeWhenAllVoted,
            closedAt:
              message.proposal.closedAt?.toISOString() ?? null,
            reviewedAt:
              message.proposal.reviewedAt?.toISOString() ?? null,
            reviewReason: message.proposal.reviewReason,
            reviewedBy: message.proposal.reviewedBy,
            supersedesId: message.proposal.supersedesId,
            decisionId: message.proposal.decision?.id ?? null,
            evidence: message.proposal.evidence.map(
              ({ evidence }) => ({
                id: evidence.id,
                label: evidence.label,
                viewUrl: evidence.storagePath
                  ? `/api/fia/evidence/${evidence.id}`
                  : evidence.url,
              }),
            ),
            votes: message.proposal.votes.flatMap((vote) =>
              vote.choice
                ? [
                    {
                      id: vote.id,
                      choice: vote.choice as ProposalVoteChoice,
                      createdAt: vote.createdAt.toISOString(),
                      updatedAt: vote.updatedAt.toISOString(),
                      changeCount: vote._count.changes,
                      voter: vote.voter,
                    },
                  ]
                : [],
            ),
          }
        : null,
    })),
    votes: ticket.votes.map((vote) => ({
      id: vote.id,
      penaltyType: vote.penaltyType as PenaltyType,
      penaltyValue: vote.penaltyValue,
      reason: vote.reason ?? "",
      updatedAt: vote.updatedAt.toISOString(),
      voter: vote.voter,
    })),
    decision: ticket.decision
      ? {
          id: ticket.decision.id,
          penaltyType: ticket.decision.penaltyType as PenaltyType,
          penaltyValue: ticket.decision.penaltyValue,
          affectedDriver: ticket.decision.affectedDriver,
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
