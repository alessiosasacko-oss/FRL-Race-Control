import { Role, roleLabels } from "@/domain";
import { hasPermission, Permission } from "@/lib/auth/permissions";

export type EffectiveAccessStatus = "ALLOWED" | "RESTRICTED" | "DENIED";

export type EffectiveAccessEntry = {
  id: string;
  label: string;
  status: EffectiveAccessStatus;
  reason: string;
};

type UserAccessContext = {
  roles: readonly Role[];
  leagueCode?: string | null;
  teamName?: string | null;
  hasDriverProfile?: boolean;
};

const navigationDefinitions: Array<{
  id: string;
  label: string;
  permission: Permission;
}> = [
  { id: "dashboard", label: "Dashboard", permission: Permission.ViewRaceControl },
  { id: "calendar", label: "Kalender", permission: Permission.ViewMasterData },
  { id: "attendance", label: "Rennanmeldung", permission: Permission.ViewChampionship },
  { id: "championship", label: "Meisterschaft", permission: Permission.ViewChampionship },
  { id: "fia", label: "FIA", permission: Permission.ViewRaceControl },
  { id: "drivers", label: "Fahrer", permission: Permission.ViewMasterData },
  { id: "teams", label: "Teams", permission: Permission.ViewMasterData },
  { id: "results", label: "Ergebnisse", permission: Permission.ViewChampionship },
  { id: "notifications", label: "Benachrichtigungen", permission: Permission.ViewRaceControl },
  { id: "admin", label: "Administration", permission: Permission.ManageAdministration },
];

const actionDefinitions: Array<{
  id: string;
  label: string;
  permission: Permission;
  restrictedReason?: (context: UserAccessContext) => string | null;
}> = [
  { id: "own-attendance", label: "Sich selbst anmelden", permission: Permission.ManageOwnAttendance, restrictedReason: (context) => context.hasDriverProfile ? null : "Nur mit Fahrerprofil erlaubt" },
  { id: "change-own-attendance", label: "Eigene Anmeldung ändern", permission: Permission.ManageOwnAttendance, restrictedReason: (context) => context.hasDriverProfile ? null : "Nur mit Fahrerprofil erlaubt" },
  { id: "team-attendance", label: "Teamfahrer anmelden", permission: Permission.ManageTeamAttendance, restrictedReason: (context) => context.teamName ? `Nur für das eigene Team ${context.teamName}` : "Nur für ein zugewiesenes Team" },
  { id: "create-ticket", label: "FIA-Ticket erstellen", permission: Permission.SubmitFiaTicket },
  { id: "read-fia-chat", label: "FIA-Chat lesen", permission: Permission.ReviewFiaTicket, restrictedReason: () => "Ohne Stewardrecht nur für eigene FIA-Tickets" },
  { id: "write-steward-chat", label: "Steward-Chat schreiben", permission: Permission.ReviewFiaTicket },
  { id: "vote", label: "Abstimmen", permission: Permission.ReviewFiaTicket },
  { id: "close-ticket", label: "Ticket abschließen", permission: Permission.DecideFiaTicket },
  { id: "edit-results", label: "Ergebnisse bearbeiten", permission: Permission.ManageResults },
  { id: "publish-results", label: "Ergebnisse veröffentlichen", permission: Permission.ManageResults },
  { id: "manage-drivers", label: "Fahrer verwalten", permission: Permission.ManageMasterData },
  { id: "manage-teams", label: "Teams verwalten", permission: Permission.ManageMasterData },
  { id: "manage-roles", label: "Rollen verwalten", permission: Permission.ManageUsers },
  { id: "manage-design", label: "Design verwalten", permission: Permission.ManageBranding },
];

function permissionReason(
  roles: readonly Role[],
  permission: Permission,
): string {
  const role = roles.find((candidate) =>
    hasPermission([candidate], permission),
  );
  return role ? `Erlaubt durch Rolle ${roleLabels[role]}` : "Keine zugewiesene Rolle gewährt diese Berechtigung";
}

export function effectiveUserAccess(context: UserAccessContext): {
  navigation: EffectiveAccessEntry[];
  actions: EffectiveAccessEntry[];
  restrictions: string[];
} {
  const navigation = navigationDefinitions.map((definition) => {
    const allowed = hasPermission(context.roles, definition.permission);
    return {
      id: definition.id,
      label: definition.label,
      status: allowed ? "ALLOWED" as const : "DENIED" as const,
      reason: permissionReason(context.roles, definition.permission),
    };
  });

  const actions = actionDefinitions.map((definition) => {
    const allowed = hasPermission(context.roles, definition.permission);
    const restriction = allowed
      ? definition.restrictedReason?.(context) ?? null
      : null;
    return {
      id: definition.id,
      label: definition.label,
      status: !allowed
        ? "DENIED" as const
        : restriction
          ? "RESTRICTED" as const
          : "ALLOWED" as const,
      reason: restriction ?? permissionReason(context.roles, definition.permission),
    };
  });

  return {
    navigation,
    actions,
    restrictions: [
      context.leagueCode
        ? `Sportlicher Kontext ist auf Liga ${context.leagueCode} begrenzt.`
        : "Kein Liga-Kontext vorhanden.",
      context.teamName
        ? `Teamaktionen sind auf ${context.teamName} begrenzt.`
        : "Kein Team-Kontext vorhanden.",
      "Die Vorschau ist schreibgeschützt und ersetzt keine serverseitige Prüfung.",
    ],
  };
}

export function canPreviewWrite(): false {
  return false;
}
