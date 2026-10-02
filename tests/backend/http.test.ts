import { BackendError } from '../../src/backend/errors'
import { assertHttps, buildUrl, send, unwrapEnvelope } from '../../src/backend/http'
import { httpCapture, httpText } from '../fixtures/captured'

/**
 * Transport behaviour. Guide §5 requires four different failure shapes to
 * arrive as one typed error, and guide §6.9 requires TLS — both are decided
 * here rather than at a call site, so both are tested here.
 */

function request(overrides: Partial<Parameters<typeof send>[0]> = {}) {
  return {
    url: 'https://trading.example/api-v1/v1.php?collect=auth',
    method: 'GET' as const,
    endpoint: 'auth',
    timeoutMs: 1000,
    ...overrides,
  }
}

function respondWith(status: number, body: string) {
  return jest.fn().mockResolvedValue({ status, text: async () => body })
}

let fetchMock: jest.Mock

beforeEach(() => {
  fetchMock = respondWith(200, '{"status":"success","data":{"ok":true}}')
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

describe('assertHttps', () => {
  it.each(['http://trading.example', 'ftp://trading.example', '//trading.example'])(
    'refuses %s',
    (url) => {
      expect(() => assertHttps(url, 'tradingBaseUrl')).toThrow(/https:\/\//)
    },
  )

  it('accepts an https URL', () => {
    expect(() => assertHttps('https://trading.example', 'tradingBaseUrl')).not.toThrow()
  })

  it('refuses a plaintext request URL even if the base was fine', async () => {
    await expect(send(request({ url: 'http://trading.example/x' }))).rejects.toThrow(BackendError)
    expect(fetchMock).not.toHaveBeenCalled()
  })
})

describe('status mapping', () => {
  // Guide §5: one typed error model. Each HTTP family means something
  // different to the caller, so each maps to its own kind.
  it.each([
    [429, 'throttled'],
    [401, 'auth'],
    [403, 'auth'],
    [500, 'server'],
    [503, 'server'],
    [400, 'rejected'],
    [404, 'rejected'],
  ])('maps HTTP %i to %s', async (status, kind) => {
    fetchMock.mockResolvedValue({ status, text: async () => 'nope' })
    await expect(send(request())).rejects.toMatchObject({ kind })
  })

  it('reads the trading API\'s real answer to a missing token as signed out', async () => {
    // Captured: `collect=watch` with no credentials.
    const real = httpCapture('trading/watch', 'gate')
    fetchMock.mockResolvedValue({ status: real.status, text: async () => httpText('trading/watch', 'gate') })
    await expect(send(request())).rejects.toMatchObject({ kind: 'auth', status: 401, retryable: false })
  })

  it('reads the portal\'s real expired-session envelope as signed out, not as a decline', async () => {
    // Captured: `apiBootstrap` with no portal session. A 401 that also says
    // `status: fail` must still be an auth problem, so the portal re-establishes.
    const real = httpCapture<{ status: string }>('portal/apiBootstrap', 'gate')
    expect(real.body.status).toBe('fail')
    fetchMock.mockResolvedValue({ status: real.status, text: async () => httpText('portal/apiBootstrap', 'gate') })
    await expect(send(request())).rejects.toMatchObject({ kind: 'auth' })
  })

  it('returns the body on a 200', async () => {
    await expect(send(request())).resolves.toMatchObject({
      status: 200,
      json: { status: 'success', data: { ok: true } },
    })
  })

  it('marks 5xx, network and timeout as retryable and 4xx as not', async () => {
    // `retryable` is what the mutation guard keys off, so the split matters.
    const kinds = async (status: number) => {
      fetchMock.mockResolvedValue({ status, text: async () => '' })
      return send(request()).catch((error: BackendError) => error.retryable)
    }
    await expect(kinds(500)).resolves.toBe(true)
    await expect(kinds(400)).resolves.toBe(false)
    await expect(kinds(401)).resolves.toBe(false)
  })
})

describe('network failures', () => {
  it('reports a failed send as a network error', async () => {
    fetchMock.mockRejectedValue(new TypeError('offline'))
    await expect(send(request())).rejects.toMatchObject({ kind: 'network', retryable: true })
  })

  it('times out a request that never settles', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => reject(new Error('aborted')))
        }),
    )
    await expect(send(request({ timeoutMs: 10 }))).rejects.toMatchObject({ kind: 'timeout' })
  })
})

