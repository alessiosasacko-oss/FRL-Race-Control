import type { RaceSession } from "@/domain";
import type {
  ExternalEvidenceMetadata,
  UploadedVideoMetadata,
} from "@/lib/storage/evidence-types";

export type ExternalEvidenceDraft = ExternalEvidenceMetadata & {
  key: string;
};

export type TicketWizardDraft = {
  leagueId: string;
  raceId: string;
  session: RaceSession;
  driverIds: number[];
  title: string;
  description: string;
  lap: string;
  evidence: Array<ExternalEvidenceDraft | UploadedVideoMetadata>;
};
