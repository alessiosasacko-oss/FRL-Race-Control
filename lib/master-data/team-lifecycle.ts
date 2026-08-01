export type TeamDependencyCounts = {
  drivers: number;
  seasonAssignments: number;
  teamPrincipals: number;
  results: number;
  standings: number;
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

export const emptyTeamDependencyCounts: TeamDependencyCounts = {
  drivers: 0,
  seasonAssignments: 0,
  teamPrincipals: 0,
  results: 0,
  standings: 0,
  adjustments: 0,
  attendance: 0,
  fiaData: 0,
  notifications: 0,
  brandingAssets: 0,
};

const dependencyLabels: Record<keyof TeamDependencyCounts, string> = {
  drivers: "Fahrerzuordnungen",
  seasonAssignments: "saisonale Fahrerzuordnungen",
  teamPrincipals: "Teamleiter-Zuordnungen",
  results: "Rennergebnisse",
  standings: "Saisonwertungen",
  adjustments: "Meisterschaftsanpassungen",
  attendance: "Rennanmeldungen",
  fiaData: "FIA-Verknüpfungen",
  notifications: "Benachrichtigungen",
  brandingAssets: "gespeicherte Logos oder Branding-Assets",
};

export function canPermanentlyDeleteTeam(
  dependencies: TeamDependencyCounts,
): boolean {
  return Object.values(dependencies).every((count) => count === 0);
}

export function teamDependencyMessages(
  dependencies: TeamDependencyCounts,
): string[] {
  return Object.entries(dependencies).flatMap(([key, count]) =>
    count > 0
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
