import { describe, it, expect } from 'vitest'
import { sessionReducer, initialState } from '@/lib/session'
import type { Assessment, CheckpointResult, SessionState, Suggestion, Suggestions } from '@/lib/types'

const assessment: Assessment = {
  id: 'a1', name: 'Interactive Oral', type: 'interactive_oral', lane: 'lane1',
  description: '', documents: [], responses: {},
}

const checkpoint = (over: Partial<CheckpointResult> = {}): CheckpointResult => ({
  checkpointId: 'io-4-1', assessmentId: 'a1', aiRating: 'partial', aiReasoning: '',
  userRating: null, acceptedAI: false, ...over,
})

const suggestion = (over: Partial<Suggestion> = {}): Suggestion => ({
  id: 's1', text: 't', why: 'w', udlCodes: [], ...over,
})

describe('sessionReducer', () => {
  it('returns the current state for an unknown action', () => {
    const state = { ...initialState, auditNotes: 'keep' }
    // @ts-expect-error - exercising the default branch with an invalid action
    expect(sessionReducer(state, { type: 'NOPE' })).toBe(state)
  })

  it('HYDRATE replaces the whole state', () => {
    const hydrated: SessionState = { assessments: [assessment], checkpoints: [], suggestions: null, auditNotes: 'x' }
    expect(sessionReducer(initialState, { type: 'HYDRATE', state: hydrated })).toEqual(hydrated)
  })

  it('SET_ASSESSMENTS / SET_CHECKPOINTS / SET_AUDIT_NOTES set their slice and preserve the rest', () => {
    let s = sessionReducer(initialState, { type: 'SET_ASSESSMENTS', assessments: [assessment] })
    expect(s.assessments).toEqual([assessment])
    s = sessionReducer(s, { type: 'SET_CHECKPOINTS', checkpoints: [checkpoint()] })
    expect(s.checkpoints).toHaveLength(1)
    s = sessionReducer(s, { type: 'SET_AUDIT_NOTES', notes: 'hello' })
    expect(s.auditNotes).toBe('hello')
    expect(s.assessments).toEqual([assessment]) // untouched
  })

  describe('UPDATE_CHECKPOINT', () => {
    const base: SessionState = {
      ...initialState,
      checkpoints: [
        checkpoint({ checkpointId: 'io-4-1', assessmentId: 'a1' }),
        checkpoint({ checkpointId: 'io-4-1', assessmentId: 'a2' }), // same checkpoint, other assessment
      ],
    }

    it('updates only the row matching BOTH ids', () => {
      const s = sessionReducer(base, {
        type: 'UPDATE_CHECKPOINT', checkpointId: 'io-4-1', assessmentId: 'a1', userRating: 'met', acceptedAI: true,
      })
      expect(s.checkpoints[0]).toMatchObject({ userRating: 'met', acceptedAI: true })
      expect(s.checkpoints[1]).toMatchObject({ userRating: null, acceptedAI: false }) // a2 untouched
    })
  })

  describe('SET_SUGGESTIONS (the regenerate merge)', () => {
    it('sets directly when there are no prior suggestions', () => {
      const next: Suggestions = { quickWins: [suggestion({ id: 'ai1' })], longerTerm: [] }
      const s = sessionReducer(initialState, { type: 'SET_SUGGESTIONS', suggestions: next })
      expect(s.suggestions).toEqual(next)
    })

    it('replaces AI items but preserves user-authored ones across regenerate', () => {
      const prior: SessionState = {
        ...initialState,
        suggestions: {
          quickWins: [suggestion({ id: 'ai-old' }), suggestion({ id: 'mine', userAuthored: true })],
          longerTerm: [suggestion({ id: 'lt-mine', userAuthored: true })],
        },
      }
      const regenerated: Suggestions = {
        quickWins: [suggestion({ id: 'ai-new' })],
        longerTerm: [suggestion({ id: 'lt-ai-new' })],
      }
      const s = sessionReducer(prior, { type: 'SET_SUGGESTIONS', suggestions: regenerated })

      // New AI items come first, the user's own writing is appended and survives;
      // the old AI item is gone.
      expect(s.suggestions!.quickWins.map(x => x.id)).toEqual(['ai-new', 'mine'])
      expect(s.suggestions!.longerTerm.map(x => x.id)).toEqual(['lt-ai-new', 'lt-mine'])
    })
  })

  describe('UPDATE_SUGGESTION', () => {
    it('patches the matching id in either bucket', () => {
      const start: SessionState = {
        ...initialState,
        suggestions: { quickWins: [suggestion({ id: 'q1' })], longerTerm: [suggestion({ id: 'l1' })] },
      }
      let s = sessionReducer(start, { type: 'UPDATE_SUGGESTION', id: 'q1', patch: { dismissed: true } })
      expect(s.suggestions!.quickWins[0].dismissed).toBe(true)
      s = sessionReducer(s, { type: 'UPDATE_SUGGESTION', id: 'l1', patch: { done: true } })
      expect(s.suggestions!.longerTerm[0].done).toBe(true)
    })

    it('is a no-op when there are no suggestions', () => {
      const s = sessionReducer(initialState, { type: 'UPDATE_SUGGESTION', id: 'x', patch: { done: true } })
      expect(s).toBe(initialState)
    })
  })

  describe('ADD_SUGGESTION', () => {
    it('creates the bucket when there are no suggestions yet', () => {
      const s = sessionReducer(initialState, { type: 'ADD_SUGGESTION', bucket: 'quickWins', suggestion: suggestion({ id: 'new' }) })
      expect(s.suggestions).toEqual({ quickWins: [suggestion({ id: 'new' })], longerTerm: [] })
    })

    it('appends to the named bucket when suggestions exist', () => {
      const start: SessionState = {
        ...initialState,
        suggestions: { quickWins: [suggestion({ id: 'q1' })], longerTerm: [] },
      }
      const s = sessionReducer(start, { type: 'ADD_SUGGESTION', bucket: 'quickWins', suggestion: suggestion({ id: 'q2' }) })
      expect(s.suggestions!.quickWins.map(x => x.id)).toEqual(['q1', 'q2'])
    })
  })

  it('RESET returns the initial state', () => {
    const dirty: SessionState = { assessments: [assessment], checkpoints: [checkpoint()], suggestions: { quickWins: [suggestion()], longerTerm: [] }, auditNotes: 'notes' }
    expect(sessionReducer(dirty, { type: 'RESET' })).toEqual(initialState)
  })
})
