'use client'

import { createContext, useContext, useReducer, useEffect, useState, type ReactNode } from 'react'
import type { SessionState, SessionAction, Suggestion } from '@/lib/types'

const STORAGE_KEY = 'udl-lens-session'

const initialState: SessionState = {
  assessments: [],
  checkpoints: [],
  suggestions: null,
  auditNotes: '',
}

function sessionReducer(state: SessionState, action: SessionAction): SessionState {
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

interface SessionContextValue {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  hydrated: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

export function SessionProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(sessionReducer, initialState)
  const [hydrated, setHydrated] = useState(false)

  // Restore any saved session once on mount. Client-side only, so the server and
  // the first client render both start from initialState (no hydration mismatch).
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem(STORAGE_KEY)
      if (saved) dispatch({ type: 'HYDRATE', state: JSON.parse(saved) as SessionState })
    } catch {
      // Unavailable or corrupt storage: start fresh.
    }
    setHydrated(true)
  }, [])

  // Persist on every change, but only after hydration so we never clobber saved
  // data with the empty initial state on the first pass. RESET stores the empty
  // state, which effectively clears it.
  useEffect(() => {
    if (!hydrated) return
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // Quota exceeded or unavailable: degrade to in-memory only.
    }
  }, [state, hydrated])

  return (
    <SessionContext.Provider value={{ state, dispatch, hydrated }}>
      {children}
    </SessionContext.Provider>
  )
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext)
  if (!ctx) throw new Error('useSession must be used inside SessionProvider')
  return ctx
}
