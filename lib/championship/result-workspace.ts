import {
  ResultPublicationStatus,
  ResultSession,
} from "@/domain";

export type ResultWorkspaceStatus =
  | "NOT_STARTED"
  | "DRAFT"
  | "PUBLISHED";

export function resultWorkspaceStatus(
  sessions: readonly {
    session: ResultSession;
    publicationStatus: ResultPublicationStatus;
  }[],
  session: ResultSession,
): ResultWorkspaceStatus {
  const result = sessions.find(
    (candidate) => candidate.session === session,
  );
  if (!result) return "NOT_STARTED";
  return result.publicationStatus === ResultPublicationStatus.Published
    ? "PUBLISHED"
    : "DRAFT";
}

export function resultWorkspaceStorageKey(
  raceId: number,
  leagueId: number,
  session: ResultSession,
): string {
  return `frl-result-draft:${raceId}:${leagueId}:${session}`;
}

export function unsavedResultWarning(leagueCode: string): string {
  return `Du hast ungespeicherte Änderungen im ${leagueCode}-Ergebnis. Möchtest du die Seite wirklich verlassen?`;
}

export function resultPublishSummary(input: {
  driverIds: readonly string[];
  fastestDriverNames: readonly string[];
  decisionIds: readonly number[];
}): {
  driverCount: number;
  fastestDriverNames: string[];
  fiaDecisionCount: number;
} {
  return {
    driverCount: new Set(input.driverIds.filter(Boolean)).size,
    fastestDriverNames: [...new Set(input.fastestDriverNames)],
    fiaDecisionCount: new Set(input.decisionIds).size,
  };
}
