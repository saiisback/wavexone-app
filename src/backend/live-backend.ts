import { ClientPortalAdapter } from './adapters/client-portal'
import { TradingApiAdapter } from './adapters/trading-api'
import type { WaveXBackend } from './contract'
import type { Account, ActivityEntry, Instrument, Position, Profile } from '../data/types'
import { BackendError } from './errors'
import { Gate, type BackendConfig } from './gate'
import { unwrapEnvelope } from './http'
import type { PortalBootstrap } from './responses/portal'
import { parseTradingAccounts } from './responses/trading'
import { createSessionStore, type SessionMaterial, type SessionStore } from './secure-session-store'

/**
 * The real backend.
 *
 * Authentication and Phase 1 reads follow the live-tested 2026-10-02 API
 * reference. Transport quirks stay below this seam: account-token identity,
 * bare arrays/maps, stringified favorites, nullable zero counts, prefixed
 * watch symbols, and portal envelopes are all converted to domain types here.
 * State-changing Phase 2/3 operations remain gated until explicitly enabled.
 */

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

    return portalData.accounts.map((portalAccount) => {
      const tradingAccount = tradingAccounts.find((account) =>
        portalAccount.identifiers.includes(account.id),
      )
      const balance = tradingAccount?.balance ?? portalAccount.balance
      const floatingPnl = portalAccount.equity - balance
      const changePercent =
        balance === 0 ? 0 : (floatingPnl / balance) * 100

      return {
        id: portalAccount.id,
        mode: tradingAccount?.mode ?? (portalAccount.isDemo ? 'DEMO' : 'LIVE'),
        number: portalAccount.number,
        currency: portalAccount.currency,
        leverage: portalAccount.leverage,
        equity: portalAccount.equity,
        balance,
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
    const metadataBySymbol = normalizeSymbolMap(raw.metadata)
    const snapshotsBySymbol = normalizeSymbolMap(raw.snapshots)
    return raw.catalogue.flatMap((entry) => {
      const plainTicker = apiSymbol(entry.ticker)
      const normalizedTicker = plainTicker.toUpperCase()
      const metadata = metadataBySymbol.get(normalizedTicker)
      const snapshot = snapshotsBySymbol.get(normalizedTicker)
      if (!metadata || !snapshot) return []
      const price = (snapshot.bid + snapshot.ask) / 2
      return [{
        id: entry.ticker.toLowerCase(),
        symbol: formatSymbol(plainTicker),
        name: entry.name,
        description: entry.name,
        icon: instrumentIcon(plainTicker),
        iconLabel: plainTicker.slice(0, 1),
        price,
        precision: metadata.precision,
        changePercent: snapshot.open === 0 ? 0 : ((price - snapshot.open) / snapshot.open) * 100,
        bid: snapshot.bid,
        ask: snapshot.ask,
        spark: [snapshot.open, snapshot.low, snapshot.high, price],
        category: entry.category,
        favorite: false,
        contractSize: metadata.lot,
      }]
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

  async function orderFingerprint(): Promise<string> {
    const session = requireSession()
    if (session.orderFingerprint?.endsWith(`_${session.accountToken}`)) {
      return session.orderFingerprint
    }
    const fingerprint = await trading.issueOrderFingerprint(session, session.accountToken)
    const updated = { ...session, orderFingerprint: fingerprint }
    material = updated
    await store.write(updated)
    return fingerprint
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
        const tradingResponse = await gate.call('switchAccountTrading', {
          query: { token: session.accountToken, switchtoken: request.accountId },
          headers: trading.headers(session),
          idempotencyKey: request.idempotencyKey,
        })
        unwrapEnvelope(tradingResponse, 'switchAccountTrading')

        const portalResponse = await gate.call('switchAccountPortal', {
          body: { token: request.accountId },
          idempotencyKey: request.idempotencyKey,
        })
        unwrapEnvelope(portalResponse, 'switchAccountPortal')

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
      async candles() {
        throw new BackendError(
          'blocked',
          'Historical charts are unavailable until WaveXOne provides the supported mobile candle-feed contract.',
          { endpoint: 'chartBars' },
        )
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
      async place(request) {
        const session = requireSession()
        await trading.placeOrder(session, request, await orderFingerprint())
      },
      async modify(request) {
        const session = requireSession()
        await trading.modifyOrder(session, request, await orderFingerprint())
      },
      async cancel(request) {
        const session = requireSession()
        await trading.cancelOrder(session, request, await orderFingerprint())
      },
      async close(request) {
        const session = requireSession()
        await trading.closeOrder(session, request, await orderFingerprint())
      },
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
      async sendWithdrawalOtp(request) {
        return portal.sendWithdrawalOtp(requireSession(), request)
      },
      async deposit(request) {
        return portal.deposit(requireSession(), request)
      },
      async requestWithdrawal(request) {
        return portal.withdraw(requireSession(), request)
      },
      async transfer(request) {
        return portal.transfer(requireSession(), request)
      },
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

function apiSymbol(ticker: string): string {
  return ticker.replace(/^[^:]+:/, '')
}

function normalizeSymbolMap<T>(entries: ReadonlyMap<string, T>): Map<string, T> {
  return new Map(
    Array.from(entries, ([symbol, value]) => [apiSymbol(symbol).toUpperCase(), value]),
  )
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
