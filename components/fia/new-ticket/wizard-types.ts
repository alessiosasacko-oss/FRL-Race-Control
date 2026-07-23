import type {
  EvidenceType,
  RaceSession,
  TicketPriority,
} from "@/domain";

export type EvidenceDraft = {
  key: string;
  type: EvidenceType;
  url: string;
  label: string;
};

export type TicketWizardDraft = {
  leagueId: string;
  seasonId: string;
  raceId: string;
  session: RaceSession;
  driverIds: number[];
  title: string;
  description: string;
  lap: string;
  corner: string;
  priority: TicketPriority;
  evidence: EvidenceDraft[];
};
