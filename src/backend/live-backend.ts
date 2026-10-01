import { ClientPortalAdapter } from './adapters/client-portal'
import { TradingApiAdapter } from './adapters/trading-api'
import type { WaveXBackend } from './contract'
import type { Account, ActivityEntry, Instrument, Position, Profile, Timeframe } from '../data/types'
import { BackendError } from './errors'
import { Gate, type BackendConfig } from './gate'
import type { PortalBootstrap } from './responses/portal'
import { parseTradingAccounts } from './responses/trading'
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

const chartLabel = new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' })

const chartOptions: Record<Timeframe, { resolution: string; count: number }> = {
  '1D': { resolution: '15', count: 96 },
  '5D': { resolution: '60', count: 120 },
  '1W': { resolution: '60', count: 168 },
  '1M': { resolution: 'D', count: 30 },
  '3M': { resolution: 'D', count: 90 },
  '6M': { resolution: 'D', count: 180 },
}

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

  function invalidateAccountData(): void {
    bootstrap = null
  }

  async function readBootstrap(): Promise<PortalBootstrap> {
    if (bootstrap) return bootstrap
    const loaded = await portal.readBootstrap(requireSession())
    bootstrap = loaded
    return loaded
  }

  async function readAccounts(): Promise<Account[]> {
    const session = requireSession()
    const portalData = await readBootstrap()
    const response = await gate.callJson('accountList', {
      query: { token: session.accountToken },
      headers: trading.headers(session),
    })

    let tradingAccounts: ReturnType<typeof parseTradingAccounts>
    try {
      tradingAccounts = parseTradingAccounts(response)
    } catch (cause) {
      throw new BackendError('malformed', 'Account list returned an unexpected shape.', {
        endpoint: 'accountList',
        cause,
      })
    }

    return tradingAccounts.map((tradingAccount) => {
      const portalAccount = portalData.accounts.find((account) => account.id === tradingAccount.id)
      if (!portalAccount) {
        throw new BackendError(
          'malformed',
          'An account was missing its portal balance details.',
          { endpoint: 'accountList' },
        )
      }

      const floatingPnl = portalAccount.equity - tradingAccount.balance
      const changePercent =
        tradingAccount.balance === 0 ? 0 : (floatingPnl / tradingAccount.balance) * 100

      return {
        id: tradingAccount.id,
        mode: tradingAccount.mode,
        number: portalAccount.number,
        currency: portalAccount.currency,
        leverage: portalAccount.leverage,
        equity: portalAccount.equity,
        balance: tradingAccount.balance,
        freeMargin: portalAccount.fund,
        changePercent,
        asOf: 'Current account snapshot',
        floatingPnl,
      }
    })
  }

  async function readProfile(): Promise<Profile> {
    const user = (await readBootstrap()).user
    return {
      holder: user.holder ?? 'WaveXOne client',
      avatarUrl: '',
      email: user.email ?? '',
      phone: user.phone ?? '',
      country: '',
      verified: user.verified,
      kycStatus: user.verified ? 'Verified' : 'Not started',
    }
  }

  async function readMarkets(): Promise<Instrument[]> {
    const raw = await trading.marketData(requireSession())
    return raw.catalogue.map((entry) => {
      const metadata = raw.metadata.get(entry.ticker)
      const snapshot = raw.snapshots.get(entry.ticker)
      if (!metadata || !snapshot || (metadata.precision !== 2 && metadata.precision !== 4)) {
        throw new BackendError('malformed', `Price snapshot unavailable for ${entry.ticker}.`, {
          endpoint: 'currentDayData',
        })
      }
      const price = (snapshot.bid + snapshot.ask) / 2
      return {
        id: entry.ticker.toLowerCase(),
        symbol: formatSymbol(entry.ticker),
        name: formatSymbol(entry.ticker),
        description: formatSymbol(entry.ticker),
        icon: instrumentIcon(entry.ticker),
        iconLabel: entry.ticker.slice(0, 1),
        price,
        precision: metadata.precision,
        changePercent: snapshot.open === 0 ? 0 : ((price - snapshot.open) / snapshot.open) * 100,
        bid: snapshot.bid,
        ask: snapshot.ask,
        spark: [snapshot.open, snapshot.low, snapshot.high, price],
        category: entry.category,
        favorite: false,
        contractSize: metadata.lot,
      }
    })
  }

  async function readPositions(): Promise<Position[]> {
    const [orders, markets] = await Promise.all([
      trading.openOrders(requireSession()),
      readMarkets(),
    ])
    const byId = new Map(markets.map((item) => [item.id, item]))
    return orders.map((order) => {
      const instrument = byId.get(order.instrumentId)
      if (!instrument) {
        throw new BackendError('malformed', `Missing quote for ${order.instrumentId}.`, {
          endpoint: 'orders',
        })
      }
      const current = order.state === 'Pending'
        ? order.trigger ?? order.entry
        : order.side === 'Buy' ? instrument.bid : instrument.ask
      const direction = order.side === 'Buy' ? 1 : -1
      return {
        id: order.id,
        instrumentId: order.instrumentId,
        side: order.side,
        lots: order.lots,
        entry: order.entry,
        current,
        pnl: order.state === 'Pending'
          ? 0
          : (current - order.entry) * order.lots * instrument.contractSize * direction,
        state: order.state,
      }
    })
  }

  async function readHistory(): Promise<Position[]> {
    const history = await trading.closedOrders(requireSession())
    return history.orders.map((order) => {
      if (order.current === undefined || order.pnl === undefined) {
        throw new BackendError('malformed', 'Closed order is missing its close price or P&L.', {
          endpoint: 'closedHistory',
        })
      }
      return { ...order, current: order.current, pnl: order.pnl }
    })
  }

  async function readFundingHistory(): Promise<ActivityEntry[]> {
    const data = await readBootstrap()
    return data.transactions.map((transaction) => ({
      id: transaction.id,
      kind: transaction.type.toLowerCase().includes('withdraw') ? 'withdrawal' : 'deposit',
      title: transaction.type,
      subtitle: transaction.status ?? transaction.method ?? '',
      date: transaction.date ?? transaction.createdAt.slice(0, 10),
      time: transaction.time ?? transaction.createdAt.slice(11, 16),
      amount: transaction.amount,
      group: 'Earlier',
      tab: 'Funds',
    }))
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
      async summary(accountId) {
        const account = (await readAccounts()).find((item) => item.id === accountId)
        if (!account) throw new BackendError('rejected', 'That account is no longer available.')
        return account
      },
      list: readAccounts,
      async switchAccount(request) {
        const session = requireSession()
        await gate.call('switchAccountTrading', {
          query: { token: session.accountToken, switchtoken: request.accountId },
          headers: trading.headers(session),
          idempotencyKey: request.idempotencyKey,
        })
        await gate.call('switchAccountPortal', {
          body: { token: request.accountId },
          idempotencyKey: request.idempotencyKey,
        })

        invalidateAccountData()
        await readBootstrap()

        const switched = { ...session, accountToken: request.accountId, orderFingerprint: undefined }
        material = switched
        await store.write(switched)
      },
      profile: readProfile,
    },

    markets: {
      catalogue: readMarkets,
      favorites: () => trading.favoriteIds(requireSession()),
      setFavorite: (request) => trading.setFavorite(requireSession(), request),
      async quoteSnapshot(instrumentIds) {
        const wanted = new Set(instrumentIds)
        return (await readMarkets()).filter((item) => wanted.has(item.id))
      },
      async candles(instrumentId, timeframe) {
        const option = chartOptions[timeframe]
        let history: Awaited<ReturnType<typeof trading.chart>>
        try {
          history = await trading.chart(requireSession(), instrumentId, option.resolution, option.count)
        } catch (cause) {
          if (cause instanceof BackendError) throw cause
          throw new BackendError('malformed', 'Chart history returned an unexpected shape.', {
            endpoint: 'chartBars',
            cause,
          })
        }
        if (history.closes.length === 0) {
          throw new BackendError('malformed', 'Chart history is empty.', { endpoint: 'chartBars' })
        }
        const min = Math.min(...history.lows)
        const max = Math.max(...history.highs)
        return {
          points: history.closes,
          labels: history.timestamps.map((timestamp) => chartLabel.format(new Date(timestamp * 1000))),
          cursorIndex: history.closes.length - 1,
          cursorOpen: history.opens.at(-1)!,
          cursorClose: history.closes.at(-1)!,
          min,
          max,
          step: (max - min) / 4 || 1,
        }
      },
    },

    orders: {
      async counts() {
        return trading.orderCounts(requireSession())
      },

      // Guide §7.2 also asks for an account that actually holds an open
      // position, since an empty list teaches nothing about the row shape.
      list: readPositions,
      history: readHistory,
      // These four are phase 2 regardless of any capture: guide §7.3 requires
      // written authorization before a trading mutation runs anywhere.
      place: async () => needs('order placement', 'written authorization (guide §7.3)'),
      modify: async () => needs('order modification', 'written authorization (guide §7.3)'),
      cancel: async () => needs('order cancellation', 'written authorization (guide §7.3)'),
      close: async () => needs('position close', 'written authorization (guide §7.3)'),
    },

    funds: {
      async configuration(accountId) {
        const config = await portal.fundingConfiguration(requireSession(), accountId)
        return {
          depositMethods: config.depositMethods.map((method) => method.name),
          withdrawalMethods: config.withdrawModes.map((method) => method.name),
          withdrawalFields: config.withdrawFields,
          quickAmounts: [config.minimumDeposit, config.minimumDeposit * 2, config.minimumDeposit * 5],
          kycStatus: config.kycVerified ? 'Verified' : 'Not started',
          availableFund: config.availableFund,
          minimumDeposit: config.minimumDeposit,
          minimumWithdrawal: config.minimumDeposit,
        }
      },
      // Phase 3, and guide §7.4 requires methods that cannot move real money.
      deposit: async () => needs('deposit submission', 'a non-live test method (guide §7.4)'),
      requestWithdrawal: async () =>
        needs('withdrawal', 'a non-live test method (guide §7.4)'),
      transfer: async () => needs('transfer', 'a non-live test method (guide §7.4)'),
      history: readFundingHistory,
    },

    engagement: {
      async notifications() {
        return (await portal.notifications(requireSession())).items
      },
      markNotificationsRead: (request) =>
        portal.markNotificationsRead(requireSession(), request),
    },
  }
}

function formatSymbol(ticker: string): string {
  return /^[A-Z]{6}$/.test(ticker) ? `${ticker.slice(0, 3)}/${ticker.slice(3)}` : ticker
}

function instrumentIcon(ticker: string): Instrument['icon'] {
  if (ticker.startsWith('XAU')) return 'gold'
  if (ticker.startsWith('XAG')) return 'silver'
  if (ticker.startsWith('BTC')) return 'bitcoin'
  if (ticker.startsWith('ETH')) return 'ethereum'
  if (ticker.startsWith('EUR')) return 'euro'
  if (ticker.includes('WTI') || ticker.includes('OIL')) return 'oil'
  return 'generic'
}
