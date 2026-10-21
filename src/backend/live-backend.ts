import { ClientPortalAdapter } from './adapters/client-portal'
import { TradingApiAdapter } from './adapters/trading-api'
import type { WaveXBackend } from './contract'
import { activityGroup } from '../data/activity-dates'
import type { MarketPeriod } from '../data/store'
import { CHART_REQUESTS, buildChartSeries } from '../data/chart-series'
import type { Account, ActivityEntry, Instrument, Position, Profile } from '../data/types'
import { instrumentIconLabel, instrumentMark } from '../design-system/instrument-marks'
import { BackendError } from './errors'
import { parseManagedDirectory, parseManagedFollowing, parseManagedFollowers, parseManagedReport } from './managed-accounts'
import { Gate, type BackendConfig } from './gate'
import { unwrapEnvelope } from './http'
import {
  createQuoteFeed,
  createTradingEvents,
  fetchCandles,
  fetchQuoteSnapshot,
  fetchSparklines,
  type LiveQuote,
} from './market-feed'
import type { PortalBootstrap } from './responses/portal'
import {
  parseTradingAccounts,
  type MarketRecord,
  type SymbolMetadata,
  type TradingAccountDetail,
} from './responses/trading'
import { createSessionStore, type SessionMaterial, type SessionStore } from './secure-session-store'

/**
 * The trading API reports a `book` code ("a", "d", or a word) rather than the
 * Live / Demo label people read. Only an explicit demo code maps to DEMO.
 */
function accountMode(book: string): 'LIVE' | 'DEMO' {
  return /^d(emo)?$/i.test(book.trim()) ? 'DEMO' : 'LIVE'
}

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

type MarketDefinition = {
  entry: MarketRecord
  id: string
  plainTicker: string
  feedTicker: string
  metadata: SymbolMetadata
}

