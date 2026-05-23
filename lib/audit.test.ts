import { describe, it, expect, afterEach } from 'vitest'
import {
  validatePrefill,
  validateSuggestions,
  validateExtract,
  runPrefill,
  runSuggestions,
  runExtract,
} from '@/lib/audit'
import { _setTransport, _resetTransport } from '@/lib/llm'
import type { Assessment, CheckpointResult } from '@/lib/types'

afterEach(() => _resetTransport())

const assessment: Assessment = {
  id: 'a1',
  name: 'Interactive Oral',
  type: 'interactive_oral',
  lane: 'lane1',
  description: '',
  documents: [],
  responses: {},
}

describe('validatePrefill', () => {
  it('maps items and defaults user fields', () => {
    const out = validatePrefill(
      [{ checkpointId: 'io-4-1', assessmentId: 'a1', rating: 'met', reasoning: 'clear' }],
      { strict: true },
    )
    expect(out).toEqual([{
      checkpointId: 'io-4-1', assessmentId: 'a1', aiRating: 'met', aiReasoning: 'clear',
      userRating: null, acceptedAI: false,
    }])
  })

  it('coerces an unknown rating to not_yet in both modes', () => {
    const item = [{ checkpointId: 'io-4-1', assessmentId: 'a1', rating: 'excellent' }]
    expect(validatePrefill(item, { strict: true })[0].aiRating).toBe('not_yet')
    expect(validatePrefill(item, { strict: false })[0].aiRating).toBe('not_yet')
  })

  it('throws on a non-array when strict', () => {
    expect(() => validatePrefill({}, { strict: true })).toThrow()
    expect(validatePrefill({}, { strict: false })).toEqual([])
  })

  it('drops id-less items when lenient, throws when strict', () => {
    const items = [{ checkpointId: 'io-4-1' }]
    expect(validatePrefill(items, { strict: false })).toEqual([])
    expect(() => validatePrefill(items, { strict: true })).toThrow()
  })

  it('throws on an empty array when strict (a gap-rating call should not be empty)', () => {
    expect(() => validatePrefill([], { strict: true })).toThrow()
    expect(validatePrefill([], { strict: false })).toEqual([])
  })
})

describe('validateSuggestions', () => {
  it('keeps valid suggestions and assigns a server-side id', () => {
    const result = validateSuggestions(
      { quickWins: [{ text: 'do x', why: 'because', udlCodes: ['8.3'] }], longerTerm: [] },
      { strict: false },
    )
    expect(result.quickWins).toHaveLength(1)
    expect(result.quickWins[0]).toMatchObject({ text: 'do x', why: 'because', udlCodes: ['8.3'] })
    expect(typeof result.quickWins[0].id).toBe('string')
    expect(result.quickWins[0].id.length).toBeGreaterThan(0)
  })

  it('strips curation flags the model tries to inject', () => {
    const result = validateSuggestions(
      { quickWins: [{ text: 't', why: 'w', udlCodes: [], dismissed: true, done: true, userAuthored: true }], longerTerm: [] },
      { strict: false },
    )
    const s = result.quickWins[0] as unknown as Record<string, unknown>
    expect(s.dismissed).toBeUndefined()
    expect(s.done).toBeUndefined()
    expect(s.userAuthored).toBeUndefined()
  })

  it('drops malformed entries when lenient', () => {
    const result = validateSuggestions(
      {
        quickWins: [
          { text: 'ok', why: 'w', udlCodes: [] },
          { text: 'missing why', udlCodes: [] },
          { text: 'bad codes', why: 'w', udlCodes: [1] },
          'not an object',
        ],
        longerTerm: [],
      },
      { strict: false },
    )
    expect(result.quickWins).toHaveLength(1)
    expect(result.quickWins[0].text).toBe('ok')
  })

  it('returns empty buckets for non-object input when lenient', () => {
    expect(validateSuggestions(null, { strict: false })).toEqual({ quickWins: [], longerTerm: [] })
    expect(validateSuggestions('nope', { strict: false })).toEqual({ quickWins: [], longerTerm: [] })
  })

  it('defaults a missing bucket to an empty array', () => {
    expect(validateSuggestions({ quickWins: [{ text: 'a', why: 'b', udlCodes: [] }] }, { strict: false }))
      .toMatchObject({ longerTerm: [] })
  })

  it('throws when strict and a bucket is malformed or the result is empty', () => {
    expect(() => validateSuggestions({ quickWins: [{ text: 'a' }], longerTerm: [] }, { strict: true })).toThrow()
    expect(() => validateSuggestions({ quickWins: [], longerTerm: [] }, { strict: true })).toThrow()
  })
})

