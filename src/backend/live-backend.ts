import { z } from 'zod'

import { ClientPortalAdapter } from './adapters/client-portal'
import { TradingApiAdapter } from './adapters/trading-api'
import type { WaveXBackend } from './contract'
import { BackendError } from './errors'
import { Gate, type BackendConfig } from './gate'
import type { PortalBootstrap } from './responses/portal'
import { createSessionStore, type SessionMaterial, type SessionStore } from './secure-session-store'

/**
 * The real backend.
 *
 * Authentication is implemented in full, because guide §3 documents it step
 * by step. Most data calls are not, and the reason is now narrower than it
 * was: the supplied collections pin down every *request* — method, path,
 * parameter names — but carry no successful *response* anywhere. The trading
 * collection captured none across its 121 requests; the portal's 15 examples
 * are all unauthenticated 401s and empty 200s.
 *
 * So the field names inside a payload are still unknown, and inventing them
 * would produce code that compiles, reads plausibly, and shows the wrong
 * balance. Each method below refuses with the capture that would unblock it.
 *
 * `docs/RESPONSE-CAPTURES.md` lists those captures in one place.
 */

function needs(item: string, capture: string): never {
  throw new BackendError(
    'blocked',
    `Not wired yet: ${item}. Needs one captured response from ${capture} — see docs/RESPONSE-CAPTURES.md.`,
  )
}

/** The one response shape guide §2 documents: open, pending and total counts. */
const countsSchema = z
  .object({
    open: z.coerce.number(),
    pending: z.coerce.number(),
    total: z.coerce.number(),
  })
  .partial()

export function createLiveBackend(config: BackendConfig): WaveXBackend {
  const gate = new Gate(config)
  const trading = new TradingApiAdapter(gate)
  const portal = new ClientPortalAdapter(gate)
  const store: SessionStore = createSessionStore()

  /** In-memory copy of what the keychain holds, so reads are not async-chatty. */
  let material: SessionMaterial | null = null
  let bootstrap: PortalBootstrap | null = null

  function invalidateSessionData(): void {
    bootstrap = null
    portal.reset()
  }

  async function readBootstrap(): Promise<PortalBootstrap> {
    if (bootstrap) return bootstrap
    const loaded = await portal.readBootstrap(requireSession())
    bootstrap = loaded
    return loaded
  }

  function requireSession(): SessionMaterial {
    if (!material) {
      throw new BackendError('auth', 'You are signed out.')
    }
    return material
  }

  return {
    session: {
      async signIn(email, password) {
        const footprint = await store.footprint()
        const outcome = await trading.signIn(email, password, footprint)

        if (outcome.kind === 'verification-required') {
          return { kind: 'verification-required' }
        }

        material = outcome.material
        try {
          await readBootstrap()
          await store.write(outcome.material)
        } catch (error) {
          material = null
          invalidateSessionData()
          throw error
        }
        return { kind: 'authenticated' }
      },

      async restore() {
        const stored = await store.read()
        if (!stored) return false

        // A stored bearer is not a valid session. Guide §3.1 step 6 exists
        // precisely so the app can tell the difference before showing a
        // balance that is hours stale.
        if (await trading.isSessionValid(stored)) {
          material = stored
          await readBootstrap()
          return true
        }

        try {
          await this.refresh()
          await readBootstrap()
          return true
        } catch {
          await this.signOut()
          return false
        }
      },

      async refresh() {
        const stored = material ?? (await store.read())
        if (!stored) throw new BackendError('auth', 'You are signed out.')

        const bearerToken = await trading.issueBearer(
          stored.accountToken,
          stored.secretKey,
          stored.footprint,
        )
        const refreshed: SessionMaterial = {
          ...stored,
          bearerToken,
          issuedAt: new Date().toISOString(),
        }
        material = refreshed
        await store.write(refreshed)
      },

      async signOut() {
        // Guide §3.3: "Clear all stored session material on logout."
        material = null
        invalidateSessionData()
        await store.clear()
      },
    },

    accounts: {
      summary: async () => needs('account summary', 'collect=accountList'),
      list: async () => needs('account list', 'collect=accountList'),
      async switchAccount() {
        // The request is known (`collect=switchAccount&token=…&switchtoken=…`),
        // but guide §4.2 lists a portal `switchAccount` too and §7.7 asks
        // which one wins. Picking wrong desynchronises the two sessions.
        needs('account switching', 'both switchAccount routes, plus a decision on which to use')
      },
      profile: async () => needs('profile', 'apiBootstrap'),
    },

    markets: {
      // Guide §7.11 (precision, lot step, margin rules per instrument) is
      // still outstanding on top of the capture.
      catalogue: async () => needs('market catalogue', 'collect=mwatch and collect=symbolSpreadApp'),
      favorites: async () => needs('favorites', 'collect=getfav'),
      setFavorite: async () => needs('favorite toggle', 'collect=updateFavorite'),
      // Guide §7.5: no live-quote transport is documented at all. A capture
      // does not unblock this one — the subscription contract is missing.
      quoteSnapshot: async () =>
        needs('live quotes', 'the live-price WebSocket or polling spec (guide §7.5)'),
      candles: async () => needs('chart history', 'watchlist_charting on the charting host'),
    },

    orders: {
      async counts() {
        const session = requireSession()
        // `orderscount` takes the account token and nothing else — the token
        // *is* the account. Switching accounts means re-issuing the session
        // (`switchAccount`), not passing an id alongside.
        const body = await gate.callJson('ordersCount', {
          query: { token: session.accountToken },
          headers: trading.headers(session),
        })

        const parsed = countsSchema.safeParse(body)
        if (!parsed.success) {
          throw new BackendError('malformed', 'Order counts came back in an unexpected shape.', {
            endpoint: 'ordersCount',
          })
        }
        return {
          open: parsed.data.open ?? 0,
          pending: parsed.data.pending ?? 0,
          total: parsed.data.total ?? 0,
        }
      },

      // Guide §7.2 also asks for an account that actually holds an open
      // position, since an empty list teaches nothing about the row shape.
      list: async () => needs('open positions', 'collect=orders on a funded account'),
      history: async () => needs('closed history', 'collect=history_of_closed_orders'),
      // These four are phase 2 regardless of any capture: guide §7.3 requires
      // written authorization before a trading mutation runs anywhere.
      place: async () => needs('order placement', 'written authorization (guide §7.3)'),
      modify: async () => needs('order modification', 'written authorization (guide §7.3)'),
      cancel: async () => needs('order cancellation', 'written authorization (guide §7.3)'),
      close: async () => needs('position close', 'written authorization (guide §7.3)'),
    },

    funds: {
      configuration: async () => needs('funding configuration', 'apiRedeemConfig'),
      // Phase 3, and guide §7.4 requires methods that cannot move real money.
      deposit: async () => needs('deposit submission', 'a non-live test method (guide §7.4)'),
      requestWithdrawal: async () =>
        needs('withdrawal', 'a non-live test method (guide §7.4)'),
      transfer: async () => needs('transfer', 'a non-live test method (guide §7.4)'),
      history: async () => needs('funding history', 'collect=payout_in_out'),
    },

    engagement: {
      notifications: async () => needs('notifications', 'apiNotifications'),
      markNotificationsRead: async () => needs('notification read state', 'apiNotificationsRead'),
    },
  }
}
