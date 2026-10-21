import { createLiveBackend } from '../../src/backend/live-backend'
import { FakeSocket } from './fixtures/fake-socket'
import { BackendError } from '../../src/backend/errors'
import type { BackendConfig } from '../../src/backend/gate'
import {
  fundingConfigurationResponse,
  notificationsResponse,
  portalBootstrapResponse,
} from './fixtures/portal-responses'
import {
  accountDetailResponse,
  chartHistoryResponse,
  closedHistoryResponse,
  dailySnapshotResponse,
  favoritesResponse,
  marketCatalogueResponse,
  openPositionsResponse,
  symbolMetadataResponse,
  tradingAccountsResponse,
} from './fixtures/trading-responses'

/**
 * The live backend is mostly *refusals* today, and that is the behaviour
 * worth pinning: guide §1 says a screen must not be enabled without a backing
 * endpoint, so a method that cannot yet be honoured has to fail loudly and
 * say which guide §7 item unblocks it — not return a plausible empty value.
 */

const mockStore = new Map<string, string>()

jest.mock('expo-secure-store', () => ({
  WHEN_UNLOCKED_THIS_DEVICE_ONLY: 'whenUnlocked',
  getItemAsync: jest.fn(async (key: string) => mockStore.get(key) ?? null),
  setItemAsync: jest.fn(async (key: string, value: string) => void mockStore.set(key, value)),
  deleteItemAsync: jest.fn(async (key: string) => void mockStore.delete(key)),
}))

jest.mock('expo-crypto', () => ({ randomUUID: () => 'fp-test' }))

const CONFIG: BackendConfig = {
  tradingBaseUrl: 'https://trading.example',
  portalBaseUrl: 'https://portal.example',
  chartingBaseUrl: 'https://charts.example',
  portalOrigin: 'https://app.example',
  phase: 1,
  timeoutMs: 1000,
}

function scriptFetch(...replies: { status?: number; body: string }[]) {
  const mock = jest.fn()
  for (const reply of replies) {
    mock.mockResolvedValueOnce({ status: reply.status ?? 200, text: async () => reply.body })
  }
  mock.mockImplementation(async (url: string) => {
    const body = String(url).includes('collect=detail')
      ? JSON.stringify({
          status: 'success',
          data: { balance: 1250.5, fund: 1200.5, credit: 0, equity: 1275.25, currency: 'USD' },
        })
      : JSON.stringify(portalBootstrapResponse)
    return { status: 200, text: async () => body }
  })
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

const CHECK_OK = {
  body: JSON.stringify({
    userID: 'user-1',
    status: 'success',
    token: 'acct-1',
    mode: 'live',
    session_id: 'session-1',
    password: 'server-echo',
    verify: '1',
    secret_key: 'sk-1',
    footprint: 'server-fp',
  }),
}
const BEARER_OK = { body: 'raw.bearer' }

describe('managed account directory', () => {
  it('loads the authenticated MAM directory without exposing API envelopes to screens', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    const fetchMock = scriptFetch({ body: JSON.stringify({ status: 'success', data: { user: '[{"mam":"1"}]', mamList: '[{"user":"26","name":"Manager One","growth":"12.5","follow":"1"}]' } }) })
    expect(backend.managedAccounts).toBeDefined()
    await expect(backend.managedAccounts.directory('MAM')).resolves.toEqual({ managerEnabled: true, managers: [{ id: '26', name: 'Manager One', growth: 12.5, following: true }] })
    expect(fetchMock.mock.calls[0][0]).toContain('collect=mamList')
  })
})

describe('closed history pages', () => {
  async function signedInBackend() {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    return backend
  }

  it('loads an explicit later page and offers another page while records remain', async () => {
    const backend = await signedInBackend()
    const fetchMock = scriptFetch({ body: JSON.stringify({
      ...closedHistoryResponse,
      info: { page: 2, total: 1, count: 1 },
    }) })

    await expect(backend.orders.historyPage('acct-1', { page: 2 })).resolves.toMatchObject({
      page: 2,
      hasMore: true,
      positions: [expect.objectContaining({ id: 'order-closed', current: 2325.75, pnl: 25.75 })],
    })
    expect(new URL(fetchMock.mock.calls[0][0]).searchParams.get('page')).toBe('2')
  })

  it('ends pagination on a documented empty outcome without an echoed page', async () => {
    const backend = await signedInBackend()
    scriptFetch({ body: '{"status":"empty","data":[]}' })
    await expect(backend.orders.historyPage('acct-1', { page: 3 })).resolves.toEqual({
      page: 3, hasMore: false, positions: [],
    })
  })

  it('deduplicates repeated order IDs within a page', async () => {
    const backend = await signedInBackend()
    scriptFetch({ body: JSON.stringify({
      ...closedHistoryResponse,
      data: [...closedHistoryResponse.data, ...closedHistoryResponse.data],
    }) })
    const result = await backend.orders.historyPage('acct-1', { page: 1 })
    expect(result.positions.map((position) => position.id)).toEqual(['order-closed'])
  })

  it('rejects a repeated earlier page instead of letting pagination loop', async () => {
    const backend = await signedInBackend()
    scriptFetch({ body: JSON.stringify(closedHistoryResponse) })
    await expect(backend.orders.historyPage('acct-1', { page: 2 })).rejects.toMatchObject({
      kind: 'malformed', endpoint: 'closedHistory',
    })
  })

  it('propagates a later-page failure instead of reporting an empty end of history', async () => {
    const backend = await signedInBackend()
    scriptFetch({ status: 503, body: 'unavailable' })
    await expect(backend.orders.historyPage('acct-1', { page: 2 })).rejects.toMatchObject({ kind: 'server' })
  })
})

