import { createLiveBackend } from '../../src/backend/live-backend'
import { BackendError } from '../../src/backend/errors'
import type { BackendConfig } from '../../src/backend/gate'
import { portalBootstrapResponse } from './fixtures/portal-responses'

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

    scriptFetch({ body: '{"status":"success","data":{"open":2,"pending":1,"total":3}}' })
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

    scriptFetch({ body: '{"open":"2","pending":"1","total":"3"}' })
    await expect(backend.orders.counts('acct-1')).resolves.toEqual({
      open: 2,
      pending: 1,
      total: 3,
    })
  })

  it('defaults a missing count to zero rather than undefined', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: '{"open":2}' })
    await expect(backend.orders.counts('acct-1')).resolves.toEqual({
      open: 2,
      pending: 0,
      total: 0,
    })
  })

  it('rejects a shape it cannot trust instead of showing a wrong number', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    scriptFetch({ body: '{"open":"plenty"}' })
    await expect(backend.orders.counts('acct-1')).rejects.toMatchObject({ kind: 'malformed' })
  })

  it('sends the account token and both trading credentials', async () => {
    // Guide §3.1 step 5.
    scriptFetch(CHECK_OK, BEARER_OK)
    const backend = createLiveBackend(CONFIG)
    await backend.session.signIn('a@b.com', 'pw')

    const fetchMock = scriptFetch({ body: '{"open":0,"pending":0,"total":0}' })
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

describe('the methods that are not wired yet', () => {
  const backend = () => createLiveBackend(CONFIG)

  /** Every contract method except the ones that are genuinely implemented. */
  const unwired: [string, () => Promise<unknown>][] = [
    ['accounts.summary', () => backend().accounts.summary('a')],
    ['accounts.list', () => backend().accounts.list()],
    ['accounts.switchAccount', () => backend().accounts.switchAccount('a')],
    ['accounts.profile', () => backend().accounts.profile()],
    ['markets.catalogue', () => backend().markets.catalogue()],
    ['markets.favorites', () => backend().markets.favorites()],
    ['markets.setFavorite', () => backend().markets.setFavorite('a', true)],
    ['markets.quoteSnapshot', () => backend().markets.quoteSnapshot(['a'])],
    ['markets.candles', () => backend().markets.candles('a', '1D')],
    ['orders.list', () => backend().orders.list('a')],
    ['orders.history', () => backend().orders.history('a')],
    ['funds.configuration', () => backend().funds.configuration('a')],
    ['funds.history', () => backend().funds.history('a')],
    ['engagement.notifications', () => backend().engagement.notifications()],
  ]

  it.each(unwired)('%s refuses and names what would unblock it', async (_name, call) => {
    // The refusal is the feature: it turns "this screen shows nothing" into
    // a specific request to the backend team. Since the collections settled
    // the request side, that request is now a named capture rather than a
    // guide item — see docs/RESPONSE-CAPTURES.md.
    await expect(call()).rejects.toMatchObject({ kind: 'blocked' })
    await expect(call()).rejects.toThrow(/Needs one captured response|guide §7\.\d/)
  })

  it('points every refusal at the capture list', async () => {
    // One place to look, rather than a scavenger hunt through error strings.
    const message = await backend()
      .accounts.list()
      .catch((error: Error) => error.message)
    expect(message).toContain('docs/RESPONSE-CAPTURES.md')
  })

  it('never reaches the network for an unwired method', async () => {
    const fetchMock = scriptFetch()
    await expect(backend().markets.catalogue()).rejects.toThrow()
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it.each([
    ['orders.place', () => backend().orders.place({ instrumentId: 'a', side: 'Buy' as const, lots: '1', idempotencyKey: 'k' })],
    ['orders.modify', () => backend().orders.modify({ positionId: 'p', idempotencyKey: 'k' })],
    ['orders.cancel', () => backend().orders.cancel({ positionId: 'p', idempotencyKey: 'k' })],
    ['orders.close', () => backend().orders.close({ positionId: 'p', idempotencyKey: 'k' })],
  ])('%s stays blocked pending written authorization (guide §7.3)', async (_name, call) => {
    await expect(call()).rejects.toThrow(/written authorization/)
  })

  it.each([
    ['funds.deposit', () => backend().funds.deposit({ accountId: 'a', amount: '100', method: 'card', idempotencyKey: 'k' })],
    ['funds.requestWithdrawal', () => backend().funds.requestWithdrawal({ accountId: 'a', amount: '100', method: 'bank', idempotencyKey: 'k' })],
    ['funds.transfer', () => backend().funds.transfer({ fromAccountId: 'a', toAccountId: 'b', amount: '100', idempotencyKey: 'k' })],
  ])('%s stays blocked until money cannot actually move (guide §7.4)', async (_name, call) => {
    // Guide §2: "real-money funding must remain disabled".
    await expect(call()).rejects.toThrow(/non-live test method/)
  })
})
