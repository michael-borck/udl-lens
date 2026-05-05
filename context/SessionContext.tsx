'use client'

import { createContext, useContext, useReducer, type ReactNode } from 'react'
import type { SessionState, SessionAction } from '@/lib/types'

const initialState: SessionState = {
  assessments: [],
  checkpoints: [],
  suggestions: null,
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
            ? {
                ...c,
                userRating: action.userRating,
                overridden: action.userRating !== c.aiRating,
              }
            : c
        ),
      }
    case 'SET_SUGGESTIONS':
      return { ...state, suggestions: action.suggestions }
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
