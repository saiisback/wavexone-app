import { ClientPortalAdapter } from '../../src/backend/adapters/client-portal'
import { BackendError } from '../../src/backend/errors'
import { Gate, type BackendConfig } from '../../src/backend/gate'
import type { SessionMaterial } from '../../src/backend/secure-session-store'
import { portalBootstrapResponse } from './fixtures/portal-responses'

/**
 * Guide §3.2. The portal is a second, cookie-backed session, and the rule
 * that matters is asymmetric: a read may be replayed after re-establishing
 * the session, a mutation may not (§4.5).
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

let fetchMock: jest.Mock

function adapter() {
  return new ClientPortalAdapter(new Gate(CONFIG))
}

beforeEach(() => {
  fetchMock = jest.fn().mockResolvedValue({ status: 200, text: async () => '{"status":"success"}' })
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

describe('establish', () => {
  it('posts the account token to setPortalSession with the approved Origin', async () => {
    // Guide §3.2 steps 2–3.
    await adapter().establish(MATERIAL)

    const [url, init] = fetchMock.mock.calls[0]
    expect(url).toContain('setPortalSession')
    expect(init.method).toBe('POST')
    expect(init.body).toContain('token=acct-1')
    expect(init.headers.Origin).toBe(CONFIG.portalOrigin)
    // Step 3: the cookie jar only fills if the request opts in.
    expect(init.credentials).toBe('include')
  })

  it('establishes once and reuses the session afterwards', async () => {
    const portal = adapter()
    await portal.establish(MATERIAL)
    await portal.establish(MATERIAL)
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('never reads the cookie into JS', async () => {
    // Guide §3.3: holding the cookie would mean storing it. The platform jar
    // owns it, so the adapter exposes no way to get at it.
    const portal = adapter()
    await portal.establish(MATERIAL)
    expect(JSON.stringify(portal)).not.toContain('cookie')
  })
})

describe('read', () => {
  it('establishes the session before the first read', async () => {
    await adapter().read(MATERIAL, () => Promise.resolve('data'))
    expect(fetchMock.mock.calls[0][0]).toContain('setPortalSession')
  })

  it('returns the value without retrying when the read succeeds', async () => {
    const call = jest.fn().mockResolvedValue('data')
    await expect(adapter().read(MATERIAL, call)).resolves.toBe('data')
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('re-establishes and replays once after an expired cookie', async () => {
    // Guide §3.2 step 5.
    const call = jest
      .fn()
      .mockRejectedValueOnce(new BackendError('auth', 'expired'))
      .mockResolvedValueOnce('data')

    await expect(adapter().read(MATERIAL, call)).resolves.toBe('data')
    expect(call).toHaveBeenCalledTimes(2)
    // Two setPortalSession calls: the initial one and the re-establish.
    expect(fetchMock.mock.calls.filter(([url]) => url.includes('setPortalSession'))).toHaveLength(2)
  })

  it('gives up rather than looping when the replay also fails on auth', async () => {
    const call = jest.fn().mockRejectedValue(new BackendError('auth', 'expired'))
    await expect(adapter().read(MATERIAL, call)).rejects.toMatchObject({ kind: 'auth' })
    expect(call).toHaveBeenCalledTimes(2)
  })

  it('does not re-establish for a non-auth failure', async () => {
    // A 500 is not a session problem; replaying it just doubles the load.
    const call = jest.fn().mockRejectedValue(new BackendError('server', 'boom'))
    await expect(adapter().read(MATERIAL, call)).rejects.toMatchObject({ kind: 'server' })
    expect(call).toHaveBeenCalledTimes(1)
  })

  it('does not swallow a plain Error', async () => {
    const call = jest.fn().mockRejectedValue(new TypeError('bug'))
    await expect(adapter().read(MATERIAL, call)).rejects.toBeInstanceOf(TypeError)
    expect(call).toHaveBeenCalledTimes(1)
  })
})

describe('readBootstrap', () => {
  it('establishes the cookie session and parses the portal bootstrap', async () => {
    fetchMock
      .mockResolvedValueOnce({ status: 200, text: async () => '{"status":"success"}' })
      .mockResolvedValueOnce({
        status: 200,
        text: async () => JSON.stringify(portalBootstrapResponse),
      })

    await expect(adapter().readBootstrap(MATERIAL)).resolves.toMatchObject({
      user: { id: '1', accountId: 'account-1' },
      accounts: [{ id: 'account-1', number: '10001' }],
    })
    expect(fetchMock.mock.calls[0][0]).toContain('setPortalSession')
    expect(fetchMock.mock.calls[1][0]).toContain('apiBootstrap')
  })
})

describe('headers', () => {
  it('sends X-Portal-Token only when acting on a sibling account', () => {
    // Guide §3.2 step 4.
    expect(adapter().headers('portal-1')).toEqual({ 'X-Portal-Token': 'portal-1' })
    expect(adapter().headers()).toEqual({})
  })
})

describe('reset', () => {
  it('forces a fresh session so the next user does not inherit one', async () => {
    const portal = adapter()
    await portal.establish(MATERIAL)
    portal.reset()
    await portal.establish(MATERIAL)
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('withdrawal', () => {
  function phase3Adapter() {
    return new ClientPortalAdapter(new Gate({ ...CONFIG, phase: 3 }))
  }

  function bodyOf(call: unknown[]) {
    return JSON.parse((call[1] as { body: string }).body) as Record<string, string>
  }

  it('describes the destination identically for the OTP and the submission', async () => {
    // An OTP issued for one address and a withdrawal naming another is the
    // failure this pins.
    const portal = phase3Adapter()
    const details = { account: '12345678' }

    await portal.sendWithdrawalOtp(MATERIAL, {
      accountId: 'account-1',
      amount: '50.00',
      details,
      idempotencyKey: 'otp-1',
    })
    await portal.withdraw(MATERIAL, {
      accountId: 'account-1',
      amount: '50.00',
      method: 'Bank transfer',
      details,
      otp: '123456',
      idempotencyKey: 'withdraw-1',
    })

    const otpCall = fetchMock.mock.calls.find(([url]) => String(url).includes('apiSendWithdrawOtp'))
    const submitCall = fetchMock.mock.calls.find(([url]) => String(url).includes('apiSubmitWithdraw'))
    expect(otpCall).toBeDefined()
    expect(submitCall).toBeDefined()
    expect(bodyOf(otpCall!).withdrawAddress).toBe(JSON.stringify(details))
    expect(bodyOf(submitCall!).withdrawAddress).toBe(bodyOf(otpCall!).withdrawAddress)
  })
})

describe('funding request contracts from the supplied collection', () => {
  const details = { account: '12345678' }
  const funding = { accountId: 'account-1', amount: '50.00', method: 'Bank transfer', idempotencyKey: 'funding-1' }
  const cases = [
    { route: 'apiSubmitDeposit', call: (portal: ClientPortalAdapter) => portal.deposit(MATERIAL, funding), encoding: 'multipart', body: { amount: '50.00', method: 'Bank transfer', targetAccountId: 'account-1' } },
    { route: 'apiSendWithdrawOtp', call: (portal: ClientPortalAdapter) => portal.sendWithdrawalOtp(MATERIAL, { ...funding, details }), encoding: 'json', body: { sourceId: 'account-1', amount: '50.00', withdrawAddress: '{"account":"12345678"}' } },
    { route: 'apiSubmitWithdraw', call: (portal: ClientPortalAdapter) => portal.withdraw(MATERIAL, { ...funding, details, otp: '123456' }), encoding: 'json', body: { sourceId: 'account-1', amount: '50.00', method: 'Bank transfer', withdrawAddress: '{"account":"12345678"}', otp: '123456' } },
    { route: 'apiTransfer', call: (portal: ClientPortalAdapter) => portal.transfer(MATERIAL, { fromAccountId: 'account-1', toAccountId: 'account-2', amount: '50.00', idempotencyKey: 'transfer-1' }), encoding: 'json', body: { source: 'account-1', destination: 'account-2', amount: '50.00', memo: '' } },
    { route: 'submitDemoDeposit', call: (portal: ClientPortalAdapter) => portal.demoDeposit(MATERIAL, funding), encoding: 'form', body: 'deposit_amount=50.00' },
  ]

  it.each(cases)('$route sends the exact POST body and deduplicates one confirmed intent', async ({ route, call, encoding, body }) => {
    const portal = new ClientPortalAdapter(new Gate({ ...CONFIG, phase: 3 }))
    await portal.establish(MATERIAL)
    await Promise.all([call(portal), call(portal)])
    await call(portal)
    const requests = fetchMock.mock.calls.filter(([url]) => String(url).endsWith(route))
    expect(requests).toHaveLength(1)
    const [, init] = requests[0]
    expect(init.method).toBe('POST')
    expect(init.credentials).toBe('include')
    expect(init.headers.Origin).toBe(CONFIG.portalOrigin)
    if (encoding === 'multipart') {
      expect(init.headers['Content-Type']).toBeUndefined()
      expect(Object.fromEntries(init.body.entries())).toEqual(body)
    } else if (encoding === 'json') {
      expect(init.headers['Content-Type']).toBe('application/json')
      expect(JSON.parse(init.body)).toEqual(body)
    } else {
      expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
      expect(init.body).toBe(body)
    }
  })

  it('includes the optional proof only when supplied', async () => {
    const portal = new ClientPortalAdapter(new Gate({ ...CONFIG, phase: 3 }))
    await portal.deposit(MATERIAL, { ...funding, proof: { uri: 'file:///proof.png', name: 'proof.png', mimeType: 'image/png', size: 1024 } })
    const [, init] = fetchMock.mock.calls.find(([url]) => String(url).endsWith('apiSubmitDeposit'))!
    expect(Array.from(init.body.keys())).toEqual(['amount', 'method', 'targetAccountId', 'proof'])
  })

  it.each(cases)('$route never retries an ambiguous network failure', async ({ route, call }) => {
    const portal = new ClientPortalAdapter(new Gate({ ...CONFIG, phase: 3 }))
    await portal.establish(MATERIAL)
    fetchMock.mockRejectedValue(new TypeError('network disconnected'))
    await expect(call(portal)).rejects.toMatchObject({ kind: 'blocked' })
    await expect(call(portal)).rejects.toMatchObject({ kind: 'blocked' })
    expect(fetchMock.mock.calls.filter(([url]) => String(url).endsWith(route))).toHaveLength(1)
  })
})
