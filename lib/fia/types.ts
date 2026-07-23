import type {
  EvidenceType,
  NotificationType,
  PenaltyType,
  RaceSession,
  TicketAuditAction,
  TicketPriority,
  TicketStatus,
} from "@/domain";

export type FiaActionState = {
  status: "idle" | "success" | "error";
  message: string;
  fieldErrors?: Record<string, string[]>;
};

export const initialFiaActionState: FiaActionState = {
  status: "idle",
  message: "",
};

export type FiaTicketListParams = {
  q: string;
  leagueId?: number;
  seasonId?: number;
  raceId?: number;
  status?: TicketStatus;
  priority?: TicketPriority;
  session?: RaceSession;
  page: number;
  pageSize: number;
  sort: "createdAt" | "updatedAt" | "title" | "status";
  direction: "asc" | "desc";
};

export type FiaTicketStatsData = {
  open: number;
  inReview: number;
  resolved: number;
  total: number;
};

export type FiaDriverSummary = {
  id: number;
  name: string;
  number: number;
  flag: string;
  leagueId: number;
  team: {
    id: number;
    name: string;
    shortName: string;
    color: string;
  } | null;
};

export type FiaTicketListItem = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  session: RaceSession;
  lap: number | null;
  corner: string | null;
  createdAt: string;
  updatedAt: string;
  race: {
    id: number;
    name: string;
  };
  league: {
    id: number;
    code: string;
  };
  drivers: FiaDriverSummary[];
  counts: {
    evidence: number;
    discussionMessages: number;
    votes: number;
  };
};

export type FiaNotificationItem = {
  id: number;
  type: NotificationType;
  title: string;
  message: string;
  href: string | null;
  readAt: string | null;
  createdAt: string;
};

export type FiaTicketListData = {
  items: FiaTicketListItem[];
  total: number;
  page: number;
  pageSize: number;
  pageCount: number;
};

export type FiaListFilterOptions = {
  leagues: Array<{ id: number; name: string; code: string }>;
  seasons: Array<{ id: number; leagueId: number; name: string }>;
  races: Array<{ id: number; seasonId: number; name: string }>;
};

export type TicketWizardOptions = {
  leagues: Array<{ id: number; name: string; code: string }>;
  seasons: Array<{ id: number; leagueId: number; name: string }>;
  races: Array<{
    id: number;
    seasonId: number;
    name: string;
    circuit: string;
    sessions: RaceSession[];
  }>;
  drivers: FiaDriverSummary[];
};

export type FiaTicketDetail = {
  id: number;
  title: string;
  description: string;
  status: TicketStatus;
  priority: TicketPriority;
  session: RaceSession;
  lap: number | null;
  corner: string | null;
  createdAt: string;
  updatedAt: string;
  league: { id: number; name: string; code: string };
  season: { id: number; name: string };
  race: { id: number; name: string; circuit: string; round: number };
  reportedBy: {
    id: number;
    displayName: string;
    avatarUrl: string | null;
  } | null;
  drivers: Array<FiaDriverSummary & { userId: number | null }>;
  evidence: Array<{
    id: number;
    type: EvidenceType;
    url: string;
    label: string;
    createdAt: string;
    submittedBy: { id: number; displayName: string } | null;
  }>;
  discussionMessages: Array<{
    id: number;
    message: string;
    createdAt: string;
    author: { id: number; displayName: string };
  }>;
  votes: Array<{
    id: number;
    penaltyType: PenaltyType;
    penaltyValue: number | null;
    reason: string;
    updatedAt: string;
    voter: { id: number; displayName: string };
  }>;
  decision: {
    id: number;
    penaltyType: PenaltyType;
    penaltyValue: number | null;
    reason: string;
    decidedAt: string;
    stewards: Array<{ id: number; displayName: string }>;
  } | null;
  auditLog: Array<{
    id: number;
    action: TicketAuditAction;
    fromStatus: TicketStatus | null;
    toStatus: TicketStatus | null;
    details: string;
    createdAt: string;
    actor: { id: number; displayName: string } | null;
  }>;
};
