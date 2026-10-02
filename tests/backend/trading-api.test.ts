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
  it('sends both credentials required by guide §3.1 step 5', () => {
    expect(adapter().headers(MATERIAL)).toEqual({ Secretkey: 'sk-1', Bearer: 'bearer-1' })
  })
})

describe('marketData', () => {
  it('batches unprefixed symbols for the documented current-day endpoint', async () => {
    const entries = Array.from({ length: 21 }, (_, index) => ({
      name: `Symbol ${index}`,
      ticker: `C:SYM${String(index).padStart(2, '0')}`,
      market: 'forex',
    }))
    const spreads = Object.fromEntries(
      entries.map(({ ticker }) => [ticker, { spread: 1, decimal: 2, lot: 1 }]),
    )
    const snapshot = (items: typeof entries) => Object.fromEntries(
      items.map(({ ticker }) => [
        ticker.replace(/^[^:]+:/, ''),
        { broker: 1, feed: 2, open: 1, high: 2, low: 1, volume: 1 },
      ]),
    )
    const fetchMock = scriptFetch(
      { body: JSON.stringify({ fx: entries, crypto: [] }) },
      { body: JSON.stringify(spreads) },
      { body: JSON.stringify(snapshot(entries.slice(0, 20))) },
      { body: JSON.stringify(snapshot(entries.slice(20))) },
    )

    const result = await adapter().marketData(MATERIAL)

    expect(result.snapshots.size).toBe(21)
    const dayCalls = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('collect=getCurrentDayData'),
    )
    expect(dayCalls).toHaveLength(2)
    expect(Array.from((dayCalls[0][1].body as FormData).entries())[0][1]).not.toContain('C%3A')
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
