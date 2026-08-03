export const APP_DATA_CHANNEL = "frl-data-updates";
export const APP_DATA_STORAGE_KEY = "frl-data-update";
export const APP_DATA_EVENT = "frl:data-changed";
export const APP_FORM_DIRTY_EVENT = "frl:form-dirty";
export const APP_FORM_CLEAN_EVENT = "frl:form-clean";

export const appDataScopes = [
  "users",
  "drivers",
  "teams",
  "seasons",
  "leagues",
  "calendar",
  "attendance",
  "results",
  "championship",
  "fia",
  "notifications",
  "automation",
  "design",
] as const;

export type AppDataScope = (typeof appDataScopes)[number];

export type AppDataChangedEvent = {
  type: "data-changed";
  scopes: AppDataScope[];
  timestamp: number;
  eventId: string;
};

const knownScopes = new Set<string>(appDataScopes);

export function createAppDataChangedEvent(
  scopes: readonly AppDataScope[],
  timestamp = Date.now(),
): AppDataChangedEvent {
  return {
    type: "data-changed",
    scopes: [...new Set(scopes)],
    timestamp,
    eventId: globalThis.crypto?.randomUUID?.() ?? `${timestamp}-${Math.random().toString(36).slice(2)}`,
  };
}

export function isAppDataChangedEvent(value: unknown): value is AppDataChangedEvent {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<AppDataChangedEvent>;
  return candidate.type === "data-changed"
    && typeof candidate.timestamp === "number"
    && typeof candidate.eventId === "string"
    && Array.isArray(candidate.scopes)
    && candidate.scopes.length > 0
    && candidate.scopes.every((scope) => typeof scope === "string" && knownScopes.has(scope));
}

export function scopesForPathname(pathname: string): AppDataScope[] {
  if (pathname.includes("/admin/users") || pathname.includes("/profile") || pathname.includes("/settings")) return ["users", "drivers"];
  if (pathname.includes("/admin/drivers") || pathname.startsWith("/drivers")) return ["drivers", "teams", "attendance", "championship"];
  if (pathname.includes("/admin/teams") || pathname.startsWith("/teams")) return ["teams", "drivers", "championship"];
  if (pathname.includes("/admin/seasons")) return ["seasons", "leagues", "calendar"];
  if (pathname.includes("/admin/leagues")) return ["leagues", "seasons", "calendar"];
  if (pathname.includes("/calendar") || pathname.includes("/admin/races") || pathname.includes("/admin/tracks")) return ["calendar", "attendance", "results"];
  if (pathname.includes("/attendance")) return ["attendance", "drivers", "teams"];
  if (pathname.includes("/results") || pathname.includes("/admin/scoring") || pathname.includes("/admin/adjustments")) return ["results", "championship"];
  if (pathname.includes("/championship")) return ["championship", "results"];
  if (pathname.includes("/fia")) return ["fia", "notifications", "results"];
  if (pathname.includes("/notifications") || pathname.includes("/admin/announcements")) return ["notifications"];
  if (pathname.includes("/admin/automation")) return ["automation", "notifications"];
  if (pathname.includes("/admin/design")) return ["design"];
  return ["users"];
}

export function broadcastAppDataChanged(scopes: readonly AppDataScope[]): AppDataChangedEvent | null {
  if (typeof window === "undefined" || scopes.length === 0) return null;
  const event = createAppDataChangedEvent(scopes);
  const browserWindow = window as Window & {
    BroadcastChannel?: typeof BroadcastChannel;
  };

  if (typeof browserWindow.BroadcastChannel === "function") {
    const channel = new browserWindow.BroadcastChannel(APP_DATA_CHANNEL);
    channel.postMessage(event);
    channel.close();
  } else {
    try {
      browserWindow.localStorage.setItem(APP_DATA_STORAGE_KEY, JSON.stringify(event));
      browserWindow.localStorage.removeItem(APP_DATA_STORAGE_KEY);
    } catch {
      // Local refresh still works if private browsing blocks cross-tab storage.
    }
  }
  return event;
}

export function dispatchAppDataChanged(scopes: readonly AppDataScope[]): AppDataChangedEvent | null {
  const event = broadcastAppDataChanged(scopes);
  if (event) {
    window.dispatchEvent(new CustomEvent<AppDataChangedEvent>(APP_DATA_EVENT, { detail: event }));
  }
  return event;
}
