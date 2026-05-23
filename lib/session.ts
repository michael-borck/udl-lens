import type { SessionState, SessionAction, Suggestion } from '@/lib/types'

// The session state machine, extracted from the React provider so the action
// union is the test surface: dispatch a sequence of actions and assert on the
// result, no provider mount required. This module is pure - persistence
// (sessionStorage) and React wiring stay in context/SessionContext.tsx.

export const initialState: SessionState = {
  assessments: [],
  checkpoints: [],
  suggestions: null,
  auditNotes: '',
}

export function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
    case 'HYDRATE':
      return action.state
    case 'SET_ASSESSMENTS':
      return { ...state, assessments: action.assessments }
    case 'SET_CHECKPOINTS':
      return { ...state, checkpoints: action.checkpoints }
    case 'UPDATE_CHECKPOINT':
      return {
        ...state,
        checkpoints: state.checkpoints.map(c =>
          c.checkpointId === action.checkpointId && c.assessmentId === action.assessmentId
            ? { ...c, userRating: action.userRating, acceptedAI: action.acceptedAI }
            : c
        ),
      }
    case 'SET_SUGGESTIONS': {
      // Preserve user-authored suggestions across regenerate: a button
      // labelled "Regenerate" should not silently destroy the user's
      // own writing. AI items are replaced; userAuthored items survive.
      const prior = state.suggestions
      if (!prior) return { ...state, suggestions: action.suggestions }
      const userAuthored = (list: Suggestion[]) => list.filter(s => s.userAuthored)
      return {
        ...state,
        suggestions: {
          quickWins: [...action.suggestions.quickWins, ...userAuthored(prior.quickWins)],
          longerTerm: [...action.suggestions.longerTerm, ...userAuthored(prior.longerTerm)],
        },
      }
    }
    case 'UPDATE_SUGGESTION': {
      if (!state.suggestions) return state
      const update = (list: Suggestion[]) =>
        list.map(s => s.id === action.id ? { ...s, ...action.patch } : s)
      return {
        ...state,
        suggestions: {
          quickWins: update(state.suggestions.quickWins),
          longerTerm: update(state.suggestions.longerTerm),
        },
      }
    }
    case 'ADD_SUGGESTION': {
      if (!state.suggestions) {
        return {
          ...state,
          suggestions: {
            quickWins: action.bucket === 'quickWins' ? [action.suggestion] : [],
            longerTerm: action.bucket === 'longerTerm' ? [action.suggestion] : [],
          },
        }
      }
      return {
        ...state,
        suggestions: {
          ...state.suggestions,
          [action.bucket]: [...state.suggestions[action.bucket], action.suggestion],
        },
      }
    }
    case 'SET_AUDIT_NOTES':
      return { ...state, auditNotes: action.notes }
    case 'RESET':
      return initialState
    default:
      return state
  }
}
