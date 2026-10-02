import { createContext, use, useEffect, useMemo, useRef, useState } from 'react'

import { createBackend } from './index'
import type { WaveXBackend } from './contract'
import { BackendError, userMessageFor } from './errors'

/**
 * Gives the app exactly one backend instance.
 *
 * It matters that this is a single instance rather than a module singleton:
 * the duplicate-submission memo in `Gate` lives on the instance, so two
 * backends would mean two memos and a mutation could run twice.
 */

type BackendContextValue = {
  backend: WaveXBackend
  /** One promise per semantic query key, shared by every mounted consumer. */
  queries: Map<string, { promise: Promise<unknown>; consumers: number }>
}

const BackendContext = createContext<BackendContextValue | null>(null)

export function BackendProvider({
  children,
  backend,
}: {
  children: React.ReactNode
  /** Injected in tests; the app leaves it undefined. */
  backend?: WaveXBackend
}) {
  const value = useMemo<BackendContextValue>(() => ({
    backend: backend ?? createBackend(),
    queries: new Map(),
  }), [backend])
  return <BackendContext value={value}>{children}</BackendContext>
}

export function useBackend(): WaveXBackend {
  const context = use(BackendContext)
  if (!context) throw new Error('useBackend must be used inside <BackendProvider>')
  return context.backend
}

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ready'; data: T; error?: undefined }
  | { status: 'error'; data?: undefined; error: string }

/**
 * Minimal read hook.
 *
 * Reads only — there is no `useMutation` counterpart on purpose. Guide §6.4
 * forbids automatic retries on every mutating call, and the value of a
 * mutation hook is mostly the retry and refetch behaviour that would be
 * illegal here. Mutations go through `useBackend()` from an explicit handler.
 */
export function useBackendQuery<T>(
  key: string,
  read: (backend: WaveXBackend) => Promise<T>,
): QueryState<T> {
  const context = use(BackendContext)
  if (!context) throw new Error('useBackendQuery must be used inside <BackendProvider>')
  // The result carries the key it belongs to, so a stale one can be spotted
  // during render instead of being cleared by a second setState.
  const [state, setState] = useState<QueryState<T> & { key: string }>({
    status: 'loading',
    key,
  })

  // `read` is a fresh closure every render, so it cannot be a dependency
  // without refetching forever. `key` is what describes the read; changing it
  // is what should re-run one.
  const latestRead = useRef(read)
  useEffect(() => {
    latestRead.current = read
  })

  useEffect(() => {
    let cancelled = false

    // `Promise.resolve().then(…)` rather than calling `read` directly: a read
    // that throws synchronously would otherwise escape the rejection handler
    // below and surface as an error thrown from the effect, which is the one
    // failure this hook exists to turn into a message.
    let entry = context.queries.get(key) as
      | { promise: Promise<T>; consumers: number }
      | undefined
    if (!entry) {
      entry = {
        promise: Promise.resolve().then(() => latestRead.current(context.backend)),
        consumers: 0,
      }
      context.queries.set(key, entry)
    }
    entry.consumers += 1

    entry.promise
      .then(
      (data) => {
        if (!cancelled) setState({ status: 'ready', data, key })
      },
      (error: unknown) => {
        if (cancelled) return
        setState({
          status: 'error',
          // Guide §5: server wording is for diagnostics, not for the user.
          error:
            error instanceof BackendError
              ? userMessageFor(error)
              : 'Something went wrong. Try again.',
          key,
        })
      },
    )

    return () => {
      cancelled = true
      const current = context.queries.get(key)
      if (current !== entry) return
      current.consumers -= 1
      if (current.consumers === 0) context.queries.delete(key)
    }
  }, [key, context])

  // A result from the previous key is another instrument's numbers. Report
  // loading rather than showing them under the new heading.
  return state.key === key ? state : { status: 'loading' }
}
