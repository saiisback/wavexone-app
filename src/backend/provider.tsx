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
  /** Mounted queries, told when `useInvalidateQueries` drops their key. */
  listeners: Set<(prefixes: readonly string[]) => void>
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
    listeners: new Set(),
  }), [backend])
  return <BackendContext value={value}>{children}</BackendContext>
}

export function useBackend(): WaveXBackend {
  const context = use(BackendContext)
  if (!context) throw new Error('useBackend must be used inside <BackendProvider>')
  return context.backend
}

/**
 * Re-reads every mounted query whose key starts with one of the prefixes.
 *
 * Call it after a mutation is acknowledged, never before and never on
 * failure: an unconfirmed mutation leaves the server state unknown, and the
 * user is told to check rather than shown a re-read that may predate it.
 */
export function useInvalidateQueries(): (...prefixes: string[]) => void {
  const context = use(BackendContext)
  if (!context) throw new Error('useInvalidateQueries must be used inside <BackendProvider>')
  return (...prefixes) => {
    for (const key of [...context.queries.keys()]) {
      if (prefixes.some((prefix) => key.startsWith(prefix))) context.queries.delete(key)
    }
    context.listeners.forEach((listener) => listener(prefixes))
  }
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

  // Bumped when an acknowledged mutation invalidates this key. The previous
  // data stays on screen until the re-read settles.
  const [generation, setGeneration] = useState(0)
  useEffect(() => {
    const listener = (prefixes: readonly string[]) => {
      if (prefixes.some((prefix) => key.startsWith(prefix))) setGeneration((value) => value + 1)
    }
    context.listeners.add(listener)
    return () => {
      context.listeners.delete(listener)
    }
  }, [key, context])

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
  }, [key, context, generation])

  // A result from the previous key is another instrument's numbers. Report
  // loading rather than showing them under the new heading.
  return state.key === key ? state : { status: 'loading' }
}
