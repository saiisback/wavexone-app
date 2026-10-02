import { createLiveBackend } from '../../src/backend/live-backend'
import { BackendError } from '../../src/backend/errors'
import type { BackendConfig } from '../../src/backend/gate'
import {
  fundingConfigurationResponse,
  notificationsResponse,
  portalBootstrapResponse,
} from './fixtures/portal-responses'
import {
  chartHistoryResponse,
  dailySnapshotResponse,
  favoritesResponse,
  marketCatalogueResponse,
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
  // Anything beyond the script is an unexpected call.
  mock.mockResolvedValue({
    status: 200,
    text: async () => JSON.stringify(portalBootstrapResponse),
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
        number: '10001',
        mode: 'LIVE',
        balance: 1250.5,
        equity: 1275.25,
        leverage: 500,
      }),
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
})

describe('markets', () => {
  it('joins catalogue, metadata, and daily snapshots with normalized ids', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    const marketFetch = scriptFetch(
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
      { body: JSON.stringify(dailySnapshotResponse) },
    )

    await expect(backend.markets.catalogue()).resolves.toEqual([
      expect.objectContaining({ id: 'c:xauusd', symbol: 'XAU/USD', name: 'Gold', precision: 2, bid: 2400.1 }),
      expect.objectContaining({ id: 'x:btcusd', symbol: 'BTC/USD', name: 'Bitcoin', precision: 2 }),
    ])

    const currentDayRequest = marketFetch.mock.calls[2][1]
    expect(marketFetch.mock.calls[0][0]).toContain('collect=watch')
    expect(currentDayRequest.body).toBeInstanceOf(FormData)
    expect(Array.from((currentDayRequest.body as FormData).entries())).toEqual([
      ['data', 'https://charts.example/consolidated/data?symbol=XAUUSD,BTCUSD'],
      ['timeline', '1D'],
    ])
  })

  it('keeps instruments with available snapshots when one quote is missing', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    scriptFetch(
      { body: JSON.stringify(marketCatalogueResponse) },
      { body: JSON.stringify(symbolMetadataResponse) },
      { body: JSON.stringify({ XAUUSD: dailySnapshotResponse.XAUUSD }) },
    )
    await expect(backend.markets.catalogue()).resolves.toEqual([
      expect.objectContaining({ id: 'c:xauusd' }),
    ])
  })

  it('parses stringified favorites and refuses the deprecated chart endpoint', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')
    const favoritesFetch = scriptFetch({ body: JSON.stringify(favoritesResponse) })
    await expect(backend.markets.favorites()).resolves.toEqual(['xauusd', 'eurusd'])
    expect(favoritesFetch.mock.calls[0][0]).toContain('data=%5B%5D')

    const chartFetch = scriptFetch({ body: JSON.stringify(chartHistoryResponse) })
    await expect(backend.markets.candles('xauusd', '1M')).rejects.toMatchObject({
      kind: 'blocked',
    })
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
    ['funds.transfer', () => backend().funds.transfer({ fromAccountId: 'a', toAccountId: 'b', amount: '100', idempotencyKey: 'k' })],
  ])('%s stays blocked or signed out in the default build', async (_name, call) => {
    await expect(call()).rejects.toThrow(/signed out|delivery phase 3/)
  })
})

describe('acknowledged mutations', () => {
  it('re-reads the portal bootstrap once a trade is acknowledged', async () => {
    // Bootstrap carries equity and margin; serving the cached copy after a
    // close would show the account as it was before the trade.
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend({ ...CONFIG, phase: 2 })
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch(
      { body: '0123456789abcdef0123456789abcdef_acct-1' },
      { body: '{"status":"success"}' },
    )
    await backend.orders.close({ positionId: 'order-open', idempotencyKey: 'close-1' })
    await backend.accounts.profile()

    expect(fetchMock.mock.calls[1][0]).toContain('collect=squareoff')
    expect(fetchMock.mock.calls.some(([url]) => String(url).includes('apiBootstrap'))).toBe(true)
  })

  it('keeps the cached bootstrap when the trade is refused', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend({ ...CONFIG, phase: 2 })
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch(
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

  it('sends a live account deposit to apiSubmitDeposit', async () => {
    const { backend, fetchMock } = await signedIn()
    await backend.funds.deposit({ accountId: 'account-1', amount: '100.00', method: 'Bank transfer', idempotencyKey: 'd-3' })

    expect(called(fetchMock, 'apiSubmitDeposit')).toHaveLength(1)
    expect(called(fetchMock, 'submitDemoDeposit')).toHaveLength(0)
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
