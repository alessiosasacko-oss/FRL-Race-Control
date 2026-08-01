export type TeamDependencyCounts = {
  technicalSlots: number;
  drivers: number;
  seasonAssignments: number;
  teamPrincipals: number;
  results: number;
  standings: number;
  globalStandings: number;
  contributions: number;
  adjustments: number;
  attendance: number;
  fiaData: number;
  notifications: number;
  brandingAssets: number;
};

export type TeamActiveDriver = {
  id: number;
  name: string;
  leagueCode: string;
};

export function internalTeamSlotKey(input: {
  organizationId: number;
  seasonId: number;
  leagueId: number;
}): string {
  return `organization:${input.organizationId}:season:${input.seasonId}:league:${input.leagueId}`;
}

export const emptyTeamDependencyCounts: TeamDependencyCounts = {
  technicalSlots: 0,
  drivers: 0,
  seasonAssignments: 0,
  teamPrincipals: 0,
  results: 0,
  standings: 0,
  globalStandings: 0,
  contributions: 0,
  adjustments: 0,
  attendance: 0,
  fiaData: 0,
  notifications: 0,
  brandingAssets: 0,
};

const dependencyLabels: Record<keyof TeamDependencyCounts, string> = {
  technicalSlots: "technische Saison-/Liga-Slots (werden gemeinsam entfernt)",
  drivers: "direkte Fahrerzuordnungen",
  seasonAssignments: "saisonale Fahrerzuordnungen",
  teamPrincipals: "historische Teamchef-Zuordnungen",
  results: "Rennergebnisse",
  standings: "Liga-Teamwertungen",
  globalStandings: "ligaübergreifende Teamwertungen",
  contributions: "ligaübergreifende Punktebeiträge",
  adjustments: "Meisterschaftsanpassungen",
  attendance: "Rennanmeldungen",
  fiaData: "FIA-Verknüpfungen",
  notifications: "Benachrichtigungen",
  brandingAssets: "gespeicherte Logos oder Branding-Assets",
};

const removableDependencyKeys = new Set<keyof TeamDependencyCounts>([
  "technicalSlots",
]);

export function canPermanentlyDeleteTeam(
  dependencies: TeamDependencyCounts,
): boolean {
  return Object.entries(dependencies).every(
    ([key, count]) =>
      removableDependencyKeys.has(key as keyof TeamDependencyCounts) ||
      count === 0,
  );
}

export function teamDependencyMessages(
  dependencies: TeamDependencyCounts,
  includeRemovable = false,
): string[] {
  return Object.entries(dependencies).flatMap(([key, count]) =>
    count > 0 &&
    (includeRemovable ||
      !removableDependencyKeys.has(key as keyof TeamDependencyCounts))
      ? [`${count} ${dependencyLabels[key as keyof TeamDependencyCounts]}`]
      : [],
  );
}

export function teamDeleteConfirmationMatches(
  teamName: string,
  confirmation: string,
): boolean {
  return confirmation.trim() === teamName.trim().toUpperCase();
}

export function teamArchiveRequiresDriverResolution(
  activeDrivers: readonly TeamActiveDriver[],
): boolean {
  return activeDrivers.length > 0;
}