beforeEach(() => {
  mockStore.clear()
  scriptFetch()
})

describe('construction', () => {
  it('refuses to build against a plaintext host', () => {
    // Guide §6.9, enforced before a single request can be made.
    expect(() => createLiveBackend({ ...CONFIG, portalBaseUrl: 'http://portal.example' })).toThrow(
      BackendError,
    )
  })
})

describe('session', () => {
  it('signs in and persists the material to secure storage', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)

    await expect(backend.session.signIn('a@b.com', 'pw')).resolves.toEqual({
      kind: 'authenticated',
    })
    expect([...mockStore.values()].join()).toContain('raw.bearer')
  })

  it('establishes the portal and loads bootstrap immediately after sign-in', async () => {
    const fetchMock = scriptFetch(CHECK_OK, BEARER_OK)

    await createLiveBackend(CONFIG).session.signIn('a@b.com', 'pw')

    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual(
      expect.arrayContaining([
        expect.stringContaining('setPortalSession'),
        expect.stringContaining('apiBootstrap'),
      ]),
    )
  })

  it('never writes the password to storage', async () => {
    // Guide §3.3.
    scriptFetch(CHECK_OK, BEARER_OK)
    await createLiveBackend(CONFIG).session.signIn('a@b.com', 'hunter2')
    expect([...mockStore.values()].join()).not.toContain('hunter2')
  })

  it('does not persist a session for an unverified account', async () => {
    scriptFetch({ body: '{"token":"acct-1","secretkey":"sk-1","verified":"0"}' })
    const backend = createLiveBackend(CONFIG)

    await expect(backend.session.signIn('a@b.com', 'pw')).resolves.toEqual({
      kind: 'verification-required',
    })
    expect(mockStore.has('wavex.session.v1')).toBe(false)
  })

  it('restores nothing when storage is empty', async () => {
    await expect(createLiveBackend(CONFIG).session.restore()).resolves.toBe(false)
  })

  it('clears a legacy stored session that cannot register demo fingerprints', async () => {
    mockStore.set('wavex.session.v1', JSON.stringify({
      accountToken: 'acct-1',
      secretKey: 'sk-1',
      bearerToken: 'raw.bearer',
      footprint: 'server-fp',
      issuedAt: '2026-10-01T00:00:00.000Z',
    }))

    await expect(createLiveBackend(CONFIG).session.restore()).resolves.toBe(false)

    expect(mockStore.has('wavex.session.v1')).toBe(false)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('restores a stored session that the server still accepts', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    // A fresh instance reads what the first one stored.
    scriptFetch({ body: '{"status":"success","data":{}}' })
    await expect(createLiveBackend(CONFIG).session.restore()).resolves.toBe(true)
  })

  it('re-establishes the portal and reloads bootstrap after restore', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    await createLiveBackend(CONFIG).session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch({ body: '{"status":"success","data":{}}' })
    await createLiveBackend(CONFIG).session.restore()

    expect(fetchMock.mock.calls.some(([url]) => url.includes('setPortalSession'))).toBe(true)
    expect(fetchMock.mock.calls.some(([url]) => url.includes('apiBootstrap'))).toBe(true)
  })

  it('refreshes the bearer when the stored session is no longer valid', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    await createLiveBackend(CONFIG).session.signIn('a@b.com', 'pw')

    // auth says no, then the bearer call issues a new token.
    const fetchMock = scriptFetch({ status: 401, body: 'expired' }, { body: 'new.bearer' })
    await expect(createLiveBackend(CONFIG).session.restore()).resolves.toBe(true)
    expect(fetchMock.mock.calls[1][0]).toContain('collect=bearer')
    expect([...mockStore.values()].join()).toContain('new.bearer')
  })

  it('signs out and clears storage when the session cannot be refreshed', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    await createLiveBackend(CONFIG).session.signIn('a@b.com', 'pw')

    scriptFetch({ status: 401, body: 'expired' }, { status: 401, body: 'expired' })
    await expect(createLiveBackend(CONFIG).session.restore()).resolves.toBe(false)
    expect(mockStore.has('wavex.session.v1')).toBe(false)
  })

  it('clears every stored value on sign-out', async () => {
    // Guide §3.3: "Clear all stored session material on logout."
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    await backend.session.signOut()
    expect(mockStore.has('wavex.session.v1')).toBe(false)
  })

  it('invalidates portal and bootstrap state on sign-out', async () => {
    const fetchMock = scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    await backend.session.signOut()

    fetchMock
      .mockResolvedValueOnce({ status: 200, text: async () => CHECK_OK.body })
      .mockResolvedValueOnce({ status: 200, text: async () => BEARER_OK.body })
    await backend.session.signIn('a@b.com', 'pw')

    const portalCalls = fetchMock.mock.calls.filter(([url]) =>
      url.includes('setPortalSession') || url.includes('apiBootstrap'),
    )
    expect(portalCalls).toHaveLength(4)
  })

  it('refuses to refresh when there is no session at all', async () => {
    await expect(createLiveBackend(CONFIG).session.refresh()).rejects.toMatchObject({ kind: 'auth' })
  })
})

