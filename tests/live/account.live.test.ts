import { WAVEX_PORTAL_ORIGIN, WAVEX_PORTAL_URL, WAVEX_TRADING_URL } from '../../src/backend'
import type { WaveXBackend } from '../../src/backend/contract'
import { DEFAULT_TIMEOUT_MS } from '../../src/backend/gate'
import { createLiveBackend } from '../../src/backend/live-backend'
import { TRADING_STREAM_URL } from '../../src/backend/market-feed'
import type { Account, Instrument } from '../../src/data/types'
import { forbid, socketTraffic } from './recorder'

/**
 * The signed-in app against the real API: sign-in, accounts, profile,
 * markets, positions, history, funding and notifications.
 *
 * Read-only by construction. The build runs at phase 1, and the test fetch
 * refuses anything the endpoint registry marks as a mutation (see
 * `recorder.ts`), so no order, favourite, switch or read-receipt can be sent.
 *
 * Needs WAVEX_LIVE_EMAIL and WAVEX_LIVE_PASSWORD in `.env.local`. Use a demo
 * login: `npm run capture:fixtures` refuses to record a live account.
 */

const mockKeychain = new Map<string, string>()
jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked',
  getItemAsync: async (key: string) => mockKeychain.get(key) ?? null,
  setItemAsync: async (key: string, value: string) => void mockKeychain.set(key, value),
  deleteItemAsync: async (key: string) => void mockKeychain.delete(key),
}))
jest.mock('expo-crypto', () => ({ randomUUID: () => require('node:crypto').randomUUID() }))

const email = process.env.WAVEX_LIVE_EMAIL
const password = process.env.WAVEX_LIVE_PASSWORD

const config = {
  tradingBaseUrl: WAVEX_TRADING_URL,
  portalBaseUrl: WAVEX_PORTAL_URL,
  portalOrigin: WAVEX_PORTAL_ORIGIN,
  chartingBaseUrl: WAVEX_PORTAL_URL,
  phase: 1 as const,
  timeoutMs: DEFAULT_TIMEOUT_MS,
}

let backend: WaveXBackend
let accounts: readonly Account[]
let markets: readonly Instrument[]

beforeAll(async () => {
  if (!email || !password) {
    throw new Error(
      'Set WAVEX_LIVE_EMAIL and WAVEX_LIVE_PASSWORD in .env.local (a demo login) to run the signed-in live suite.',
    )
  }
  forbid(email, password)
  backend = createLiveBackend(config)
  await expect(backend.session.signIn(email, password)).resolves.toEqual({ kind: 'authenticated' })
  ;[accounts, markets] = await Promise.all([backend.accounts.list(), backend.markets.catalogue()])
})

afterAll(async () => {
  await backend?.session.signOut()
})

const finite = (value: number) => expect(Number.isFinite(value)).toBe(true)

