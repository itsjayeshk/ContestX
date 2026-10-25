// Small fixed-window limiter for auth endpoints. Per-process: with several web
// instances, put a shared limiter (e.g. at the proxy) in front as well.
const buckets = new Map<string, { count: number; resetAt: number }>();

export function rateLimit(key: string, limit: number, windowMs: number, now = Date.now()): { ok: boolean; retryAfterSec: number } {
  const b = buckets.get(key);
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    if (buckets.size > 10_000) for (const [k, v] of buckets) if (v.resetAt <= now) buckets.delete(k);
    return { ok: true, retryAfterSec: 0 };
  }
  b.count++;
  return { ok: b.count <= limit, retryAfterSec: Math.ceil((b.resetAt - now) / 1000) };
}

export function clientIp(req: Request): string {
  return req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || req.headers.get("x-real-ip") || "local";
}