describe('orders.counts', () => {
  it('requires a session before it will call', async () => {
    await expect(createLiveBackend(CONFIG).orders.counts('acct-1')).rejects.toMatchObject({
      kind: 'auth',
    })
  })

  it('reads the one response shape guide §2 documents', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: '{"status":"success","open_count":"2","pending_count":"1","total_count":"3"}' })
    await expect(backend.orders.counts('acct-1')).resolves.toEqual({
      open: 2,
      pending: 1,
      total: 3,
    })
  })

  it('coerces the numeric strings this API is known to send', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: '{"status":"success","open_count":"2","pending_count":"1","total_count":"3"}' })
    await expect(backend.orders.counts('acct-1')).resolves.toEqual({
      open: 2,
      pending: 1,
      total: 3,
    })
  })

  it('rejects a missing count rather than inventing zero', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: '{"status":"success","open_count":"2"}' })
    await expect(backend.orders.counts('acct-1')).rejects.toThrow()
  })

  it('rejects a shape it cannot trust instead of showing a wrong number', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: '{"status":"success","open_count":"plenty","pending_count":"1","total_count":"3"}' })
    await expect(backend.orders.counts('acct-1')).rejects.toThrow()
  })

  it('sends the account token and both trading credentials', async () => {
    // Guide §3.1 step 5.
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch({ body: '{"status":"success","open_count":"0","pending_count":"0","total_count":"0"}' })
    await backend.orders.counts('acct-9')

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('collect=orderscount')
    // The collection sends `orderscount` the account token and nothing else —
    // the token *is* the account, so there is no separate id to pass.
    expect(url).toContain('token=acct-1')
    expect(url).not.toContain('account=')
    expect(init.headers.Secretkey).toBe('sk-1')
    expect(init.headers.Bearer).toBe('raw.bearer')
  })
})

describe('accounts', () => {
  it('uses collect=detail as the authoritative current-account snapshot', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    globalThis.fetch = jest.fn(async (url: string) => {
      const body = String(url).includes('collect=detail')
        ? JSON.stringify(accountDetailResponse)
        : JSON.stringify(tradingAccountsResponse)
      return { status: 200, text: async () => body }
    }) as unknown as typeof fetch

    await expect(backend.accounts.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'account-1',
        balance: 2450.75,
        equity: 2475.5,
        freeMargin: 2205.25,
      }),
    ])
  })

  it('joins a trading account id to the portal database id while keeping its API token', async () => {
    const bootstrapWithSeparateIds = {
      ...portalBootstrapResponse,
      data: {
        ...portalBootstrapResponse.data,
        accounts: [
          {
            ...portalBootstrapResponse.data.accounts[0],
            id: 7,
            token: 'account-1',
          },
        ],
      },
    }
    scriptFetch(
      CHECK_OK,
      BEARER_OK,
      { body: '{"status":"success"}' },
      { body: JSON.stringify(bootstrapWithSeparateIds) },
    )
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({
      body: JSON.stringify([{ ...tradingAccountsResponse[0], token: 'account-1', account_id: 7 }]),
    })

    await expect(backend.accounts.list()).resolves.toEqual([
      expect.objectContaining({ id: 'account-1', number: '10001' }),
    ])
  })

  it('joins trading balances with portal equity and leverage by account id', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: JSON.stringify(tradingAccountsResponse) })
    await expect(backend.accounts.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'account-1',
        current: true,
        number: '10001',
        mode: 'LIVE',
        balance: 1250.5,
        equity: 1275.25,
        leverage: 500,
      }),
    ])
  })

  it('keeps a linked demo returned by accountList when portal bootstrap omits it', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({
      body: JSON.stringify([
        ...tradingAccountsResponse,
        {
          uid: 'user-1',
          token: 'demo-token',
          account_id: '20002',
          balance: 100000,
          book: 'DEMO',
          account_type: 'standard',
        },
      ]),
    })

    await expect(backend.accounts.list()).resolves.toEqual([
      expect.objectContaining({ id: 'account-1', mode: 'LIVE' }),
      {
        id: 'demo-token',
        current: false,
        mode: 'DEMO',
        number: '20002',
        balance: 100000,
        summaryAvailable: false,
      },
    ])
  })

  it.each([
    ['d', 'DEMO'],
    ['a', 'LIVE'],
  ])('labels a linked account with book code %s as %s, never the raw code', async (book, mode) => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({
      body: JSON.stringify([
        ...tradingAccountsResponse,
        { uid: 'user-1', token: 'linked-token', account_id: '20005', balance: 10000, book },
      ]),
    })

    const accounts = await backend.accounts.list()
    expect(accounts.find((account) => account.id === 'linked-token')).toMatchObject({ mode })
  })

  it('takes Live / Demo for a detailed account from the portal, not the trading book code', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: JSON.stringify([{ ...tradingAccountsResponse[0], book: 'a' }]) })
    await expect(backend.accounts.list()).resolves.toEqual([
      expect.objectContaining({ id: 'account-1', mode: 'LIVE' }),
    ])
  })

  it('falls back to portal account data when the trading API uses a different id', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({
      body: JSON.stringify([{ ...tradingAccountsResponse[0], account_id: 'missing-portal' }]),
    })
    await expect(backend.accounts.list()).resolves.toEqual([
      expect.objectContaining({
        id: 'account-1',
        number: '10001',
        mode: 'LIVE',
        balance: 1250.5,
        equity: 1275.25,
      }),
    ])
  })

  it('maps the authenticated portal user to the app profile', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    await expect(backend.accounts.profile()).resolves.toMatchObject({
      holder: 'Example User',
      email: 'person@example.invalid',
      verified: true,
      kycStatus: 'Verified',
    })
  })

  it('switches both transports with one user-intent key', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch(
      { body: '{"status":"success"}' },
      { body: '{"status":"success"}' },
      { body: JSON.stringify(portalBootstrapResponse) },
    )
    await backend.accounts.switchAccount({ accountId: 'account-1', idempotencyKey: 'switch-1' })

    expect(fetchMock.mock.calls.some(([url]) => url.includes('collect=switchAccount'))).toBe(true)
    expect(fetchMock.mock.calls.some(([url]) => url.includes('/switchAccount'))).toBe(true)
  })

  it('stops an account switch when trading reports a business failure', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch({
      body: '{"status":"fail","message":"account unavailable"}',
    })

    await expect(
      backend.accounts.switchAccount({ accountId: 'account-2', idempotencyKey: 'switch-2' }),
    ).rejects.toMatchObject({ kind: 'rejected' })
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('validates the target with the existing user bearer when the legacy switch route returns 500', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch(
      { status: 500, body: 'internal server error' },
      { body: '{"status":"success","data":{}}' },
      { body: '{"status":"success"}' },
    )

    await expect(
      backend.accounts.switchAccount({ accountId: 'demo-account', idempotencyKey: 'switch-demo' }),
    ).resolves.toBeUndefined()

    const urls = fetchMock.mock.calls.map(([url]) => String(url))
    expect(urls.some((url) => url.includes('collect=bearer'))).toBe(false)
    expect(urls.some((url) => url.includes('collect=auth'))).toBe(true)
    expect(urls.some((url) => url.includes('/switchAccount'))).toBe(true)
    expect([...mockStore.values()].join()).toContain('raw.bearer')
  })
})

