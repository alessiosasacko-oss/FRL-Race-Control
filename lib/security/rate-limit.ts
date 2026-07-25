import "server-only";

type Bucket = { count: number; expiresAt: number };

const buckets = new Map<string, Bucket>();

export function consumeRateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.expiresAt <= now) {
    buckets.set(key, {
      count: 1,
      expiresAt: now + options.windowMs,
    });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (bucket.count >= options.limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(
        1,
        Math.ceil((bucket.expiresAt - now) / 1000),
      ),
    };
  }

  bucket.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}