describe('validateExtract', () => {
  it('keeps valid candidates', () => {
    const out = validateExtract({ candidates: [{ title: 't', content: 'c' }] }, { strict: true })
    expect(out).toEqual([{ title: 't', content: 'c' }])
  })

  it('treats an empty candidates array as success even when strict', () => {
    expect(validateExtract({ candidates: [] }, { strict: true })).toEqual([])
  })

  it('throws on a missing/non-array candidates field when strict', () => {
    expect(() => validateExtract({}, { strict: true })).toThrow()
    expect(validateExtract({}, { strict: false })).toEqual([])
  })

  it('drops malformed candidates when lenient', () => {
    const out = validateExtract({ candidates: [{ title: 't', content: 'c' }, { title: 'no content' }] }, { strict: false })
    expect(out).toEqual([{ title: 't', content: 'c' }])
  })
})

describe('runSuggestions', () => {
  it('returns canned suggestions without calling the model when all checkpoints are Met', async () => {
    _setTransport(async () => { throw new Error('model should not be called') })
    const checkpoints: CheckpointResult[] = [
      { checkpointId: 'io-4-1', assessmentId: 'a1', aiRating: 'met', aiReasoning: '', userRating: 'met', acceptedAI: false },
    ]
    const result = await runSuggestions(checkpoints, [assessment])
    expect(result.quickWins.length).toBeGreaterThan(0)
    expect(result.quickWins[0].text).toContain('All checkpoints are rated Met')
  })

  it('calls the model when there are gaps', async () => {
    _setTransport(async () => JSON.stringify({
      quickWins: [{ text: 'add captions', why: 'access', udlCodes: ['2.4'] }],
      longerTerm: [],
    }))
    const checkpoints: CheckpointResult[] = [
      { checkpointId: 'io-2-4', assessmentId: 'a1', aiRating: 'not_yet', aiReasoning: '', userRating: null, acceptedAI: false },
    ]
    const result = await runSuggestions(checkpoints, [assessment])
    expect(result.quickWins[0].text).toBe('add captions')
  })
})

describe('runPrefill', () => {
  it('returns mapped checkpoint results from the model', async () => {
    _setTransport(async () => JSON.stringify([
      { checkpointId: 'io-4-1', assessmentId: 'a1', rating: 'partial', reasoning: 'some flexibility' },
    ]))
    const out = await runPrefill(assessment, [
      { id: 'io-4-1', def: { code: '4.1', principle: 'Action & Expression', guideline: 'Interaction', title: 'Vary methods', harmful: [], helpful: [] } },
    ])
    expect(out).toEqual([{
      checkpointId: 'io-4-1', assessmentId: 'a1', aiRating: 'partial', aiReasoning: 'some flexibility',
      userRating: null, acceptedAI: false,
    }])
  })
})

describe('runExtract', () => {
  it('returns candidates from a text document', async () => {
    _setTransport(async () => JSON.stringify({ candidates: [{ title: 'Final Report', content: 'Write a report.' }] }))
    const out = await runExtract({ text: 'some brief text' }, 'brief')
    expect(out).toEqual([{ title: 'Final Report', content: 'Write a report.' }])
  })

  it('returns an empty array when the document has no candidates', async () => {
    _setTransport(async () => JSON.stringify({ candidates: [] }))
    const out = await runExtract({ base64: 'AAAA' }, 'rubric')
    expect(out).toEqual([])
  })
})