describe('markets', () => {
  const sockets = globalThis as { WebSocket: unknown }
  let original: unknown
  beforeEach(() => {
    original = sockets.WebSocket
    sockets.WebSocket = FakeSocket
    FakeSocket.instances = []
  })
  afterEach(() => {
    sockets.WebSocket = original
  })

  /** Lets the REST reads settle until the initial quote socket has opened. */
  async function feedSockets() {
    for (let turn = 0; turn < 50 && !FakeSocket.instances.some((socket) => socket.url.endsWith('/ticks')); turn += 1) {
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    const ticks = FakeSocket.instances.find((socket) => socket.url.endsWith('/ticks'))!
    ticks.open()
    return { ticks }
  }

  async function nextSocket(path: string) {
    for (let turn = 0; turn < 50; turn += 1) {
      const socket = FakeSocket.instances.find((candidate) => candidate.url.endsWith(path))
      if (socket) return socket
      await new Promise((resolve) => setTimeout(resolve, 0))
    }
    throw new Error(`No ${path} socket opened`)
  }

  function answerDayBars(bars: FakeSocket, days: Record<string, { o: number; h: number; l: number; c: number }>) {
    for (const request of bars.sent as { uid: string; symbol: string }[]) {
      const day = days[request.symbol]
      bars.receive(day
        ? { action: 'ohlc_response', success: true, uid: request.uid, data: [{ t: '2026-10-02T00:00:00.000Z', v: 1, ...day }] }
        : { action: 'ohlc_response', success: false, uid: request.uid, error: 'not entitled' })
    }
  }

  it('joins catalogue and metadata with quotes from the feed', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    const marketFetch = scriptFetch(
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
    )

    const pending = backend.markets.catalogue()
    const { ticks } = await feedSockets()
    expect(ticks.sent).toEqual([{
      action: 'subscribe',
      symbols: ['WAVE:C.XAUUSD', 'WAVE:X.BTCUSD'],
    }])
    ticks.receive({ status: 'subscribed', symbols: ['WAVE:C.XAUUSD', 'WAVE:X.BTCUSD'] })
    ticks.receive({
      'WAVE:C.XAUUSD': { p: 2400.2, v: 1, b: 2400.1, a: 2400.3 },
      'WAVE:X.BTCUSD': { p: 68000, v: 1, b: 67995, a: 68005 },
    })

    await expect(pending).resolves.toEqual([
      expect.objectContaining({
        id: 'c:xauusd',
        symbol: 'XAU/USD',
        name: 'Gold',
        precision: 2,
        bid: 2400.1,
        ask: 2400.3,
        price: 2400.2,
      }),
      expect.objectContaining({ id: 'x:btcusd', symbol: 'BTC/USD', bid: 67995, ask: 68005 }),
    ])
    expect(marketFetch.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringContaining('getCurrentDayData'),
    )
  })

  it('normalizes an unprefixed metal ticker to the documented Wave chart symbol', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify({ fx: [{ name: 'Gold', ticker: 'XAUUSD', market: 'metals' }] }) },
      { body: JSON.stringify(symbolMetadataResponse) },
    )

    const pending = backend.markets.catalogue()
    const { ticks } = await feedSockets()
    expect(ticks.sent[0]).toEqual({ action: 'subscribe', symbols: ['WAVE:C.XAUUSD'] })
    ticks.receive({ 'WAVE:C.XAUUSD': { p: 2400.2, v: 1, b: 2400.1, a: 2400.3 } })
    await expect(pending).resolves.toEqual([expect.objectContaining({ id: 'c:xauusd' })])
  })

  it('loads the catalogue from the fast quote snapshot without waiting for 286 daily bars', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
    )

    const pending = backend.markets.catalogue()
    const ticks = await nextSocket('/ticks')
    ticks.open()
    ticks.receive({
      'WAVE:C.XAUUSD': { p: 2400.2, v: 1, b: 2400.1, a: 2400.3 },
      'WAVE:X.BTCUSD': { p: 68005, v: 1, b: 68000, a: 68010 },
    })

    await expect(pending).resolves.toHaveLength(2)
    expect(FakeSocket.instances.some((socket) => socket.url.endsWith('/ohlcV2'))).toBe(false)
  })

  it('prices one requested instrument without subscribing to the full catalogue', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
    )

    const pending = backend.markets.quoteSnapshot(['c:xauusd'])
    const ticks = await nextSocket('/ticks')
    ticks.open()
    expect(ticks.sent).toEqual([{
      action: 'subscribe',
      symbols: ['WAVE:C.XAUUSD'],
    }])
    ticks.receive({ 'WAVE:C.XAUUSD': { p: 2400.2, v: 1, b: 2400.1, a: 2400.3 } })

    await expect(pending).resolves.toEqual([
      expect.objectContaining({ id: 'c:xauusd', price: 2400.2 }),
    ])
    expect(FakeSocket.instances.some((socket) => socket.url.endsWith('/ohlcV2'))).toBe(false)
  })

  it('resolves bundled marks without changing server tickers, IDs or prices', async () => {
    const cases = [
      ['NASDAQ:AAPL.OQ', 'apple'], ['TSLA', 'tesla'], ['NVDA', 'nvidia'],
      ['MSFT', 'microsoft'], ['AMZN', 'amazon'], ['META', 'meta'],
      ['GOOGL', 'google'], ['NFLX', 'netflix'], ['X:BTCUSD', 'bitcoin'],
      ['ETHUSD', 'ethereum'], ['C:XAUUSD', 'gold'], ['XAGUSD', 'silver'],
      ['EURUSD', 'forex'], ['USOIL', 'oil'], ['NASDAQ:ZETA.OQ', 'stock'],
    ]
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    const plain = (ticker: string) => ticker.split(':').pop()!
    const feed = (ticker: string) => {
      const [venue, symbol] = ticker.split(':')
      return symbol ? `WAVE:${venue}.${symbol}` : `WAVE:S.${venue}`
    }
    scriptFetch(
      { body: JSON.stringify({ stocks: cases.map(([ticker]) => ({ ticker, name: ticker, market: 'stocks' })) }) },
      { body: JSON.stringify(Object.fromEntries(cases.map(([ticker]) => [plain(ticker), { decimal: 2, lot: 1, spread: 0.1 }]))) },
    )
    const pending = backend.markets.catalogue()
    const { ticks } = await feedSockets()
    ticks.receive(Object.fromEntries(cases.map(([ticker]) => [feed(ticker), { p: 11, v: 1, b: 10, a: 12 }])))

    const markets = await pending
    expect(markets.map(({ icon }) => icon)).toEqual(cases.map(([, icon]) => icon))
    expect(markets[0]).toMatchObject({ id: 'nasdaq:aapl.oq', symbol: 'AAPL.OQ', price: 11 })
    expect(markets[14]).toMatchObject({ id: 'nasdaq:zeta.oq', symbol: 'ZETA.OQ', iconLabel: 'ZETA' })
  })

  it('leaves out a market the feeds do not carry and keeps the rest', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
    )
    const pending = backend.markets.catalogue()
    const { ticks } = await feedSockets()
    ticks.receive({ 'WAVE:C.XAUUSD': { p: 2400.2, v: 1, b: 2400.1, a: 2400.3 } })
    await expect(pending).resolves.toEqual([expect.objectContaining({ id: 'c:xauusd' })])
  })

  it('marks a newly filled order when the order API omits the catalogue namespace', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify(openPositionsResponse) },
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
    )

    const pending = backend.orders.list('account-1')
    const { ticks } = await feedSockets()
    ticks.receive({
      'WAVE:C.XAUUSD': { p: 2400.2, v: 1, b: 2400.1, a: 2400.3 },
      'WAVE:X.BTCUSD': { p: 68005, v: 1, b: 68000, a: 68010 },
    })

    const positions = await pending
    expect(positions).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: 'order-open',
        instrumentId: 'c:xauusd',
        current: 2400.1,
      }),
    ]))
    // Price movement plus the swap and commission charged by the server.
    expect(positions.find((position) => position.id === 'order-open')?.pnl).toBeCloseTo(-9.25)
  })

  it('values the pictured AUD/CAD trade using the live contract multiplier, not the minimum lot', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify({ status: 'success', data: [{
        id: 'audcad-position', symbol: 'AUDCAD', bs: 'buy', lot: '0.01',
        avg: '0.98762', status: 'open', t_swap: '0', commission: '0',
      }] }) },
      { body: JSON.stringify({ fx: [{ name: 'Australian dollar - Canadian dollar', ticker: 'C:AUDCAD', market: 'forex' }] }) },
      { body: JSON.stringify({ AUDCAD: { spread: 100000, decimal: 5, lot: 0.01 } }) },
    )
    const pending = backend.orders.list('account-1')
    const { ticks } = await feedSockets()
    ticks.receive({ 'WAVE:C.AUDCAD': { p: 0.98755, b: 0.98754, a: 0.98756, v: 1 } })
    const [position] = await pending
    expect(position.contractSize).toBe(100000)
    expect(position.pnl).toBeCloseTo(-0.08)
  })

  it('reports the price feed as unreachable rather than an empty market list', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
    )
    const pending = backend.markets.catalogue()
    const { ticks } = await feedSockets()
    ticks.drop()
    await expect(pending).rejects.toMatchObject({ kind: 'network' })
  })

  it.each([
    [undefined, '240', 220],
    ['15m' as const, '15', 500],
    ['1D' as const, '1D', 500],
  ])('reads candle feed with independent interval %s and bounded history', async (interval, feedInterval, limit) => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    const favoritesFetch = scriptFetch({ body: JSON.stringify(favoritesResponse) })
    await expect(backend.markets.favorites()).resolves.toEqual(['xauusd', 'eurusd'])
    expect(favoritesFetch.mock.calls[0][0]).toContain('data=%5B%5D')

    const chartFetch = scriptFetch({ body: JSON.stringify(chartHistoryResponse) })
    const sockets = globalThis as { WebSocket: unknown }
    const original = sockets.WebSocket
    sockets.WebSocket = FakeSocket
    try {
      const pending = backend.markets.candles('c:xauusd', '1M', interval)
      const socket = FakeSocket.latest()
      expect(socket.url).toBe('wss://cloud.wavexone.com/ws/ohlcV2')
      socket.open()
      const request = socket.sent[0] as { uid: string; symbol: string; timeframe: string }
      expect(request).toMatchObject({ action: 'ohlc', symbol: 'WAVE:C.XAUUSD', timeframe: feedInterval, limit })
      socket.receive({
        action: 'ohlc_response',
        success: true,
        uid: request.uid,
        data: [
          { t: '2026-10-01T00:00:00.000Z', o: 2400, h: 2410, l: 2390, c: 2405, v: 1 },
          { t: '2026-10-01T04:00:00.000Z', o: 2405, h: 2420, l: 2400, c: 2418, v: 1 },
        ],
      })
      await expect(pending).resolves.toMatchObject({
        points: [2405, 2418],
        opens: [2400, 2405],
        cursorIndex: 1,
        cursorClose: 2418,
      })
    } finally {
      sockets.WebSocket = original
    }
    expect(chartFetch).not.toHaveBeenCalled()
  })
})

