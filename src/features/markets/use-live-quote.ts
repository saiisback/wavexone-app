import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { useBackend } from '../../backend/provider'
import type { Quote } from '../../data/live-quote'

const noop = () => {}

/**
 * The streamed quote for one instrument, or undefined until the first tick.
 * Each caller re-renders only when its own symbol moves.
 */
export function useLiveQuote(instrumentId: string | undefined): Quote | undefined {
  const backend = useBackend()
  const subscribe = useCallback(
    (listener: () => void) => (instrumentId ? backend.prices.subscribe(instrumentId, listener) : noop),
    [backend, instrumentId],
  )
  const read = () => (instrumentId ? backend.prices.latest(instrumentId) : undefined)
  return useSyncExternalStore(subscribe, read, read)
}

/**
 * Re-renders whenever any of `instrumentIds` ticks, for totals that span
 * several rows (floating P&L). Read the quotes with `backend.prices.latest`.
 */
export function useLiveQuotesVersion(instrumentIds: readonly string[]): number {
  const backend = useBackend()
  const [version, setVersion] = useState(0)
  const key = [...new Set(instrumentIds)].sort().join(',')

  useEffect(() => {
    if (!key) return
    const bump = () => setVersion((value) => value + 1)
    const unsubscribes = key.split(',').map((id) => backend.prices.subscribe(id, bump))
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
  }, [backend, key])

  return version
}
