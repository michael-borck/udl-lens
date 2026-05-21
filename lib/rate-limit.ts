// Fixed-window, in-memory rate limiter keyed by client IP.
//
// SCOPE: This works because the app runs as ONE long-lived process (the Docker
// container in docker-compose.yml) - all requests share this module's memory.
// On serverless / multi-instance hosting each instance keeps its own counter,
// so the global limit would NOT be enforced. If you move to Vercel/Lambda/etc.,
// swap this for an external store (e.g. Upstash Redis) keyed the same way.

interface Bucket {
  count: number
  resetAt: number
}

const buckets = new Map<string, Bucket>()

const DEFAULT_WINDOW_MS = 60_000 // 1 minute
const DEFAULT_MAX = 20           // requests per IP per window

export interface RateLimitResult {
  ok: boolean
  retryAfterSeconds: number
}

export function checkRateLimit(
  key: string,
  opts: { max?: number; windowMs?: number } = {},
): RateLimitResult {
  const max = opts.max ?? DEFAULT_MAX
  const windowMs = opts.windowMs ?? DEFAULT_WINDOW_MS
  const now = Date.now()

  const bucket = buckets.get(key)
  if (!bucket || now >= bucket.resetAt) {
    pruneExpired(now)
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { ok: true, retryAfterSeconds: 0 }
  }

  if (bucket.count >= max) {
    return { ok: false, retryAfterSeconds: Math.ceil((bucket.resetAt - now) / 1000) }
  }

  bucket.count++
  return { ok: true, retryAfterSeconds: 0 }
}

// Keep the Map from growing unbounded across many unique IPs. Only sweeps when
// the map gets large, so the common path stays O(1).
function pruneExpired(now: number): void {
  if (buckets.size < 1000) return
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key)
  }
}

// Best-effort client IP from common proxy headers. Behind a reverse proxy or
// container network this is the closest thing to a stable per-client key.
export function getClientIp(req: Request): string {
  const xff = req.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0].trim()
  return req.headers.get('x-real-ip') ?? 'unknown'
}

// Test-only: reset internal state between cases.
export function _resetRateLimitStore(): void {
  buckets.clear()
}
