import { ClientPortalAdapter } from './adapters/client-portal'
import { TradingApiAdapter } from './adapters/trading-api'
import type { WaveXBackend } from './contract'
import { activityGroup } from '../data/activity-dates'
import type { MarketPeriod } from '../data/store'
import { CHART_REQUESTS, buildChartSeries } from '../data/chart-series'
import type { Account, ActivityEntry, Instrument, Position, Profile } from '../data/types'
import { instrumentIconLabel, instrumentMark } from '../design-system/instrument-marks'
import { BackendError } from './errors'
import { Gate, type BackendConfig } from './gate'
import { unwrapEnvelope } from './http'
import {
  createQuoteFeed,
  createTradingEvents,
  fetchCandles,
  fetchDayBars,
  fetchQuoteSnapshot,
  fetchSparklines,
} from './market-feed'
import type { PortalBootstrap } from './responses/portal'
import { parseTradingAccounts } from './responses/trading'
import { createSessionStore, type SessionMaterial, type SessionStore } from './secure-session-store'

function isLegacySwitchServerFailure(error: unknown): boolean {
  if (
    !(error instanceof BackendError) ||
    error.kind !== 'blocked' ||
    error.endpoint !== 'switchAccountTrading'
  ) {
    return false
  }
  return error.cause instanceof BackendError && error.cause.kind === 'server'
}

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

  const quotes = createQuoteFeed()
  const tradingEvents = createTradingEvents(() => material?.accountToken ?? null)

  function invalidateSessionData(): void {
    bootstrap = null
    markets = null
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

    const detailedAccounts = portalData.accounts.map((portalAccount) => {
      const tradingAccount = tradingAccounts.find((account) =>
        portalAccount.identifiers.includes(account.id) ||
        portalAccount.identifiers.includes(account.databaseId),
      )
      const balance = tradingAccount?.balance ?? portalAccount.balance
      const floatingPnl = portalAccount.equity - balance
      const changePercent =
        balance === 0 ? 0 : (floatingPnl / balance) * 100

      return {
        id: portalAccount.id,
        current: portalAccount.identifiers.includes(portalData.user.accountId),
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

    const linkedOnlyAccounts = tradingAccounts
      .filter((tradingAccount) =>
        !portalData.accounts.some((portalAccount) =>
          portalAccount.identifiers.includes(tradingAccount.id) ||
          portalAccount.identifiers.includes(tradingAccount.databaseId),
        ),
      )
      .map((tradingAccount) => ({
        id: tradingAccount.id,
        current:
          tradingAccount.id === session.accountToken ||
          tradingAccount.databaseId === portalData.user.accountId,
        mode: tradingAccount.mode,
        number: tradingAccount.databaseId,
        balance: tradingAccount.balance,
        summaryAvailable: false as const,
      }))

    return [...detailedAccounts, ...linkedOnlyAccounts]
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

  /**
   * One market load shared by every caller for a short while: the catalogue
   * and positions both need it, and the prices inside are only a starting
   * point — screens stream their own.
   */
  let markets: { accountToken: string; at: number; promise: Promise<Instrument[]> } | null = null

  function readMarkets(): Promise<Instrument[]> {
    const session = requireSession()
    if (
      markets &&
      markets.accountToken === session.accountToken &&
      Date.now() - markets.at < MARKETS_TTL_MS
    ) {
      return markets.promise
    }
    const promise = loadMarkets(session)
    const entry = { accountToken: session.accountToken, at: Date.now(), promise }
    markets = entry
    promise.catch(() => {
      if (markets === entry) markets = null
    })
    return promise
  }

  async function loadMarkets(session: SessionMaterial): Promise<Instrument[]> {
    const raw = await trading.marketData(session)
    const metadataBySymbol = normalizeSymbolMap(raw.metadata)

    // A market without precision and lot size cannot be priced or traded.
    const listed = raw.catalogue.flatMap((entry) => {
      const plainTicker = apiSymbol(entry.ticker)
      const metadata = metadataBySymbol.get(plainTicker.toUpperCase())
      return metadata ? [{ entry, plainTicker, metadata }] : []
    })
    const symbols = [...new Set(listed.map(({ plainTicker }) => feedSymbol(plainTicker)))]
    const [days, quotes] = await Promise.all([fetchDayBars(symbols), fetchQuoteSnapshot(symbols)])
    if (symbols.length > 0 && days.size === 0 && quotes.size === 0) {
      throw new BackendError('network', 'Could not reach the price feed.', { endpoint: 'ticks' })
    }

    return listed.flatMap(({ entry, plainTicker, metadata }) => {
      const day = days.get(feedSymbol(plainTicker))
      const quote = quotes.get(feedSymbol(plainTicker))
      const bid = quote?.bid ?? day?.close
      const ask = quote?.ask ?? day?.close
      // The feeds do not carry every listed market; one with no price is left out.
      if (bid === undefined || ask === undefined) return []
      const price = quote?.price ?? (bid + ask) / 2
      const open = day?.open
      return [{
        id: entry.ticker.toLowerCase(),
        symbol: formatSymbol(plainTicker),
        name: entry.name,
        description: entry.name,
        icon: instrumentMark(plainTicker, entry.category),
        iconLabel: instrumentIconLabel(plainTicker),
        price,
        precision: metadata.precision,
        changePercent: open ? ((price - open) / open) * 100 : 0,
        bid,
        ask,
        spark: day ? [day.open, day.low, day.high, price] : [price, price],
        category: entry.category,
        favorite: false,
        contractSize: metadata.lot,
        ...(open ? { dayOpen: open } : {}),
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
      // A market the price feed does not carry keeps the server's own numbers.
      const current = order.state === 'Pending'
        ? order.trigger ?? order.entry
        : instrument
          ? order.side === 'Buy' ? instrument.bid : instrument.ask
          : order.current ?? order.entry
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
          : instrument
            ? (current - order.entry) * order.lots * instrument.contractSize * direction
            : order.pnl ?? 0,
        state: order.state,
        ...(order.stopLoss === undefined ? {} : { stopLoss: order.stopLoss }),
        ...(order.takeProfit === undefined ? {} : { takeProfit: order.takeProfit }),
        ...(order.trigger === undefined ? {} : { trigger: order.trigger }),
        ...(order.time === undefined ? {} : { time: order.time }),
        // Reference: a market order is listed as pending until it fills.
        ...(order.state === 'Pending' && order.type === 'market' ? { executing: true } : {}),
        ...(order.busy ? { busy: true } : {}),
      }
    })
  }

  async function readHistory(): Promise<Position[]> {
    const history = await trading.closedOrders(requireSession())
    // Rejected and cancelled orders reach history without a fill, so they
    // carry no close price or P&L.
    return history.orders.map((order) => ({
      ...order,
      current: order.current ?? order.entry,
      pnl: order.pnl ?? 0,
    }))
  }

  async function readFundingHistory(): Promise<ActivityEntry[]> {
    const data = await readBootstrap()
    return data.transactions.map((transaction) => {
      const date = transaction.date ?? transaction.createdAt.slice(0, 10)
      return {
        id: transaction.id,
        kind: transaction.type.toLowerCase().includes('withdraw') ? 'withdrawal' : 'deposit',
        title: transaction.type,
        subtitle: transaction.status ?? transaction.method ?? '',
        date,
        time: transaction.time ?? transaction.createdAt.slice(11, 16),
        amount: transaction.amount,
        group: activityGroup(date),
        tab: 'Funds',
      }
    })
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
        tradingEvents.reset()
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
          tradingEvents.reset()
          return true
        }

        try {
          await this.refresh()
          await readBootstrap()
          tradingEvents.reset()
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
        tradingEvents.reset()
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
        let switched = { ...session, accountToken: request.accountId, orderFingerprint: undefined }
        try {
          const tradingResponse = await gate.call('switchAccountTrading', {
            query: { token: session.accountToken, switchtoken: request.accountId },
            headers: trading.headers(session),
            idempotencyKey: request.idempotencyKey,
          })
          unwrapEnvelope(tradingResponse, 'switchAccountTrading')
        } catch (error) {
          if (!isLegacySwitchServerFailure(error)) throw error

          // The production legacy route currently returns 500 for linked demo
          // accounts. Do not retry it. The documented collection uses one
          // user-scoped bearer across sibling account tokens, so validate the
          // target token with the existing session before changing local or
          // portal state. Issuing a bearer here would pair the target token
          // with the current account's secret and is correctly rejected.
          if (!(await trading.isSessionValid(switched))) {
            throw new BackendError('auth', 'The selected account could not be authenticated.', {
              endpoint: 'switchAccountTrading',
            })
          }
        }

        const portalResponse = await gate.call('switchAccountPortal', {
          body: { token: request.accountId },
          idempotencyKey: request.idempotencyKey,
        })
        unwrapEnvelope(portalResponse, 'switchAccountPortal')

        material = switched
        await store.write(switched)
        invalidateAccountData()
        tradingEvents.reset()
      },
      profile: readProfile,
      async saveProfile(request) {
        // The route also takes `name`. Resend the server's own value, never
        // the "WaveXOne client" display fallback, so saving a phone number
        // cannot rename the user.
        const holder = (await readBootstrap()).user.holder
        await portal.saveProfile(requireSession(), {
          ...(holder === undefined ? {} : { name: holder }),
          mobile: request.phone,
          idempotencyKey: request.idempotencyKey,
        })
        invalidateAccountData()
      },
      async openAccount(request) {
        await portal.openAccount(requireSession(), request)
        invalidateAccountData()
      },
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
        const request = CHART_REQUESTS[timeframe]
        const candles = await fetchCandles(feedSymbol(instrumentId), request.timeframe, request.limit)
        const series = buildChartSeries(candles, timeframe)
        if (!series) {
          throw new BackendError('rejected', 'There is no chart data for this period yet.', {
            endpoint: 'ohlcV2',
          })
        }
        return series
      },
      async sparklines(instrumentIds, period) {
        const bySymbol = await fetchSparklines(instrumentIds.map(feedSymbol), SPARK_REQUESTS[period])
        return new Map(instrumentIds.flatMap((id) => {
          const closes = bySymbol.get(feedSymbol(id))
          return closes ? [[id, closes] as const] : []
        }))
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
      // Each one drops the cached bootstrap once acknowledged, so the margin
      // and equity read next reflect the trade rather than the moment before.
      async place(request) {
        const session = requireSession()
        await trading.placeOrder(session, request, await orderFingerprint())
        invalidateAccountData()
      },
      async modify(request) {
        const session = requireSession()
        await trading.modifyOrder(session, request, await orderFingerprint())
        invalidateAccountData()
      },
      async cancel(request) {
        const session = requireSession()
        await trading.cancelOrder(session, request, await orderFingerprint())
        invalidateAccountData()
      },
      async close(request) {
        const session = requireSession()
        await trading.closeOrder(session, request, await orderFingerprint())
        invalidateAccountData()
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
      // Bootstrap carries balances and the transaction list, so it is stale
      // the moment one of these is acknowledged.
      async deposit(request) {
        const session = requireSession()
        const target = (await readBootstrap()).accounts.find((account) =>
          account.identifiers.includes(request.accountId),
        )
        if (target?.isDemo) {
          // `submitDemoDeposit` credits whichever account the portal session
          // has selected and takes no account parameter, so it is only safe
          // for the account the session is on.
          if (request.accountId !== session.accountToken) {
            throw new BackendError('blocked', 'Switch to this demo account before adding funds to it.', {
              endpoint: 'submitDemoDeposit',
            })
          }
          await portal.demoDeposit(session, {
            amount: request.amount,
            idempotencyKey: request.idempotencyKey,
          })
        } else {
          await portal.deposit(session, request)
        }
        invalidateAccountData()
      },
      async requestWithdrawal(request) {
        await portal.withdraw(requireSession(), request)
        invalidateAccountData()
      },
      async transfer(request) {
        if (request.fromAccountId === request.toAccountId) {
          throw new BackendError('rejected', 'Choose two different accounts for a transfer.')
        }
        await portal.transfer(requireSession(), request)
        invalidateAccountData()
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

    prices: {
      subscribe: (instrumentId, listener) => quotes.subscribe(feedSymbol(instrumentId), listener),
      latest: (instrumentId) => quotes.latest(feedSymbol(instrumentId)),
    },

    events: {
      // Balances live in the cached bootstrap, so it is stale once the
      // server says something changed.
      subscribe: (listener) => tradingEvents.subscribe((event) => {
        invalidateAccountData()
        listener(event)
      }),
    },
  }
}

/** Bars per Market Watch period: about a day, a week, a month and a year. */
const SPARK_REQUESTS: Record<MarketPeriod, { timeframe: string; limit: number }> = {
  Today: { timeframe: '15', limit: 96 },
  'This week': { timeframe: '60', limit: 120 },
  'This month': { timeframe: '240', limit: 132 },
  'This year': { timeframe: '1D', limit: 260 },
}

/** Market prices are a starting point (rows stream their own), so a short reuse is safe. */
const MARKETS_TTL_MS = 30_000

/** `c:xauusd` → `XAUUSD`, the form both chart feeds accept for every market. */
function feedSymbol(instrumentId: string): string {
  return apiSymbol(instrumentId).toUpperCase()
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
