import { TradingApiAdapter } from '../../src/backend/adapters/trading-api'
import { BackendError } from '../../src/backend/errors'
import { Gate, type BackendConfig } from '../../src/backend/gate'
import type { SessionMaterial } from '../../src/backend/secure-session-store'

/**
 * The guide §3.1 handshake, which is the one flow the guide documents
 * step by step — so it is the one flow that can be tested against a spec
 * rather than against an assumption.
 *
 * The two cases worth the most here are the raw-token body (step 4) and the
 * promise that the password goes nowhere (§3.3).
 */

const CONFIG: BackendConfig = {
  tradingBaseUrl: 'https://trading.example',
  portalBaseUrl: 'https://portal.example',
  chartingBaseUrl: 'https://charts.example',
  portalOrigin: 'https://app.example',
  phase: 1,
  timeoutMs: 1000,
}

const MATERIAL: SessionMaterial = {
  accountToken: 'acct-1',
  secretKey: 'sk-1',
  bearerToken: 'bearer-1',
  footprint: 'fp-1',
  issuedAt: '2026-01-01T00:00:00.000Z',
}

/** Replies in call order, so a handshake can be scripted end to end. */
function scriptFetch(...replies: { status?: number; body: string }[]) {
  const mock = jest.fn()
  for (const reply of replies) {
    mock.mockResolvedValueOnce({ status: reply.status ?? 200, text: async () => reply.body })
  }
  globalThis.fetch = mock as unknown as typeof fetch
  return mock
}

function adapter() {
  return new TradingApiAdapter(new Gate(CONFIG))
}

const CHECK_OK = { body: '{"status":"success","data":{"token":"acct-1","secretkey":"sk-1"}}' }
const BEARER_OK = { body: 'raw.bearer.token' }

