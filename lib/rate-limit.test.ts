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

  it('uses the first x-forwarded-for entry', () => {
    const req = new Request('http://localhost', {
      headers: { 'x-forwarded-for': '203.0.113.5, 10.0.0.1' },
    })
    expect(getClientIp(req)).toBe('203.0.113.5')
  })

  it('falls back to x-real-ip', () => {
    const req = new Request('http://localhost', { headers: { 'x-real-ip': '198.51.100.7' } })
    expect(getClientIp(req)).toBe('198.51.100.7')
  })

  it('returns "unknown" when no IP headers are present', () => {
    expect(getClientIp(new Request('http://localhost'))).toBe('unknown')
  })
})
