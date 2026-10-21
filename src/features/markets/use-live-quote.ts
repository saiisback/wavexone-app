import { useCallback, useEffect, useState, useSyncExternalStore } from 'react'

import { useBackend } from '../../backend/provider'
import type { Quote } from '../../data/live-quote'
import { useScreenFocus } from '../../navigation/use-screen-focus'

const noop = () => {}

/** Limit display work, not the feed: latest() still exposes every received tick. */
function coalescedSubscription(subscribe: (notify: () => void) => () => void, listener: () => void) {
  let last = -Infinity
  let timer: ReturnType<typeof setTimeout> | undefined
  const notify = () => {
    const remaining = 100 - (Date.now() - last)
    if (remaining <= 0) {
      if (timer !== undefined) clearTimeout(timer)
      timer = undefined
      last = Date.now()
      listener()
    } else if (timer === undefined) {
      timer = setTimeout(() => {
        timer = undefined
        last = Date.now()
        listener()
      }, remaining)
    }
  }
  const unsubscribe = subscribe(notify)
  return () => {
    unsubscribe()
    if (timer !== undefined) clearTimeout(timer)
  }
}

/**
 * The streamed quote for one instrument, or undefined until the first tick.
 * Each caller re-renders only when its own symbol moves.
 */
export function useLiveQuote(instrumentId: string | undefined): Quote | undefined {
  const backend = useBackend()
  const focused = useScreenFocus()
  const subscribe = useCallback(
    (listener: () => void) => (focused && instrumentId ? coalescedSubscription((notify) => backend.prices.subscribe(instrumentId, notify), listener) : noop),
    [backend, focused, instrumentId],
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
  const focused = useScreenFocus()
  const [version, setVersion] = useState(0)
  const key = [...new Set(instrumentIds)].sort().join(',')

  useEffect(() => {
    if (!focused || !key) return
    const bump = () => setVersion((value) => value + 1)
    return coalescedSubscription((notify) => {
      const unsubscribes = key.split(',').map((id) => backend.prices.subscribe(id, notify))
      return () => unsubscribes.forEach((unsubscribe) => unsubscribe())
    }, bump)
  }, [backend, focused, key])

  return version
}