describe('portal reads', () => {
  it('maps funding configuration and notifications', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: JSON.stringify(fundingConfigurationResponse) })
    await expect(backend.funds.configuration('account-1')).resolves.toMatchObject({
      depositMethods: ['Bank transfer'],
      withdrawalMethods: ['Bank transfer'],
      availableFund: 900.25,
      minimumDeposit: 100,
      kycStatus: 'Verified',
    })

    scriptFetch({ body: JSON.stringify(notificationsResponse) })
    await expect(backend.engagement.notifications()).resolves.toEqual([
      expect.objectContaining({ id: 'notification-1', kind: 'order', title: 'Order filled' }),
    ])
  })
})

describe('the methods that are not wired yet', () => {
  const backend = () => createLiveBackend(CONFIG)

  it.each([
    ['orders.place', () => backend().orders.place({ instrumentId: 'a', side: 'Buy' as const, lots: '1', idempotencyKey: 'k' })],
    ['orders.modify', () => backend().orders.modify({ positionId: 'p', state: 'Open', idempotencyKey: 'k' })],
    ['orders.cancel', () => backend().orders.cancel({ positionId: 'p', idempotencyKey: 'k' })],
    ['orders.close', () => backend().orders.close({ positionId: 'p', idempotencyKey: 'k' })],
  ])('%s stays blocked in a phase 1 build', async (_name, call) => {
    await expect(call()).rejects.toThrow(/signed out|delivery phase 2/)
  })

  it.each([
    ['funds.deposit', () => backend().funds.deposit({ accountId: 'a', amount: '100', method: 'card', idempotencyKey: 'k' })],
    ['funds.requestWithdrawal', () => backend().funds.requestWithdrawal({ accountId: 'a', amount: '100', method: 'bank', idempotencyKey: 'k' })],
  ])('%s stays blocked or signed out in the default build', async (_name, call) => {
    await expect(call()).rejects.toThrow(/signed out|delivery phase 3/)
  })
})

