import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { checkRateLimit, getClientIp, _resetRateLimitStore } from '@/lib/rate-limit'

describe('checkRateLimit', () => {
  beforeEach(() => {
    _resetRateLimitStore()
  })

  it('allows up to max requests then blocks', () => {
    const key = 'ip-a'
    expect(checkRateLimit(key, { max: 3 }).ok).toBe(true)
    expect(checkRateLimit(key, { max: 3 }).ok).toBe(true)
    expect(checkRateLimit(key, { max: 3 }).ok).toBe(true)
    const blocked = checkRateLimit(key, { max: 3 })
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0)
  })

  it('tracks keys independently', () => {
    expect(checkRateLimit('ip-x', { max: 1 }).ok).toBe(true)
    expect(checkRateLimit('ip-x', { max: 1 }).ok).toBe(false)
    // Different IP gets its own fresh budget.
    expect(checkRateLimit('ip-y', { max: 1 }).ok).toBe(true)
  })

  it('resets after the window elapses', () => {
    vi.useFakeTimers()
    try {
      const key = 'ip-window'
      expect(checkRateLimit(key, { max: 1, windowMs: 1000 }).ok).toBe(true)
      expect(checkRateLimit(key, { max: 1, windowMs: 1000 }).ok).toBe(false)
      vi.advanceTimersByTime(1001)
      expect(checkRateLimit(key, { max: 1, windowMs: 1000 }).ok).toBe(true)
    } finally {
      vi.useRealTimers()
    }
  })
})

describe('getClientIp', () => {
  afterEach(() => vi.restoreAllMocks())

  // XFF is `<client>, <trusted-proxy-appended-real-ip>, ...`. With one trusted
  // hop the real client is the LAST entry - the one the proxy appended from its
  // own socket - not whatever the client put at the front.
  it('trusts the proxy-appended entry, ignoring a client-spoofed prefix', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': 'spoofed-by-client, 203.0.113.5' },
    })
    expect(getClientIp(req, 1)).toBe('203.0.113.5')
  })

  it('cannot be bypassed by padding the front of XFF', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': 'a, b, c, 203.0.113.5' },
    })
    expect(getClientIp(req, 1)).toBe('203.0.113.5')
  })

  it('respects the hop count for multi-proxy deployments', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1, 10.0.0.2' },
    })
    // Two trusted proxies: real client is 2 from the end.
    expect(getClientIp(req, 2)).toBe('10.0.0.1')
  })

  it('falls back to x-real-ip behind a proxy when XFF is absent', () => {
    const req = new Request('http://localhost', { headers: { 'x-real-ip': '198.51.100.7' } })
    expect(getClientIp(req, 1)).toBe('198.51.100.7')
  })

  it('ignores client-controlled headers when unproxied (hops=0)', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.5', 'x-real-ip': '198.51.100.7' },
    })
    // No trusted proxy => XFF/X-Real-IP are client-controlled and must not be
    // trusted. Fail closed into the shared bucket.
    expect(getClientIp(req, 0)).toBe('unknown')
  })

  it('returns "unknown" when no IP headers are present', () => {
    expect(getClientIp(new Request('http://localhost'), 1)).toBe('unknown')
  })

  it('defaults hops to TRUSTED_PROXY_HOPS (1) for direct route-handler calls', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': 'spoofed, 203.0.113.5' },
    })
    try {
      process.env.TRUSTED_PROXY_HOPS = '1'
      expect(getClientIp(req)).toBe('203.0.113.5')
    } finally {
      delete process.env.TRUSTED_PROXY_HOPS
    }
  })
})
