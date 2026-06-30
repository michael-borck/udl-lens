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

// Spoof-resistant client IP from X-Forwarded-For, given a trusted-proxy hop
// count. XFF is `<client>, <proxy1>, ...`; each trusted proxy APPENDS the IP it
// saw on its own socket, so the real client sits `hops` entries from the END of
// the list. A client can inject values at the front but cannot move its real IP
// out of that trusted position - which is what defeats the trivial "set
// X-Forwarded-For and get a fresh rate-limit bucket" attack that the naive
// `xff.split(',')[0]` reading allowed.
//
// `hops` defaults to TRUSTED_PROXY_HOPS (default 1: one reverse proxy - nginx,
// caddy, cloudflare - in front of this container). Set 0 only if you expose the
// port directly: XFF is then client-controlled and ignored, so every caller
// shares one bucket (fail-closed) and the global limit still holds.
function trustedHops(): number {
  const n = Number(process.env.TRUSTED_PROXY_HOPS ?? '1')
  return Number.isFinite(n) && n > 0 ? Math.floor(n) : 0
}

export function getClientIp(req: Request, hops: number = trustedHops()): string {
  if (hops > 0) {
    const xff = req.headers.get('x-forwarded-for')
    if (xff) {
      const parts = xff.split(',').map(s => s.trim()).filter(Boolean)
      // Real client = `hops` from the end. A shorter-than-expected chain is
      // malformed/odd - fall through to x-real-ip or the shared bucket rather
      // than trust a client-controlled position.
      const idx = parts.length - hops
      if (idx >= 0 && idx < parts.length) return parts[idx]
    }
    // x-real-ip is written by some proxies from their own socket ($remote_addr),
    // overwriting anything the client sent - safe only behind a trusted proxy.
    const xreal = req.headers.get('x-real-ip')
    if (xreal) return xreal.trim()
  }
  // Unproxied, or no trustworthy header: no reliable per-client key. A shared
  // bucket keeps the global limit enforced (fail-closed).
  return 'unknown'
}

// Test-only: reset internal state between cases.
export function _resetRateLimitStore(): void {
  buckets.clear()
}
