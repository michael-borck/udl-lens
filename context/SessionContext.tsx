'use client'

import { createContext, useContext, useReducer, useEffect, useState, type ReactNode } from 'react'
import type { SessionState, SessionAction } from '@/lib/types'
import { sessionReducer, initialState } from '@/lib/session'

const STORAGE_KEY = 'udl-lens-session'

interface SessionContextValue {
  state: SessionState
  dispatch: React.Dispatch<SessionAction>
  hydrated: boolean
}

const SessionContext = createContext<SessionContextValue | null>(null)

// Thin wiring around the pure reducer (lib/session.ts): wire it to React state
// and persist to sessionStorage. The state machine itself lives in lib/session
// so it can be tested without mounting this provider.
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