describe('session', () => {
  it('keeps the password out of secure storage', () => {
    expect([...mockKeychain.values()].join()).not.toContain(password)
  })

  it('restores the stored session in a fresh app instance', async () => {
    await expect(createLiveBackend(config).session.restore()).resolves.toBe(true)
  })

  it('authenticates to the trading event stream', async () => {
    const unsubscribe = backend.events.subscribe(() => {})
    try {
      for (let waited = 0; waited < 10_000; waited += 250) {
        const replies = socketTraffic(TRADING_STREAM_URL.replace('wss://', '')).flatMap((socket) => socket.received)
        if (replies.some((message) => (message as { type?: string }).type === 'auth_success')) return
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
      throw new Error('The trading stream did not acknowledge the account token within 10 s')
    } finally {
      unsubscribe()
    }
  })
})

describe('accounts', () => {
  it('lists at least one account with real, finite figures', () => {
    expect(accounts.length).toBeGreaterThan(0)
    for (const account of accounts) {
      expect(account.id).not.toBe('')
      expect(account.number).not.toBe('')
      expect(['LIVE', 'DEMO']).toContain(account.mode)
      expect(account.currency).toMatch(/^[A-Z]{3,4}$/)
      expect(account.leverage).toBeGreaterThanOrEqual(0)
      ;[account.balance, account.equity, account.freeMargin, account.changePercent, account.floatingPnl].forEach(finite)
      expect(account.floatingPnl).toBeCloseTo(account.equity - account.balance, 6)
    }
  })

  it('summarises one account exactly as the list does', async () => {
    await expect(backend.accounts.summary(accounts[0].id)).resolves.toEqual(accounts[0])
  })

  it('maps the signed-in person to a profile', async () => {
    const profile = await backend.accounts.profile()
    expect(profile.holder).not.toBe('')
    expect(typeof profile.verified).toBe('boolean')
    expect(profile.kycStatus).toBe(profile.verified ? 'Verified' : 'Not started')
  })
})

describe('markets', () => {
  it('prices every listed market with a bid at or below the ask', () => {
    expect(markets.length).toBeGreaterThan(0)
    expect(new Set(markets.map((item) => item.id)).size).toBe(markets.length)
    for (const item of markets) {
      expect(item.bid).toBeGreaterThan(0)
      expect(item.bid).toBeLessThanOrEqual(item.ask)
      expect(Number.isInteger(item.precision)).toBe(true)
      expect(item.contractSize).toBeGreaterThan(0)
      ;[item.price, item.changePercent].forEach(finite)
    }
  })

  it('reads favourites as ids', async () => {
    const favorites = await backend.markets.favorites()
    for (const id of favorites) expect(typeof id).toBe('string')
  })

  it('quotes a requested market and nothing else', async () => {
    const [first] = markets
    const quoted = await backend.markets.quoteSnapshot([first.id])
    expect(quoted.map((item) => item.id)).toEqual([first.id])
  })

  it('draws a chart and sparklines for listed markets', async () => {
    const gold = markets.find((item) => item.icon === 'gold') ?? markets[0]
    const series = await backend.markets.candles(gold.id, '1M')
    expect(series.points.length).toBeGreaterThan(1)

    const ids = markets.slice(0, 3).map((item) => item.id)
    const sparks = await backend.markets.sparklines(ids, 'Today')
    for (const closes of sparks.values()) expect(closes.length).toBeGreaterThanOrEqual(2)
  })
})

describe('orders', () => {
  it('counts orders as non-negative whole numbers', async () => {
    const counts = await backend.orders.counts(accounts[0].id)
    for (const value of [counts.open, counts.pending, counts.total]) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
    }
  })

  it('reads open positions and pending orders with finite numbers', async () => {
    const positions = await backend.orders.list(accounts[0].id)
    for (const position of positions) {
      expect(['Buy', 'Sell']).toContain(position.side)
      expect(position.lots).toBeGreaterThan(0)
      ;[position.entry, position.current, position.pnl].forEach(finite)
    }
  })

  it('reads closed history with finite numbers', async () => {
    const history = await backend.orders.history(accounts[0].id)
    for (const order of history) {
      expect(['Buy', 'Sell']).toContain(order.side)
      ;[order.entry, order.current, order.pnl].forEach(finite)
    }
  })
})

describe('funds and engagement', () => {
  it('reads the funding configuration for an account', async () => {
    const configuration = await backend.funds.configuration(accounts[0].id)
    expect(configuration.depositMethods.length).toBeGreaterThan(0)
    finite(configuration.availableFund)
    expect(configuration.minimumDeposit).toBeGreaterThanOrEqual(0)
  })

  it('reads funding history as deposits and withdrawals', async () => {
    const history = await backend.funds.history(accounts[0].id)
    for (const entry of history) {
      expect(['deposit', 'withdrawal']).toContain(entry.kind)
      finite(entry.amount)
    }
  })

  it('reads notifications', async () => {
    const notifications = await backend.engagement.notifications()
    for (const item of notifications) {
      expect(item.id).not.toBe('')
      expect(item.title).not.toBe('')
    }
  })
})
