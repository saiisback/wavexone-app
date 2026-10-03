import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'

import { BackendError, userMessageFor } from './errors'
import { useBackend, useClearBackendQueries } from './provider'
import type { WaveXBackend } from './contract'
import { useSession } from '../data/store'

export type AppSessionState =
  | 'restoring'
  | 'signed-out'
  | 'verification-required'
  | 'signed-in'
  | 'maintenance'

export type AppSessionContextValue = {
  state: AppSessionState
  error: string | null
  signIn(identifier: string, password: string): Promise<void>
  signOut(): Promise<void>
  retryRestore(): Promise<void>
}

const SessionContext = createContext<AppSessionContextValue | null>(null)

type SessionSnapshot = {
  state: AppSessionState
  error: string | null
}

function failureSnapshot(error: unknown): SessionSnapshot {
  if (error instanceof BackendError) {
    return {
      state: error.kind === 'server' ? 'maintenance' : 'signed-out',
      error: userMessageFor(error),
    }
  }
  return { state: 'signed-out', error: 'Something went wrong. Try again.' }
}

async function restoredSnapshot(backend: WaveXBackend): Promise<SessionSnapshot> {
  try {
    const restored = await backend.session.restore()
    return { state: restored ? 'signed-in' : 'signed-out', error: null }
  } catch (error) {
    return failureSnapshot(error)
  }
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const backend = useBackend()
  const clearQueries = useClearBackendQueries()
  const [sessionGeneration, setSessionGeneration] = useState(0)
  const resetSessionData = useCallback(() => {
    clearQueries()
    useSession.setState(useSession.getInitialState())
    // Also discard hook-local data if React batches logout and login without
    // ever committing the signed-out gate. The backend itself stays alive.
    setSessionGeneration((generation) => generation + 1)
  }, [clearQueries])
  const [snapshot, setSnapshot] = useState<SessionSnapshot>({
    state: 'restoring',
    error: null,
  })
  const mounted = useRef(true)
  const signingIn = useRef(false)

  useEffect(() => {
    return () => {
      mounted.current = false
    }
  }, [])

  useEffect(() => {
    let active = true
    void restoredSnapshot(backend).then((next) => {
      if (active) {
        resetSessionData()
        setSnapshot(next)
      }
    })
    return () => {
      active = false
    }
  }, [backend, resetSessionData])

  const retryRestore = useCallback(async () => {
    setSnapshot({ state: 'restoring', error: null })
    resetSessionData()
    const next = await restoredSnapshot(backend)
    if (mounted.current) setSnapshot(next)
  }, [backend, resetSessionData])

  const signIn = useCallback(
    async (identifier: string, password: string) => {
      if (signingIn.current) return
      signingIn.current = true
      setSnapshot({ state: 'restoring', error: null })
      resetSessionData()
      try {
        const result = await backend.session.signIn(identifier, password)
        if (mounted.current) {
          setSnapshot({
            state: result.kind === 'authenticated' ? 'signed-in' : 'verification-required',
            error: null,
          })
        }
      } catch (error) {
        if (mounted.current) setSnapshot(failureSnapshot(error))
      } finally {
        signingIn.current = false
      }
    },
    [backend, resetSessionData],
  )

  const signOut = useCallback(async () => {
    // Hide private screens and discard local data even if remote logout fails.
    setSnapshot({ state: 'restoring', error: null })
    resetSessionData()
    try {
      await backend.session.signOut()
    } finally {
      if (mounted.current) setSnapshot({ state: 'signed-out', error: null })
    }
  }, [backend, resetSessionData])

  const value = useMemo<AppSessionContextValue>(
    () => ({ ...snapshot, signIn, signOut, retryRestore }),
    [retryRestore, signIn, signOut, snapshot],
  )

  return <SessionContext key={sessionGeneration} value={value}>{children}</SessionContext>
}

export function useAppSession(): AppSessionContextValue {
  const session = use(SessionContext)
  if (!session) throw new Error('useAppSession must be used inside <SessionProvider>')
  return session
}
