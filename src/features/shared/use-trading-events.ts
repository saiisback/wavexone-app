import { useEffect, useRef } from 'react'

import { useActionMenu } from '../../design-system'
import { useBackend, useInvalidateQueries } from '../../backend/provider'
import { AFTER_FUNDING, AFTER_TRADE } from './query-keys'

/** Bursts of events (fill + notification + equity) collapse into one re-read. */
const SETTLE_MS = 400

/**
 * Re-reads orders and balances when the trading stream says they changed —
 * a market order filling, a pending order triggering, a close completing.
 * Mounted once for the signed-in app.
 */
export function useTradingEvents() {
  const backend = useBackend()
  const invalidate = useInvalidateQueries()
  const showMenu = useActionMenu()
  // Held in refs so the subscription is made once, not on every render.
  const latest = useRef({ invalidate, showMenu })
  useEffect(() => {
    latest.current = { invalidate, showMenu }
  })

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined
    const pending = new Set<string>()

    const unsubscribe = backend.events.subscribe((event) => {
      for (const prefix of event.kind === 'orders' ? AFTER_TRADE : AFTER_FUNDING) pending.add(prefix)
      if (event.rejected) {
        latest.current.showMenu({
          title: 'Order rejected',
          message: event.message ?? 'The server could not execute the order. Nothing was opened.',
          options: [{ label: 'Got it' }],
        })
      }
      clearTimeout(timer)
      timer = setTimeout(() => {
        latest.current.invalidate(...pending)
        pending.clear()
      }, SETTLE_MS)
    })

    return () => {
      clearTimeout(timer)
      unsubscribe()
    }
  }, [backend])
}
