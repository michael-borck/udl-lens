import { describe, it, expect, afterEach } from 'vitest'
import {
  parseJsonResponse,
  getResponseText,
  completeJson,
  ModelCallError,
  _setTransport,
  _resetTransport,
} from '@/lib/llm'

afterEach(() => _resetTransport())

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

describe('completeJson', () => {
  const passthrough = (raw: unknown) => raw

  it('parses and returns a validated response', async () => {
    _setTransport(async () => '{"ok":true}')
    const result = await completeJson({ kind: 'prefill', prompt: 'p', maxTokens: 10, validate: passthrough })
    expect(result).toEqual({ ok: true })
  })

  it('strips a JSON fence before validating', async () => {
    _setTransport(async () => '```json\n{"a":1}\n```')
    const result = await completeJson({ kind: 'prefill', prompt: 'p', maxTokens: 10, validate: passthrough })
    expect(result).toEqual({ a: 1 })
  })

  it('runs the validator strictly until the final (lenient) attempt', async () => {
    let calls = 0
    const seenStrict: boolean[] = []
    _setTransport(async () => { calls++; return '{"x":1}' })
    const result = await completeJson({
      kind: 'prefill',
      prompt: 'p',
      maxTokens: 10,
      maxAttempts: 2,
      validate: (_raw, { strict }) => {
        seenStrict.push(strict)
        if (strict) throw new Error('strict reject')
        return 'salvaged'
      },
    })
    expect(result).toBe('salvaged')
    expect(calls).toBe(2)                // one transport call per attempt
    expect(seenStrict).toEqual([true, false]) // strict, then lenient
  })

  it('gives the model two strict tries when maxAttempts is 3', async () => {
    let calls = 0
    _setTransport(async () => { calls++; return '{"x":1}' })
    const seenStrict: boolean[] = []
    const result = await completeJson({
      kind: 'suggestions',
      prompt: 'p',
      maxTokens: 10,
      maxAttempts: 3,
      validate: (_raw, { strict }) => {
        seenStrict.push(strict)
        if (strict) throw new Error('reject')
        return 'ok'
      },
    })
    expect(result).toBe('ok')
    expect(seenStrict).toEqual([true, true, false])
    expect(calls).toBe(3)
  })

  it('throws ModelCallError carrying attempts and lastRaw when validation never succeeds', async () => {
    _setTransport(async () => '{"x":1}')
    let thrown: unknown
    try {
      await completeJson({
        kind: 'extract',
        prompt: 'p',
        maxTokens: 10,
        maxAttempts: 2,
        validate: () => { throw new Error('always reject') },
      })
    } catch (e) {
      thrown = e
    }
    expect(thrown).toBeInstanceOf(ModelCallError)
    const err = thrown as ModelCallError
    expect(err.attempts).toBe(2)
    expect(err.lastRaw).toBe('{"x":1}')
  })

  it('retries a transport failure, then succeeds', async () => {
    let calls = 0
    _setTransport(async () => {
      calls++
      if (calls < 2) throw new Error('network')
      return '{"ok":1}'
    })
    const result = await completeJson({ kind: 'prefill', prompt: 'p', maxTokens: 10, maxAttempts: 2, validate: passthrough })
    expect(result).toEqual({ ok: 1 })
    expect(calls).toBe(2)
  })

  it('throws ModelCallError when the response is never valid JSON', async () => {
    _setTransport(async () => 'not json')
    await expect(
      completeJson({ kind: 'prefill', prompt: 'p', maxTokens: 10, maxAttempts: 2, validate: passthrough }),
    ).rejects.toBeInstanceOf(ModelCallError)
  })
})
