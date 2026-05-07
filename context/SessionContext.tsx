'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { SessionState, SessionAction, Suggestion } from '@/lib/types'

const initialState: SessionState = {
  assessments: [],
  checkpoints: [],
  suggestions: null,
  auditNotes: '',
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
  switch (action.type) {
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
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.suggestions }
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

interface SessionContextValue {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState)
  return (
    <SessionContext.Provider value={{ state, dispatch }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