describe('acknowledged mutations', () => {
  it('creates and reuses the opaque demo fingerprint for its account database id', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend({ ...CONFIG, phase: 2 })
    await backend.session.signIn('a@b.com', 'pw')

    const linkedAccounts = [
      ...tradingAccountsResponse,
      {
        uid: 'user-1',
        token: 'demo-token',
        account_id: '20002',
        balance: 100000,
        book: 'DEMO',
        account_type: 'standard',
      },
    ]
    const fetchMock = scriptFetch(
      { body: JSON.stringify(linkedAccounts) },
      { body: JSON.stringify(accountDetailResponse) },
      { body: '{"status":"success"}' },
      { body: '{"status":"success"}' },
      { body: '{"status":"success","fingerprint":"server-issued-opaque-value"}' },
      { body: '{"status":"success"}' },
      { body: '{"status":"success"}' },
    )
    let now = 1_000_000
    const dateNow = jest.spyOn(Date, 'now').mockImplementation(() => now)

    try {
      await backend.accounts.list()
      await backend.accounts.switchAccount({
        accountId: 'demo-token',
        idempotencyKey: 'switch-demo',
      })
      await backend.orders.place({
        instrumentId: 'c:xauusd',
        side: 'Buy',
        lots: '0.01',
        idempotencyKey: 'place-demo-order-1',
      })
      now += 31_000
      await backend.orders.place({
        instrumentId: 'c:xauusd',
        side: 'Buy',
        lots: '0.01',
        idempotencyKey: 'place-demo-order-2',
      })

      const urls = fetchMock.mock.calls.map(([url]) => String(url))
      expect(urls).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'collect=create_fingerprint&token=demo-token&account_id=20002&sid=session-1',
          ),
          expect.stringContaining('collect=placeorder&token=demo-token'),
        ]),
      )
      expect(urls.filter((url) => url.includes('collect=create_fingerprint'))).toHaveLength(1)
      expect(urls.filter((url) => url.includes('collect=placeorder'))).toHaveLength(2)
    } finally {
      dateNow.mockRestore()
    }
  })

  it('re-reads the portal bootstrap once a trade is acknowledged', async () => {
    // Bootstrap carries equity and margin; serving the cached copy after a
    // close would show the account as it was before the trade.
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend({ ...CONFIG, phase: 2 })
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch(
      { body: JSON.stringify([{ ...tradingAccountsResponse[0], token: 'acct-1', account_id: 'acct-1' }]) },
      { body: '0123456789abcdef0123456789abcdef_acct-1' },
      { body: '{"status":"success"}' },
    )
    await backend.orders.close({ positionId: 'order-open', idempotencyKey: 'close-1' })
    await backend.accounts.profile()

    expect(fetchMock.mock.calls[2][0]).toContain('collect=squareoff')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('apiBootstrap'))).toBe(true)
  })

  it('keeps the cached bootstrap when the trade is refused', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend({ ...CONFIG, phase: 2 })
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch(
      { body: JSON.stringify([{ ...tradingAccountsResponse[0], token: 'acct-1', account_id: 'acct-1' }]) },
      { body: '0123456789abcdef0123456789abcdef_acct-1' },
      { body: '{"status":"fail","message":"market closed"}' },
    )
    await expect(
      backend.orders.close({ positionId: 'order-open', idempotencyKey: 'close-2' }),
    ).rejects.toBeInstanceOf(BackendError)
    await backend.accounts.profile()

    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('apiBootstrap'))).toBe(false)
  })
})

