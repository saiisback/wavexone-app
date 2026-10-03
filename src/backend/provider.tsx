import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'

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
  /** One promise per semantic query key, shared by mounted and recent consumers. */
  queries: Map<string, QueryEntry<unknown>>
  /** Mounted queries, told when `useInvalidateQueries` drops their key. */
  listeners: Set<(prefixes: readonly string[]) => void>
}

type QueryEntry<T> = {
  promise: Promise<T>
  consumers: number
  status: 'pending' | 'fulfilled' | 'rejected'
  /** The settled data, so a screen returning to this key can render it at once. */
  value?: T
  settledAt?: number
  expiresAt?: number
  expiryTimer?: ReturnType<typeof setTimeout>
}

const RETAIN_COMPLETED_MS = 30_000
const disposedProviders = new WeakSet<BackendContextValue>()

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
  useEffect(() => {
    disposedProviders.delete(value)
    return () => {
      disposedProviders.add(value)
      value.queries.forEach((entry) => clearTimeout(entry.expiryTimer))
    }
  }, [value])
  return <BackendContext value={value}>{children}</BackendContext>
}

export function useBackend(): WaveXBackend {
  const context = use(BackendContext)
  if (!context) throw new Error('useBackend must be used inside <BackendProvider>')
  return context.backend
}

/**
 * Discards all reads at an authentication boundary. SessionProvider also
 * removes the signed-in consumers, so unlike mutation invalidation this must
 * not start background reads using credentials that are being replaced.
 */
export function useClearBackendQueries(): () => void {
  const context = use(BackendContext)
  if (!context) throw new Error('useClearBackendQueries must be used inside <BackendProvider>')
  return useCallback(() => {
    context.queries.forEach((entry) => clearTimeout(entry.expiryTimer))
    context.queries.clear()
  }, [context])
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
      if (prefixes.some((prefix) => key.startsWith(prefix))) {
        clearTimeout(context.queries.get(key)?.expiryTimer)
        context.queries.delete(key)
      }
    }
    context.listeners.forEach((listener) => listener(prefixes))
  }
}

export type QueryState<T> =
  | { status: 'loading'; data?: undefined; error?: undefined }
  | { status: 'ready'; data: T; error?: undefined }
  | {
      status: 'error'
      data?: undefined
      error: string
      /**
       * Reads the key again. Reads only, and only when a person asks — the
       * no-automatic-retry rule (guide §6.4) is about mutations.
       */
      retry?: () => void
    }

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
  // A key still in the cache renders its data on the first frame: going
  // back to a screen should never flash a loading state for data in memory.
  const [state, setState] = useState<QueryState<T> & { key: string }>(() => {
    const cached = context.queries.get(key) as QueryEntry<T> | undefined
    const fresh = cached?.status === 'fulfilled' && (cached.expiresAt === undefined || cached.expiresAt > Date.now())
    return fresh ? { status: 'ready', data: cached.value as T, key } : { status: 'loading', key }
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
    let entry = context.queries.get(key) as QueryEntry<T> | undefined
    if (entry?.expiresAt !== undefined && entry.expiresAt <= Date.now()) {
      clearTimeout(entry.expiryTimer)
      context.queries.delete(key)
      entry = undefined
    }
    if (!entry) {
      entry = {
        promise: Promise.resolve().then(() => latestRead.current(context.backend)),
        consumers: 0,
        status: 'pending',
      }
      context.queries.set(key, entry)
      const created = entry
      created.promise.then(
        (value) => {
          created.value = value
          created.status = 'fulfilled'
          created.settledAt = Date.now()
        },
        () => {
          created.status = 'rejected'
          created.settledAt = Date.now()
          if (context.queries.get(key) === created) context.queries.delete(key)
        },
      )
    }
    clearTimeout(entry.expiryTimer)
    entry.expiryTimer = undefined
    entry.expiresAt = undefined
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
      if (current.consumers !== 0) return
      if (current.status !== 'fulfilled' || disposedProviders.has(context)) {
        context.queries.delete(key)
        return
      }
      current.expiresAt = Date.now() + RETAIN_COMPLETED_MS
      current.expiryTimer = setTimeout(() => {
        if (context.queries.get(key) === current && current.consumers === 0) {
          context.queries.delete(key)
        }
      }, RETAIN_COMPLETED_MS)
    }
  }, [key, context, generation])

  // A failed read is never cached, so bumping the generation reads it afresh.
  const retry = useCallback(() => {
    setState({ status: 'loading', key })
    setGeneration((value) => value + 1)
  }, [key])

  // A result from the previous key is another instrument's numbers. Report
  // loading rather than showing them under the new heading.
  if (state.key !== key) {
    // Switching back to a key still in the cache (a timeframe, an account)
    // shows its data straight away rather than a loading state.
    const cached = context.queries.get(key) as QueryEntry<T> | undefined
    if (cached?.status === 'fulfilled' && 'value' in cached) return { status: 'ready', data: cached.value as T }
    return { status: 'loading' }
  }
  return state.status === 'error' ? { ...state, retry } : state
}
