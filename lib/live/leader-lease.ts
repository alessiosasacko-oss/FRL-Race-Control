export type PollingLeaderLease = {
  owner: string;
  expiresAt: number;
};

export function parsePollingLeaderLease(value: string | null): PollingLeaderLease | null {
  if (!value) return null;
  try {
    const lease = JSON.parse(value) as Partial<PollingLeaderLease>;
    if (typeof lease.owner !== "string" || typeof lease.expiresAt !== "number") return null;
    return { owner: lease.owner, expiresAt: lease.expiresAt };
  } catch {
    return null;
  }
}

export function canClaimPollingLeadership(
  lease: PollingLeaderLease | null,
  owner: string,
  now: number,
): boolean {
  return !lease || lease.owner === owner || lease.expiresAt <= now;
}

export function createPollingLeaderLease(
  owner: string,
  now: number,
  ttlMs: number,
): PollingLeaderLease {
  return { owner, expiresAt: now + ttlMs };
}