describe('request encoding', () => {
  it('form-encodes a body and sets the content type', async () => {
    await send(
      request({
        method: 'POST',
        encoding: 'form',
        body: { email: 'a@b.com', password: 'p w&d' },
      }),
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBe('email=a%40b.com&password=p%20w%26d')
  })

  it('sends a JSON document to the portal routes that parse one', async () => {
    // The portal's api* routes read a JSON body; form-encoding them yields an
    // empty payload and a confusing 400.
    await send(
      request({ method: 'POST', encoding: 'json', body: { ids: ['withdraw-123'], page: 1 } }),
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/json')
    expect(init.body).toBe('{"ids":["withdraw-123"],"page":1}')
  })

  it('sends multipart without a hand-written content type', async () => {
    // The boundary has to come from the runtime; setting the header omits it.
    await send(
      request({ method: 'POST', encoding: 'multipart', body: { amount: '100' } }),
    )
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBeUndefined()
    expect(init.body).toBeInstanceOf(FormData)
  })

  it('drops undefined parameters rather than sending the string "undefined"', async () => {
    // `sl`, `target` and `trigger` are all meaningful when absent.
    await send(
      request({ method: 'POST', encoding: 'form', body: { lot: '0.01', sl: undefined } }),
    )
    expect(fetchMock.mock.calls[0][1].body).toBe('lot=0.01')
  })

  it('defaults to form encoding when none is given', async () => {
    await send(request({ method: 'POST', body: { token: 'abc' } }))
    const [, init] = fetchMock.mock.calls[0]
    expect(init.headers['Content-Type']).toBe('application/x-www-form-urlencoded')
    expect(init.body).toBe('token=abc')
  })

  it('sends no body and no content type on a GET', async () => {
    await send(request())
    const [, init] = fetchMock.mock.calls[0]
    expect(init.body).toBeUndefined()
    expect(init.headers['Content-Type']).toBeUndefined()
  })

  it('opts into cookies only when asked', async () => {
    await send(request({ withCredentials: true }))
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')

    await send(request())
    expect(fetchMock.mock.calls[1][1].credentials).toBe('omit')
  })
})

describe('buildUrl', () => {
  it('percent-encodes keys and values', () => {
    expect(buildUrl('https://x.example', { 'a b': 'c&d' })).toBe('https://x.example?a%20b=c%26d')
  })

  it('omits the question mark when there is no query', () => {
    expect(buildUrl('https://x.example', {})).toBe('https://x.example')
  })
})

describe('unwrapEnvelope', () => {
  it('accepts a success envelope and returns data', () => {
    expect(
      unwrapEnvelope({ status: 200, json: { status: 'success', data: [1, 2] }, text: '' }, 'orders'),
    ).toEqual([1, 2])
  })

  it('returns the whole body when there is no data field', () => {
    expect(unwrapEnvelope({ status: 200, json: { open: 1 }, text: '' }, 'ordersCount')).toEqual({
      open: 1,
    })
  })

  it.each(['fail', 'error', 'FAIL', 'Error'])('treats status %s as a failure', (status) => {
    // Case-insensitive on purpose: this API is not consistent about it.
    expect(() => unwrapEnvelope({ status: 200, json: { status }, text: '' }, 'orders')).toThrow(
      BackendError,
    )
  })

  it('does not treat a plain array body as an envelope', () => {
    expect(unwrapEnvelope({ status: 200, json: [1, 2], text: '' }, 'watch')).toEqual([1, 2])
  })

  it('rejects a body that parsed to a non-object scalar', () => {
    // `tryParseJson` only parses { or [, so a bare token arrives as undefined.
    expect(() => unwrapEnvelope({ status: 200, json: undefined, text: 'abc' }, 'bearer')).toThrow(
      /non-JSON/,
    )
  })
})