function pricedInstruments(
  listed: readonly MarketDefinition[],
  quotes: ReadonlyMap<string, LiveQuote>,
): Instrument[] {
  return listed.flatMap(({ entry, id, plainTicker, feedTicker, metadata }) => {
    const quote = quotes.get(feedTicker)
    if (!quote) return []
    return [{
      id,
      symbol: formatSymbol(plainTicker),
      name: entry.name,
      description: entry.name,
      icon: instrumentMark(plainTicker, entry.category),
      iconLabel: instrumentIconLabel(plainTicker),
      price: quote.price,
      precision: metadata.precision,
      changePercent: 0,
      bid: quote.bid,
      ask: quote.ask,
      spark: [quote.price, quote.price],
      category: entry.category,
      favorite: false,
      // symbolSpreadApp uses `spread` for units per lot and `lot` for
      // minimum order volume (AUDCAD: 100000 and 0.01 respectively).
      contractSize: metadata.spread,
    }]
  })
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
  let tradingAccountIds = new Map<string, string>()
  let definitions: { accountToken: string; promise: Promise<MarketDefinition[]> } | null = null

  const quotes = createQuoteFeed()
  const tradingEvents = createTradingEvents(() => material?.accountToken ?? null)

  function invalidateSessionData(): void {
    bootstrap = null
    markets = null
    definitions = null
    tradingAccountIds = new Map()
    portal.reset()
  }

  function invalidateAccountData(): void {
    bootstrap = null
    tradingAccountIds = new Map()
    markets = null
    definitions = null
  }

  async function readTradingAccounts(session: SessionMaterial) {
    const response = await gate.callJson('accountList', {
      query: { token: session.accountToken },
      headers: trading.headers(session),
    })

    try {
      const accounts = parseTradingAccounts(response)
      tradingAccountIds = new Map(accounts.map((account) => [account.id, account.databaseId]))
      return accounts
    } catch (cause) {
      throw new BackendError('malformed', 'Account list returned an unexpected shape.', {
        endpoint: 'accountList',
        cause,
      })
    }
  }

  async function resolveOrderAccountId(accountToken: string): Promise<string> {
    const known = tradingAccountIds.get(accountToken)
    if (known) return known

    const account = (await readTradingAccounts(requireSession())).find(
      (item) => item.id === accountToken,
    )
    if (!account) {
      throw new BackendError('rejected', 'That trading account is no longer available.', {
        endpoint: 'accountList',
      })
    }
    return account.databaseId
  }

  async function readBootstrap(): Promise<PortalBootstrap> {
    if (bootstrap) return bootstrap
    const loaded = await portal.readBootstrap(requireSession())
    bootstrap = loaded
    return loaded
  }

  async function readAccounts(): Promise<Account[]> {
    const session = requireSession()
    const [portalData, tradingAccounts, currentDetail] = await Promise.all([
      readBootstrap(),
      readTradingAccounts(session),
      readCurrentAccountDetail(session),
    ])

    const detailedAccounts = portalData.accounts.map((portalAccount) => {
      const tradingAccount = tradingAccounts.find((account) =>
        portalAccount.identifiers.includes(account.id) ||
        portalAccount.identifiers.includes(account.databaseId),
      )
      const current = portalAccount.identifiers.includes(portalData.user.accountId)
        || portalAccount.identifiers.includes(session.accountToken)
      const detail = current ? currentDetail : undefined
      const balance = detail?.balance ?? tradingAccount?.balance ?? portalAccount.balance
      const equity = detail?.equity ?? portalAccount.equity
      const freeMargin = detail ? detail.fund + detail.credit : portalAccount.fund
      const floatingPnl = equity - balance
      const changePercent = balance === 0 ? 0 : (floatingPnl / balance) * 100

      return {
        id: portalAccount.id,
        current,
        // The portal's flag is authoritative; the trading `book` is a routing code.
        mode: portalAccount.isDemo ? 'DEMO' : 'LIVE',
        number: portalAccount.number,
        currency: detail?.currency ?? portalAccount.currency,
        leverage: portalAccount.leverage,
        equity,
        balance,
        freeMargin,
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
        mode: accountMode(tradingAccount.mode),
        number: tradingAccount.databaseId,
        balance: tradingAccount.balance,
        summaryAvailable: false as const,
      }))

    return [...detailedAccounts, ...linkedOnlyAccounts]
  }

  async function readCurrentAccountDetail(session: SessionMaterial): Promise<TradingAccountDetail | undefined> {
    return trading.accountDetail(session)
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

  function readMarketDefinitions(session: SessionMaterial): Promise<MarketDefinition[]> {
    if (definitions?.accountToken === session.accountToken) return definitions.promise
    const promise = loadMarketDefinitions(session)
    const entry = { accountToken: session.accountToken, promise }
    definitions = entry
    promise.catch(() => {
      if (definitions === entry) definitions = null
    })
    return promise
  }

  async function loadMarketDefinitions(session: SessionMaterial): Promise<MarketDefinition[]> {
    const raw = await trading.marketData(session)
    const metadataBySymbol = normalizeSymbolMap(raw.metadata)
    return raw.catalogue.flatMap((entry) => {
      const id = canonicalInstrumentId(entry.ticker, entry.category)
      const plainTicker = apiSymbol(entry.ticker)
      const metadata = metadataBySymbol.get(plainTicker.toUpperCase())
      return metadata ? [{
        entry,
        id,
        plainTicker,
        feedTicker: feedSymbol(id),
        metadata,
      }] : []
    })
  }

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
    const listed = await readMarketDefinitions(session)
    const symbols = [...new Set(listed.map(({ feedTicker }) => feedTicker))]
    const quotes = await fetchQuoteSnapshot(symbols)
    if (symbols.length > 0 && quotes.size === 0) {
      throw new BackendError('network', 'Could not reach the price feed.', { endpoint: 'ticks' })
    }
    return pricedInstruments(listed, quotes)
  }

  function readPositions(): Promise<Position[]> {
    return loadPositions(requireSession())
  }

  async function loadPositions(session: SessionMaterial): Promise<Position[]> {
    const orders = await trading.openOrders(session)
    if (orders.length === 0) return []
    const listed = await readMarketDefinitions(session)
    const byId = new Map(listed.map((item) => [item.id, item]))
    const byApiSymbol = new Map(listed.map((item) => [apiSymbol(item.id).toLowerCase(), item]))
    const needed = [...new Set(orders.flatMap((order) => {
      const definition = byId.get(order.instrumentId) ?? byApiSymbol.get(apiSymbol(order.instrumentId).toLowerCase())
      return definition ? [definition.feedTicker] : []
    }))]
    const quotes = await fetchQuoteSnapshot(needed)
    const valued = pricedInstruments(listed.filter((item) => needed.includes(item.feedTicker)), quotes)
    const instrumentById = new Map(valued.map((item) => [item.id, item]))
    const instrumentByApiSymbol = new Map(valued.map((item) => [apiSymbol(item.id).toLowerCase(), item]))
    return orders.map((order) => {
      const instrument = instrumentById.get(order.instrumentId) ?? instrumentByApiSymbol.get(apiSymbol(order.instrumentId).toLowerCase())
      // A market the price feed does not carry keeps the server's own numbers.
      const current = order.state === 'Pending'
        ? order.trigger ?? order.entry
        : instrument
          ? order.side === 'Buy' ? instrument.bid : instrument.ask
          : order.current ?? order.entry
      const direction = order.side === 'Buy' ? 1 : -1
      return {
        id: order.id,
        // The orders endpoint may drop the catalogue namespace (`XAUUSD`
        // versus `C:XAUUSD`). Keep the canonical catalogue id so subsequent
        // live-price subscriptions use the same feed symbol as the market.
        instrumentId: instrument?.id ?? order.instrumentId,
        side: order.side,
        lots: order.lots,
        entry: order.entry,
        current,
        pnl: order.state === 'Pending'
          ? 0
          : instrument
            ? (current - order.entry) * order.lots * instrument.contractSize * direction + (order.swap ?? 0) + (order.commission ?? 0)
            : order.pnl ?? 0,
        ...(instrument ? { contractSize: instrument.contractSize } : {}),
        ...(order.swap === undefined ? {} : { swap: order.swap }),
        ...(order.commission === undefined ? {} : { commission: order.commission }),
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
    return (await readHistoryPage('', { page: 1 })).positions
  }

  async function readHistoryPage(_accountId: string, options: { page: number }) {
    const history = await trading.closedOrders(requireSession(), options)
    if (history.orders.length > 0 && history.info.page !== options.page) {
      throw new BackendError('malformed', 'History returned a different page.', { endpoint: 'closedHistory' })
    }
    const seen = new Set<string>()
    // Rejected and cancelled orders reach history without a fill, so they
    // carry no close price or P&L.
    const positions: Position[] = history.orders.filter((order) => {
      if (seen.has(order.id)) return false
      seen.add(order.id)
      return true
    }).map((order) => ({
      ...order,
      current: order.current ?? order.entry,
      pnl: order.pnl ?? 0,
    }))
    // `total`/`count` are not documented as row or page counts. Keep paging
    // explicit and stop only at an empty response instead of guessing.
    return { positions, page: options.page, hasMore: history.orders.length > 0 }
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
    const accountId = session.orderAccountId ?? await resolveOrderAccountId(session.accountToken)
    if (session.orderFingerprint && session.orderAccountId === accountId) {
      return session.orderFingerprint
    }
    const fingerprint = await trading.issueOrderFingerprint(session, accountId)
    const updated = { ...session, orderAccountId: accountId, orderFingerprint: fingerprint }
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

        // Sessions saved by builds before demo-order fingerprinting carried
        // no server session id. They can still pass `auth`, but
        // `create_fingerprint` rejects them as "Invalid Session". Require one
        // fresh sign-in instead of restoring a session that cannot trade.
        if (!stored.sessionId) {
          await store.clear()
          return false
        }

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
        const orderAccountId = tradingAccountIds.get(request.accountId)
        let switched = {
          ...session,
          accountToken: request.accountId,
          orderAccountId,
          orderFingerprint: undefined,
        }
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
        const session = requireSession()
        const wanted = new Set(instrumentIds.map((id) => id.toLowerCase()))
        const listed = (await readMarketDefinitions(session)).filter((item) => wanted.has(item.id))
        const quotes = await fetchQuoteSnapshot(listed.map((item) => item.feedTicker))
        return pricedInstruments(listed, quotes)
      },
      async candles(instrumentId, timeframe, interval) {
        const request = CHART_REQUESTS[timeframe]
        const intervals = { '1m': '1', '5m': '5', '15m': '15', '1h': '60', '4h': '240', '1D': '1D' }
        // Bound bridge/render work for short intervals over long date windows.
        const candles = await fetchCandles(feedSymbol(instrumentId), interval ? intervals[interval] : request.timeframe, interval ? 500 : request.limit)
        const series = buildChartSeries(candles, timeframe, { allowSingleBar: true })
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

    managedAccounts: {
      async directory(kind) {
        const session = requireSession()
        const response = await gate.call(kind === 'MAM' ? 'mamDirectory' : 'pammDirectory', {
          query: { token: session.accountToken }, headers: trading.headers(session),
        })
        return parseManagedDirectory(response.json, kind)
      },
      async following(kind) {
        const session = requireSession()
        const response = await gate.call(kind === 'MAM' ? 'mamFollowing' : 'pammFollowing', {
          query: { token: session.accountToken }, headers: trading.headers(session),
        })
        return parseManagedFollowing(response.json, kind)
      },
      async followers(kind) {
        const session = requireSession()
        const response = await gate.call(kind === 'MAM' ? 'mamFollowers' : 'pammFollowers', {
          query: { token: session.accountToken }, headers: trading.headers(session),
        })
        return parseManagedFollowers(response.json, kind)
      },
      async report(kind, relationship) {
        const session = requireSession()
        const response = await gate.call(kind === 'MAM' ? 'mamReport' : 'pammReport', {
          query: { token: session.accountToken, user_id: relationship.userId,
            [kind === 'MAM' ? 'mam_id' : 'pamm_id']: relationship.managerId },
          headers: trading.headers(session),
        })
        return parseManagedReport(response.json, kind)
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
      historyPage: readHistoryPage,
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
          await trading.submitDepositRequest(session, request)
        }
        invalidateAccountData()
      },
      async requestWithdrawal(request) {
        await trading.submitWithdrawalRequest(requireSession(), request)
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

/** `c:xauusd` → `WAVE:C.XAUUSD`, the documented chart-feed symbol. */
function feedSymbol(instrumentId: string): string {
  const separator = instrumentId.indexOf(':')
  if (separator < 0) return instrumentId.toUpperCase()
  const venue = instrumentId.slice(0, separator).toUpperCase()
  const symbol = instrumentId.slice(separator + 1).toUpperCase()
  return `WAVE:${venue}.${symbol}`
}

function canonicalInstrumentId(ticker: string, category: Instrument['category']): string {
  if (ticker.includes(':')) return ticker.toLowerCase()
  const venue = category === 'Crypto'
    ? 'x'
    : category === 'Indices'
      ? 'i'
      : category === 'Stocks'
        ? 's'
        : 'c'
  return `${venue}:${ticker.toLowerCase()}`
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
