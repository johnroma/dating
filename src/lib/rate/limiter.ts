const buckets = new Map<string, { tokens: number; last: number }>();

/** Simple token bucket limiter; returns true if allowed. */
export function limit(
  key: string,
  cfg: { capacity: number; refillPerMs: number }
): boolean {
  const now = Date.now();
  let b = buckets.get(key);
  if (!b) {
    b = { tokens: cfg.capacity, last: now };
    buckets.set(key, b);
  }
  const elapsed = now - b.last;
  const refill = (elapsed / cfg.refillPerMs) * cfg.capacity;
  b.tokens = Math.min(cfg.capacity, b.tokens + refill);
  b.last = now;
  if (b.tokens < 1) return false;
  b.tokens -= 1;
  return true;
}

export function ipFromHeaders(req: Request): string {
  const xf = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim();
  return xf || '0.0.0.0';
}