describe('signIn', () => {
  it('parses the confirmed live check response and drops the echoed password', async () => {
    scriptFetch(
      {
        body: JSON.stringify({
          userID: 'user-1',
          status: 'success',
          token: 'acct-1',
          mode: 'live',
          session_id: 'session-1',
          password: 'echoed-secret',
          verify: '1',
          secret_key: 'sk-1',
          footprint: 'server-fp',
        }),
      },
      BEARER_OK,
    )

    const outcome = await adapter().signIn('a@b.com', 'request-secret', 'local-fp')

    expect(outcome).toMatchObject({
      kind: 'authenticated',
      material: {
        accountToken: 'acct-1',
        secretKey: 'sk-1',
        footprint: 'server-fp',
      },
    })
    expect(JSON.stringify(outcome)).not.toContain('echoed-secret')
    expect(JSON.stringify(outcome)).not.toContain('request-secret')
  })

  it('completes the check then bearer handshake and returns usable material', async () => {
    const fetchMock = scriptFetch(CHECK_OK, BEARER_OK)

    const outcome = await adapter().signIn('a@b.com', 'pw', 'fp-1')

    expect(outcome).toMatchObject({
      kind: 'authenticated',
      material: { accountToken: 'acct-1', secretKey: 'sk-1', bearerToken: 'raw.bearer.token' },
    })
    expect(fetchMock.mock.calls[0][0]).toContain('collect=check')
    expect(fetchMock.mock.calls[1][0]).toContain('collect=bearer')
  })

  it('sends the secret key as the Secretkey header on the bearer call', async () => {
    // Guide §3.1 step 3.
    const fetchMock = scriptFetch(CHECK_OK, BEARER_OK)
    await adapter().signIn('a@b.com', 'pw', 'fp-1')
    expect(fetchMock.mock.calls[1][1].headers.Secretkey).toBe('sk-1')
  })

  it('stamps issuedAt so expiry can be reasoned about later', async () => {
    scriptFetch(CHECK_OK, BEARER_OK)
    const outcome = await adapter().signIn('a@b.com', 'pw', 'fp-1')
    if (outcome.kind !== 'authenticated') throw new Error('expected authentication')
    expect(Date.parse(outcome.material.issuedAt)).not.toBeNaN()
  })

  describe('the password (guide §3.3)', () => {
    it('is sent once, to check, and never to the bearer call', async () => {
      const fetchMock = scriptFetch(CHECK_OK, BEARER_OK)
      await adapter().signIn('a@b.com', 'hunter2', 'fp-1')

      expect(fetchMock.mock.calls[0][1].body).toContain('password=hunter2')
      expect(JSON.stringify(fetchMock.mock.calls[1])).not.toContain('hunter2')
    })

    it('never appears in the material that gets persisted', async () => {
      scriptFetch(CHECK_OK, BEARER_OK)
      const outcome = await adapter().signIn('a@b.com', 'hunter2', 'fp-1')
      expect(JSON.stringify(outcome)).not.toContain('hunter2')
    })
  })

  describe('field-name variants', () => {
    it.each([
      ['token / secretkey', '{"token":"acct-1","secretkey":"sk-1"}'],
      ['accountToken / secretKey', '{"accountToken":"acct-1","secretKey":"sk-1"}'],
      ['account_token / secret_key', '{"account_token":"acct-1","secret_key":"sk-1"}'],
    ])('reads %s', async (_label, body) => {
      scriptFetch({ body }, BEARER_OK)
      await expect(adapter().signIn('a@b.com', 'pw', 'fp-1')).resolves.toMatchObject({
        kind: 'authenticated',
      })
    })

    it('accepts a numeric token rather than dropping it', async () => {
      scriptFetch({ body: '{"token":12345,"secretkey":"sk-1"}' }, BEARER_OK)
      const outcome = await adapter().signIn('a@b.com', 'pw', 'fp-1')
      if (outcome.kind !== 'authenticated') throw new Error('expected authentication')
      expect(outcome.material.accountToken).toBe('12345')
    })
  })

  it('prefers the footprint the server echoes back', async () => {
    // Guide §3.1 step 2: both sides should agree on the device identity.
    scriptFetch({ body: '{"token":"a","secretkey":"s","footprint":"server-fp"}' }, BEARER_OK)
    const outcome = await adapter().signIn('a@b.com', 'pw', 'local-fp')
    if (outcome.kind !== 'authenticated') throw new Error('expected authentication')
    expect(outcome.material.footprint).toBe('server-fp')
  })

  it.each(['0', 'false', 'pending'])(
    'stops at verification when verified is %s',
    async (verified) => {
      const fetchMock = scriptFetch({
        body: `{"token":"acct-1","secretkey":"sk-1","verified":"${verified}"}`,
      })

      await expect(adapter().signIn('a@b.com', 'pw', 'fp-1')).resolves.toEqual({
        kind: 'verification-required',
        accountToken: 'acct-1',
      })
      // No bearer is issued for an unverified account.
      expect(fetchMock).toHaveBeenCalledTimes(1)
    },
  )

  it('fails loudly when the session fields are missing', async () => {
    // Silently producing material with `undefined` where a token belongs is
    // the failure this guards: it would surface much later as a 401 loop.
    scriptFetch({ body: '{"status":"success","data":{"message":"ok"}}' })
    await expect(adapter().signIn('a@b.com', 'pw', 'fp-1')).rejects.toMatchObject({
      kind: 'malformed',
    })
  })

  it('surfaces a rejected sign-in as an auth failure, not a crash', async () => {
    scriptFetch({ status: 401, body: 'bad credentials' })
    await expect(adapter().signIn('a@b.com', 'wrong', 'fp-1')).rejects.toMatchObject({
      kind: 'auth',
    })
  })

  it('treats an HTTP 200 envelope failure as a failure', async () => {
    scriptFetch({ body: '{"status":"fail","message":"account locked"}' })
    await expect(adapter().signIn('a@b.com', 'pw', 'fp-1')).rejects.toMatchObject({
      kind: 'rejected',
    })
  })
})

describe('issueBearer', () => {
  it('treats the entire raw body as the token', async () => {
    // Guide §3.1 step 4 — the one call that must not be parsed.
    scriptFetch({ body: '  raw.bearer.token\n' })
    await expect(adapter().issueBearer('acct-1', 'sk-1', 'fp-1')).resolves.toBe('raw.bearer.token')
  })

  it('refuses an empty token', async () => {
    scriptFetch({ body: '   ' })
    await expect(adapter().issueBearer('acct-1', 'sk-1', 'fp-1')).rejects.toMatchObject({
      kind: 'auth',
    })
  })

  it.each(['{"status":"ok"}', '[1,2]'])('refuses JSON where a raw token was expected: %s', async (body) => {
    // Sending `{"status":"ok"}` as an Authorization value would fail far from
    // the cause, so the contract change is caught here.
    scriptFetch({ body })
    await expect(adapter().issueBearer('acct-1', 'sk-1', 'fp-1')).rejects.toMatchObject({
      kind: 'malformed',
    })
  })
})

describe('isSessionValid', () => {
  it('is true when auth answers successfully', async () => {
    scriptFetch({ body: '{"status":"success","data":{}}' })
    await expect(adapter().isSessionValid(MATERIAL)).resolves.toBe(true)
  })

  it('is false when the session has expired', async () => {
    scriptFetch({ status: 401, body: 'expired' })
    await expect(adapter().isSessionValid(MATERIAL)).resolves.toBe(false)
  })

  it('rethrows a network failure instead of reporting a signed-out user', async () => {
    // Being offline is not the same as being signed out; conflating them
    // would sign people out every time they lost signal.
    globalThis.fetch = jest.fn().mockRejectedValue(new TypeError('offline')) as unknown as typeof fetch
    await expect(adapter().isSessionValid(MATERIAL)).rejects.toBeInstanceOf(BackendError)
  })
})