describe('phase 3 account and funding routes', () => {
  /** Session token `acct-1` is a demo account; `acct-2` is a second, unselected one. */
  const demoBootstrap = {
    ...portalBootstrapResponse,
    data: {
      ...portalBootstrapResponse.data,
      accounts: [
        ...portalBootstrapResponse.data.accounts,
        { ...portalBootstrapResponse.data.accounts[0], id: 'demo-1', token: 'acct-1', code: '20001', isDemo: true },
        { ...portalBootstrapResponse.data.accounts[0], id: 'demo-2', token: 'acct-2', code: '20002', isDemo: true },
      ],
    },
  }

  /** Answers by route rather than by call order, so the test reads as intent. */
  function routeFetch(bootstrap: unknown = demoBootstrap) {
    const mock = jest.fn(async (url: string) => {
      const body = url.includes('collect=check')
        ? CHECK_OK.body
        : url.includes('collect=bearer')
          ? BEARER_OK.body
          : url.includes('apiBootstrap')
            ? JSON.stringify(bootstrap)
            : '{"status":"success"}'
      return { status: 200, text: async () => body }
    })
    globalThis.fetch = mock as unknown as typeof fetch
    return mock
  }

  async function signedIn(bootstrap?: unknown) {
    const fetchMock = routeFetch(bootstrap)
    const backend = createLiveBackend({ ...CONFIG, phase: 3 })
    await backend.session.signIn('a@b.com', 'pw')
    fetchMock.mockClear()
    return { backend, fetchMock }
  }

  const called = (fetchMock: jest.Mock, route: string) =>
    fetchMock.mock.calls.filter(([url]) => String(url).includes(route))

  it('credits the selected demo account through submitDemoDeposit, not a payment request', async () => {
    const { backend, fetchMock } = await signedIn()
    await backend.funds.deposit({ accountId: 'acct-1', amount: '500.00', method: 'Bank transfer', idempotencyKey: 'd-1' })

    expect(called(fetchMock, 'submitDemoDeposit')).toHaveLength(1)
    expect(called(fetchMock, 'apiSubmitDeposit')).toHaveLength(0)
    const [, init] = called(fetchMock, 'submitDemoDeposit')[0]
    expect(String(init.body)).toContain('deposit_amount=500.00')
  })

  it('refuses a demo deposit to an account the session is not on', async () => {
    // The route takes no account id, so it would credit the wrong account.
    const { backend, fetchMock } = await signedIn()
    await expect(
      backend.funds.deposit({ accountId: 'acct-2', amount: '500.00', method: 'Bank transfer', idempotencyKey: 'd-2' }),
    ).rejects.toMatchObject({ kind: 'blocked' })
    expect(called(fetchMock, 'submitDemoDeposit')).toHaveLength(0)
  })

  it('sends a live deposit through the documented requestPayment form', async () => {
    const { backend, fetchMock } = await signedIn()
    await backend.funds.deposit({ accountId: 'account-1', amount: '100.00', method: 'Bank transfer', idempotencyKey: 'd-3' })

    const requests = called(fetchMock, 'collect=requestPayment')
    expect(requests).toHaveLength(1)
    const [, init] = requests[0]
    const body = new URLSearchParams(String(init.body))
    expect(body.get('name')).toBe('deposit')
    expect(body.get('token')).toBe('acct-1')
    expect(JSON.parse(body.get('data')!)).toEqual({ method: 'Bank transfer', wamount: '100.00' })
    expect(called(fetchMock, 'submitDemoDeposit')).toHaveLength(0)
  })

  it('sends an OTP-confirmed withdrawal through the documented requestPayment form', async () => {
    const { backend, fetchMock } = await signedIn()
    await backend.funds.requestWithdrawal({
      accountId: 'account-1',
      amount: '50.00',
      method: 'Bank transfer',
      details: { account: '12345678' },
      otp: '532235',
      idempotencyKey: 'w-1',
    })

    const requests = called(fetchMock, 'collect=requestPayment')
    expect(requests).toHaveLength(1)
    const [, init] = requests[0]
    const body = new URLSearchParams(String(init.body))
    expect(body.get('name')).toBe('request')
    expect(body.get('token')).toBe('acct-1')
    expect(JSON.parse(body.get('data')!)).toEqual({
      funds_withdraw_method: 'Bank transfer',
      wamount: '50.00',
      otp: '532235',
    })
  })

  it('saves the phone and resends the server-held name unchanged', async () => {
    const { backend, fetchMock } = await signedIn()
    await backend.accounts.saveProfile({ phone: '+44 7700 900123', idempotencyKey: 'p-1' })

    const [, init] = called(fetchMock, 'apiSaveProfile')[0]
    expect(JSON.parse(String(init.body))).toEqual({ name: 'Example User', mobile: '+44 7700 900123' })
  })

  it('never sends the display fallback as a name when the server has none', async () => {
    const { user, ...rest } = demoBootstrap.data
    const { name: _name, ...userWithoutName } = user
    const { backend, fetchMock } = await signedIn({ ...demoBootstrap, data: { ...rest, user: userWithoutName } })
    await backend.accounts.saveProfile({ phone: '+44 7700 900123', idempotencyKey: 'p-2' })

    const [, init] = called(fetchMock, 'apiSaveProfile')[0]
    expect(JSON.parse(String(init.body))).toEqual({ mobile: '+44 7700 900123' })
  })

  it.each([
    ['demo', 'apiCreateDemoAccount'],
    ['live', 'apiRequestAccountCreation'],
  ] as const)('opens a %s account through %s', async (kind, route) => {
    const { backend, fetchMock } = await signedIn()
    await backend.accounts.openAccount({ kind, idempotencyKey: `open-${kind}` })
    expect(called(fetchMock, route)).toHaveLength(1)
  })

  it('keeps every phase 3 route closed in a phase 2 build', async () => {
    routeFetch()
    const backend = createLiveBackend({ ...CONFIG, phase: 2 })
    await backend.session.signIn('a@b.com', 'pw')

    await expect(backend.accounts.saveProfile({ phone: '+44 7700 900123', idempotencyKey: 'p-3' })).rejects.toThrow(/delivery phase 3/)
    await expect(backend.accounts.openAccount({ kind: 'demo', idempotencyKey: 'o-3' })).rejects.toThrow(/delivery phase 3/)
    await expect(
      backend.funds.deposit({ accountId: 'acct-1', amount: '1.00', method: 'x', idempotencyKey: 'd-4' }),
    ).rejects.toThrow(/delivery phase 3/)
  })
})
