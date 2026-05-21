import { describe, it, expect } from 'vitest'
import { parseJsonResponse, getResponseText, sanitizeSuggestions } from '@/lib/llm'

describe('parseJsonResponse', () => {
  it('parses plain JSON', () => {
    expect(parseJsonResponse('{"a":1}')).toEqual({ a: 1 })
  })

  it('strips a ```json fence', () => {
    expect(parseJsonResponse('```json\n{"a":1}\n```')).toEqual({ a: 1 })
  })

  it('strips a bare ``` fence', () => {
    expect(parseJsonResponse('```\n[1,2,3]\n```')).toEqual([1, 2, 3])
  })

  it('trims surrounding whitespace', () => {
    expect(parseJsonResponse('   \n {"a":1}\n  ')).toEqual({ a: 1 })
  })

  it('throws on invalid JSON', () => {
    expect(() => parseJsonResponse('not json at all')).toThrow()
  })
})

describe('getResponseText', () => {
  it('returns the first text block', () => {
    expect(getResponseText([{ type: 'text', text: 'hello' }])).toBe('hello')
  })

  it('skips non-text blocks', () => {
    expect(getResponseText([{ type: 'tool_use' }, { type: 'text', text: 'hi' }])).toBe('hi')
  })

  it('throws when there is no text block', () => {
    expect(() => getResponseText([{ type: 'tool_use' }])).toThrow()
  })

  it('throws on empty content', () => {
    expect(() => getResponseText([])).toThrow()
  })
})

describe('sanitizeSuggestions', () => {
  it('keeps valid suggestions and assigns a server-side id', () => {
    const result = sanitizeSuggestions({
      quickWins: [{ text: 'do x', why: 'because', udlCodes: ['8.3'] }],
      longerTerm: [],
    })
    expect(result.quickWins).toHaveLength(1)
    expect(result.quickWins[0]).toMatchObject({ text: 'do x', why: 'because', udlCodes: ['8.3'] })
    expect(typeof result.quickWins[0].id).toBe('string')
    expect(result.quickWins[0].id.length).toBeGreaterThan(0)
  })

  it('strips curation flags the model tries to inject', () => {
    const result = sanitizeSuggestions({
      quickWins: [{ text: 't', why: 'w', udlCodes: [], dismissed: true, done: true, userAuthored: true }],
      longerTerm: [],
    })
    const s = result.quickWins[0] as unknown as Record<string, unknown>
    expect(s.dismissed).toBeUndefined()
    expect(s.done).toBeUndefined()
    expect(s.userAuthored).toBeUndefined()
  })

  it('drops malformed entries', () => {
    const result = sanitizeSuggestions({
      quickWins: [
        { text: 'ok', why: 'w', udlCodes: [] },
        { text: 'missing why', udlCodes: [] },
        { text: 'bad codes', why: 'w', udlCodes: [1] },
        'not an object',
      ],
      longerTerm: [],
    })
    expect(result.quickWins).toHaveLength(1)
    expect(result.quickWins[0].text).toBe('ok')
  })

  it('returns empty buckets for non-object input', () => {
    expect(sanitizeSuggestions(null)).toEqual({ quickWins: [], longerTerm: [] })
    expect(sanitizeSuggestions('nope')).toEqual({ quickWins: [], longerTerm: [] })
  })

  it('defaults a missing bucket to an empty array', () => {
    expect(sanitizeSuggestions({ quickWins: [{ text: 'a', why: 'b', udlCodes: [] }] }))
      .toMatchObject({ longerTerm: [] })
  })
})