describe('headers', () => {
  it('sends the documented Authorization header plus the legacy credentials', () => {
    expect(adapter().headers(MATERIAL)).toEqual({
      Authorization: 'Bearer bearer-1',
      Secretkey: 'sk-1',
      Bearer: 'bearer-1',
    })
  })
})

describe('marketData', () => {
  it('starts the catalogue and symbol settings requests together', async () => {
    let resolveCatalogue!: (response: { status: number; text(): Promise<string> }) => void
    let resolveMetadata!: (response: { status: number; text(): Promise<string> }) => void
    const fetchMock = jest
      .fn()
      .mockImplementationOnce(() => new Promise((resolve) => { resolveCatalogue = resolve }))
      .mockImplementationOnce(() => new Promise((resolve) => { resolveMetadata = resolve }))
    globalThis.fetch = fetchMock as unknown as typeof fetch

    const pending = adapter().marketData(MATERIAL)

    expect(fetchMock).toHaveBeenCalledTimes(2)
    resolveCatalogue({
      status: 200,
      text: async () => JSON.stringify({ fx: [{ name: 'Gold', ticker: 'C:XAUUSD', market: 'metals' }] }),
    })
    resolveMetadata({
      status: 200,
      text: async () => JSON.stringify({ XAUUSD: { spread: 1, decimal: 2, lot: 100 } }),
    })
    await expect(pending).resolves.toMatchObject({ catalogue: [expect.objectContaining({ ticker: 'C:XAUUSD' })] })
  })

  it('reads the catalogue and symbol settings, and not the dead current-day route', async () => {
    const fetchMock = scriptFetch(
      { body: JSON.stringify({ fx: [{ name: 'Gold', ticker: 'C:XAUUSD', market: 'metals' }], crypto: [] }) },
      { body: JSON.stringify({ XAUUSD: { spread: 1, decimal: 2, lot: 100 } }) },
    )

    const result = await adapter().marketData(MATERIAL)

    expect(result.catalogue).toHaveLength(1)
    expect(result.metadata.get('XAUUSD')).toEqual({ spread: 1, precision: 2, lot: 100 })
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(fetchMock.mock.calls.map(([url]) => String(url))).not.toContainEqual(
      expect.stringContaining('getCurrentDayData'),
    )
  })
})

describe('setFavorite', () => {
  it('rejects an HTTP 200 business failure', async () => {
    scriptFetch({ body: '{"status":"fail","message":"not saved"}' })

    await expect(
      adapter().setFavorite(MATERIAL, {
        instrumentId: 'c:xauusd',
        favorite: true,
        idempotencyKey: 'favorite-1',
      }),
    ).rejects.toMatchObject({ kind: 'rejected' })
  })
})

describe('closedOrders', () => {
  it('uses the documented closed-history filter values', async () => {
    const fetchMock = scriptFetch({
      body: JSON.stringify({ info: { page: 1, total: 0, count: 0 }, data: [] }),
    })

    await adapter().closedOrders(MATERIAL)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('type=')
    expect(url).toContain('filter=24hr')
  })
})

describe('order fingerprint', () => {
  /** `create_fingerprint` is phase 2, so the gate has to allow it. */
  function phase2Adapter() {
    return new TradingApiAdapter(new Gate({ ...CONFIG, phase: 2 }))
  }

  /**
   * Synthetic, but the real shape: 32 hex characters, an underscore, then the
   * account id. The collection's own samples are live credentials and are not
   * copied into this repo.
   */
  const FINGERPRINT = '0123456789abcdef0123456789abcdef_8'

  it('asks create_fingerprint for the account, not the footprint', async () => {
    // The two are different identifiers. `placeorder` wants this one.
    const fetchMock = scriptFetch({ body: FINGERPRINT })
    await expect(phase2Adapter().issueOrderFingerprint(MATERIAL, '8')).resolves.toBe(FINGERPRINT)

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('collect=create_fingerprint')
    expect(url).toContain('account_id=8')
    expect(url).not.toContain('footprint')
  })

  it('reads the value out of an envelope when it gets one', async () => {
    // The collection captured no response for this route, so both a bare
    // body and a wrapped one have to be survivable.
    scriptFetch({ body: '{"status":"success","data":{"fingerprint":"abc_22"}}' })
    await expect(phase2Adapter().issueOrderFingerprint(MATERIAL, '22')).resolves.toBe('abc_22')
  })

  it('refuses a value that is not for the account it asked about', async () => {
    // Handing the wrong fingerprint to `placeorder` is worse than failing.
    scriptFetch({ body: 'abc_999' })
    await expect(phase2Adapter().issueOrderFingerprint(MATERIAL, '8')).rejects.toMatchObject({
      kind: 'malformed',
    })
  })

  it('refuses an empty body rather than sending a blank fingerprint', async () => {
    scriptFetch({ body: '' })
    await expect(phase2Adapter().issueOrderFingerprint(MATERIAL, '8')).rejects.toMatchObject({
      kind: 'malformed',
    })
  })

  it('stays unreachable from a phase 1 build', async () => {
    // Guide §8: order plumbing belongs to phase 2.
    await expect(adapter().issueOrderFingerprint(MATERIAL, '8')).rejects.toThrow(
      /delivery phase 2/,
    )
  })

  it('does not issue twice for the same account', async () => {
    // Registered as a mutation, so the duplicate-submission guard applies.
    const fetchMock = scriptFetch({ body: 'abc_8' }, { body: 'different_8' })
    const subject = phase2Adapter()

    await subject.issueOrderFingerprint(MATERIAL, '8')
    await subject.issueOrderFingerprint(MATERIAL, '8')

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })
})

