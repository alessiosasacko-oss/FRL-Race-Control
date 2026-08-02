import { appDataScopes, type AppDataScope } from "@/lib/live/data-events";

export type RevisionSnapshot = Partial<Record<AppDataScope, string>>;

export function parseRevisionSnapshot(value: unknown): RevisionSnapshot | null {
  if (!value || typeof value !== "object" || !("revisions" in value)) return null;
  const revisions = (value as { revisions?: unknown }).revisions;
  if (!Array.isArray(revisions)) return null;
  const snapshot: RevisionSnapshot = {};
  for (const item of revisions) {
    if (!item || typeof item !== "object") return null;
    const { scope, revision } = item as { scope?: unknown; revision?: unknown };
    if (typeof scope !== "string" || typeof revision !== "string") return null;
    if (!appDataScopes.includes(scope as AppDataScope)) continue;
    snapshot[scope as AppDataScope] = revision;
  }
  return snapshot;
}

export function changedRevisionScopes(
  previous: RevisionSnapshot | null,
  next: RevisionSnapshot,
): AppDataScope[] {
  if (!previous) return [];
  return appDataScopes.filter((scope) => previous[scope] !== next[scope]);
}

export function nextRevisionBackoff(currentMs: number, baseMs: number): number {
  return Math.min(Math.max(currentMs, baseMs) * 2, baseMs * 4);
}
