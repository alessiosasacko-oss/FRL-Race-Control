export type DriverHistoricalDependencyCounts = {
  standings: number;
  results: number;
  attendance: number;
  attendanceAudits: number;
  adjustments: number;
  fiaTickets: number;
  penaltyProposals: number;
  decisions: number;
};

export type UserHistoricalDependencyCounts = {
  reportedTickets: number;
  archivedTickets: number;
  stewardAssignments: number;
  evidence: number;
  fiaAuditEntries: number;
  discussionMessages: number;
  mentions: number;
  votes: number;
  voteChanges: number;
  proposals: number;
  proposalReviews: number;
  decisionMemberships: number;
  attendanceSubmissions: number;
  attendanceAudits: number;
  championshipChanges: number;
  resultPublications: number;
  resultPenaltyChanges: number;
  teamPrincipalAssignments: number;
  announcements: number;
  automationRetries: number;
  designChanges: number;
};

export const emptyDriverHistoricalDependencies: DriverHistoricalDependencyCounts = {
  standings: 0,
  results: 0,
  attendance: 0,
  attendanceAudits: 0,
  adjustments: 0,
  fiaTickets: 0,
  penaltyProposals: 0,
  decisions: 0,
};

export const emptyUserHistoricalDependencies: UserHistoricalDependencyCounts = {
  reportedTickets: 0,
  archivedTickets: 0,
  stewardAssignments: 0,
  evidence: 0,
  fiaAuditEntries: 0,
  discussionMessages: 0,
  mentions: 0,
  votes: 0,
  voteChanges: 0,
  proposals: 0,
  proposalReviews: 0,
  decisionMemberships: 0,
  attendanceSubmissions: 0,
  attendanceAudits: 0,
  championshipChanges: 0,
  resultPublications: 0,
  resultPenaltyChanges: 0,
  teamPrincipalAssignments: 0,
  announcements: 0,
  automationRetries: 0,
  designChanges: 0,
};

const driverLabels: Record<keyof DriverHistoricalDependencyCounts, string> = {
  standings: "Fahrer-Wertungen",
  results: "Rennergebnisse oder Ersatzfahrereinsätze",
  attendance: "Rennanmeldungen",
  attendanceAudits: "Anmeldehistorien",
  adjustments: "Meisterschaftsanpassungen",
  fiaTickets: "FIA-Ticket-Beteiligungen",
  penaltyProposals: "Strafenvorschläge",
  decisions: "FIA-Entscheidungen",
};

const userLabels: Record<keyof UserHistoricalDependencyCounts, string> = {
  reportedTickets: "erstellte FIA-Tickets",
  archivedTickets: "FIA-Archivierungen",
  stewardAssignments: "Steward-Zuweisungen",
  evidence: "hochgeladene Beweismittel",
  fiaAuditEntries: "FIA-Audit-Einträge",
  discussionMessages: "Steward-Nachrichten",
  mentions: "Chat-Erwähnungen",
  votes: "Steward-Abstimmungen",
  voteChanges: "Änderungen an Abstimmungen",
  proposals: "erstellte oder bearbeitete Strafenvorschläge",
  proposalReviews: "Prüfungen von Strafenvorschlägen",
  decisionMemberships: "veröffentlichte Entscheidungen als Steward",
  attendanceSubmissions: "eingereichte Rennanmeldungen",
  attendanceAudits: "Änderungen an Rennanmeldungen",
  championshipChanges: "Meisterschaftsänderungen",
  resultPublications: "veröffentlichte Resultate",
  resultPenaltyChanges: "Resultat-Strafänderungen",
  teamPrincipalAssignments: "Teamchef-Zuordnungen",
  announcements: "veröffentlichte Mitteilungen",
  automationRetries: "Automationsaktionen",
  designChanges: "Designänderungen",
};

export function hasDependencies<T extends Record<string, number>>(counts: T): boolean {
  return Object.values(counts).some((count) => count > 0);
}

export function driverDependencyMessages(
  counts: DriverHistoricalDependencyCounts,
): string[] {
  return Object.entries(counts).flatMap(([key, count]) =>
    count > 0
      ? [`${count} ${driverLabels[key as keyof DriverHistoricalDependencyCounts]}`]
      : [],
  );
}

export function userDependencyMessages(
  counts: UserHistoricalDependencyCounts,
): string[] {
  return Object.entries(counts).flatMap(([key, count]) =>
    count > 0
      ? [`${count} ${userLabels[key as keyof UserHistoricalDependencyCounts]}`]
      : [],
  );
}

export function destructiveNameMatches(name: string, confirmation: string): boolean {
  return confirmation.trim() === name.trim().toUpperCase();
}

export function anonymizedDriverName(driverId: number): string {
  return `Ehemaliger Fahrer #${driverId}`;
}