describe('order mutations', () => {
  function phase2Adapter() {
    return new TradingApiAdapter(new Gate({ ...CONFIG, phase: 2 }))
  }

  const FINGERPRINT = '0123456789abcdef0123456789abcdef_acct-1'
  const ACK = { body: '{"status":"success"}' }

  it('edits an open position through mobileapp_modifyorder', async () => {
    const fetchMock = scriptFetch(ACK)
    await phase2Adapter().modifyOrder(
      MATERIAL,
      { positionId: '8612', state: 'Open', stopLoss: '2300.00', takeProfit: '2500.00', idempotencyKey: 'm-1' },
      FINGERPRINT,
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('collect=mobileapp_modifyorder')
    expect(url).toContain('orderID=8612')
    expect(url).toContain('stoploss=2300.00')
    expect(url).toContain('target=2500.00')
    expect(url).not.toContain('trigger=')
  })

  it('edits a pending order through its own route and resends the trigger', async () => {
    // The open-position route would leave a pending order untouched while
    // the API still answers success.
    const fetchMock = scriptFetch(ACK)
    await phase2Adapter().modifyOrder(
      MATERIAL,
      { positionId: '8613', state: 'Pending', trigger: '1.08500', stopLoss: '1.09000', idempotencyKey: 'm-2' },
      FINGERPRINT,
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('collect=mobileapp_modifypendingorder')
    expect(url).toContain('trigger=1.08500')
    expect(url).toContain('stoploss=1.09000')
  })

  it('rejects a modify the server answers with a failure envelope', async () => {
    scriptFetch({ body: '{"status":"fail","message":"invalid stop loss"}' })
    await expect(
      phase2Adapter().modifyOrder(
        MATERIAL,
        { positionId: '8612', state: 'Open', stopLoss: '1', idempotencyKey: 'm-3' },
        FINGERPRINT,
      ),
    ).rejects.toBeInstanceOf(BackendError)
  })

  it('stays unreachable from a phase 1 build', async () => {
    await expect(
      adapter().modifyOrder(
        MATERIAL,
        { positionId: '8612', state: 'Open', idempotencyKey: 'm-4' },
        FINGERPRINT,
      ),
    ).rejects.toThrow(/delivery phase 2/)
  })

  it('places a limit order with its price as the trigger', async () => {
    const fetchMock = scriptFetch(ACK)
    await phase2Adapter().placeOrder(
      MATERIAL,
      { instrumentId: 'eurusd', side: 'Sell', lots: '1.00', limitPrice: '1.08500', idempotencyKey: 'p-1' },
      FINGERPRINT,
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('type=limit')
    expect(url).toContain('bs=sell')
    expect(url).toContain('trigger=1.08500')
  })

  it('places a market order with an empty trigger', async () => {
    const fetchMock = scriptFetch(ACK)
    await phase2Adapter().placeOrder(
      MATERIAL,
      { instrumentId: 'eurusd', side: 'Buy', lots: '0.50', idempotencyKey: 'p-2' },
      FINGERPRINT,
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('type=market')
    // API reference §2.4: the order button flag is `clicked=yes`.
    expect(url).toContain('clicked=yes')
    expect(url).toMatch(/trigger=(&|$)/)
  })

  it('strips the catalogue namespace before sending the trading symbol', async () => {
    const fetchMock = scriptFetch(ACK)
    await phase2Adapter().placeOrder(
      MATERIAL,
      { instrumentId: 'c:xauusd', side: 'Buy', lots: '0.01', idempotencyKey: 'p-3' },
      FINGERPRINT,
    )

    const [url] = fetchMock.mock.calls[0]
    expect(url).toContain('symbol=XAUUSD')
    expect(url).not.toContain('symbol=C%3AXAUUSD')
  })
})
