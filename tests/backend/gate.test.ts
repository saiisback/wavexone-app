import { BackendError } from '../../src/backend/errors'
import { Gate, type BackendConfig } from '../../src/backend/gate'
import { unwrapEnvelope } from '../../src/backend/http'

/**
 * The duplicate-submission guard is the part of this module that can lose
 * someone money, so it is tested against the specific ways guide §4.5 and
 * §6.4 say these calls go wrong.
 */

const BASE: BackendConfig = {
  tradingBaseUrl: 'https://trading.example',
  portalBaseUrl: 'https://portal.example',
  chartingBaseUrl: 'https://charts.example',
  portalOrigin: 'https://app.example',
  phase: 4,
  timeoutMs: 1000,
}

function gateWith(overrides: Partial<BackendConfig> = {}) {
  return new Gate({ ...BASE, ...overrides })
}

function respondWith(status: number, body: string) {
  return jest.fn().mockResolvedValue({ status, text: async () => body })
}

let fetchMock: jest.Mock

beforeEach(() => {
  fetchMock = respondWith(200, '{"status":"success","data":{}}')
  globalThis.fetch = fetchMock as unknown as typeof fetch
})

describe('construction', () => {
  it('refuses a plaintext base URL', () => {
    // Guide §6.9. The realistic failure is a misconfigured staging host,
    // not someone disabling TLS in code.
    expect(() => gateWith({ tradingBaseUrl: 'http://trading.example' })).toThrow(BackendError)
  })
})

describe('denied endpoints', () => {
  it.each(['swapFunctionality', 'sendnotification', 'transferBalance', 'getPayoutInfo', 'getPayinInfo'])(
    'blocks %s',
    (name) => {
      expect(() => Gate.assertAllowed(name)).toThrow(/Blocked/)
    },
  )

  it('allows a route that is not on the list', () => {
    expect(() => Gate.assertAllowed('futureDocumentedRoute')).not.toThrow()
  })
})

describe('phase gating', () => {
  it('refuses a phase 2 call from a phase 1 build', async () => {
    const gate = gateWith({ phase: 1 })
    await expect(
      gate.call('placeOrder', { idempotencyKey: 'a' }),
    ).rejects.toThrow(/delivery phase 2/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('allows a phase 1 read from a phase 1 build', async () => {
    const gate = gateWith({ phase: 1 })
    await expect(gate.call('accountList')).resolves.toMatchObject({ status: 200 })
  })
})

describe('mutations', () => {
  it('refuses a mutation with no idempotency key', async () => {
    await expect(gateWith().call('placeOrder')).rejects.toThrow(/idempotency key/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('refuses a parameter the endpoint does not accept', async () => {
    // The API ignores unknown parameters rather than rejecting them, so
    // `orderId` where the route wants `orderID` would report success having
    // modified nothing. Fail at the call site instead.
    const gate = gateWith()
    await expect(
      gate.call('modifyOrder', { query: { orderId: '8612' }, idempotencyKey: 'a' }),
    ).rejects.toThrow(/does not accept orderId/)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('names the parameters it does accept, so the fix is obvious', async () => {
    const gate = gateWith()
    await expect(gate.call('ordersCount', { query: { account: '10233' } })).rejects.toThrow(
      /It accepts: token/,
    )
  })

  it('checks body parameters as well as query parameters', async () => {
    const gate = gateWith()
    await expect(
      gate.call('requestPayment', { body: { from: 'a', to: 'b' }, idempotencyKey: 'a' }),
    ).rejects.toThrow(/does not accept from, to/)
  })

  it('sends one request when the same intent is submitted twice', async () => {
    const gate = gateWith()
    const key = 'order-1'

    await Promise.all([
      gate.call('placeOrder', { idempotencyKey: key }),
      gate.call('placeOrder', { idempotencyKey: key }),
    ])

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('still refuses a repeat after the first one finished', async () => {
    const gate = gateWith()
    await gate.call('placeOrder', { idempotencyKey: 'order-1' })
    await gate.call('placeOrder', { idempotencyKey: 'order-1' })

    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('treats a different intent as a different order', async () => {
    const gate = gateWith()
    await gate.call('placeOrder', { idempotencyKey: 'order-1' })
    await gate.call('placeOrder', { idempotencyKey: 'order-2' })

    expect(fetchMock).toHaveBeenCalledTimes(2)
  })

  it('does not replay a mutation that failed in transit', async () => {
    // The dangerous case: the server may or may not have placed the order.
    // Guide §4.5 forbids replaying it.
    fetchMock.mockRejectedValue(new TypeError('network down'))
    const gate = gateWith()

    await expect(gate.call('closePosition', { idempotencyKey: 'close-1' })).rejects.toThrow(
      /could not confirm/,
    )

    fetchMock.mockResolvedValue({ status: 200, text: async () => '{}' })
    await expect(gate.call('closePosition', { idempotencyKey: 'close-1' })).rejects.toThrow(
      /could not confirm/,
    )
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it('lets the user correct and resubmit after a clean rejection', async () => {
    // A 400 means the server definitely did not act, so the same intent may
    // legitimately be sent again once the input is fixed.
    fetchMock.mockResolvedValue({ status: 400, text: async () => 'amount too low' })
    const gate = gateWith()

    await expect(gate.call('placeOrder', { idempotencyKey: 'order-1' })).rejects.toThrow(
      BackendError,
    )

    fetchMock.mockResolvedValue({ status: 200, text: async () => '{}' })
    await expect(gate.call('placeOrder', { idempotencyKey: 'order-1' })).resolves.toBeDefined()
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})

describe('envelope handling', () => {
  it('treats an HTTP 200 with status fail as a failure', () => {
    // Guide §5: legacy HTTP-200 failures.
    expect(() =>
      unwrapEnvelope(
        { status: 200, json: { status: 'fail', message: 'Market closed' }, text: '' },
        'placeOrder',
      ),
    ).toThrow(BackendError)
  })

  it('rejects a non-JSON body where a document was expected', () => {
    expect(() => unwrapEnvelope({ status: 200, json: undefined, text: 'OK' }, 'orders')).toThrow(
      /non-JSON/,
    )
  })

  it('unwraps the data field when there is one', () => {
    const body = { status: 'success', data: { open: 2 } }
    expect(unwrapEnvelope({ status: 200, json: body, text: '' }, 'ordersCount')).toEqual({ open: 2 })
  })

  it('keeps the server message for diagnostics but not for the user', () => {
    try {
      unwrapEnvelope({ status: 200, json: { status: 'error', message: 'SQLSTATE[42000]' }, text: '' }, 'orders')
      throw new Error('should have thrown')
    } catch (error) {
      expect(error).toBeInstanceOf(BackendError)
      const backendError = error as BackendError
      expect(backendError.serverMessage).toBe('SQLSTATE[42000]')
      expect(backendError.message).not.toContain('SQLSTATE')
    }
  })
})

describe('request shape', () => {
  it('puts the collect name in the query for trading calls', async () => {
    await gateWith().call('accountList')
    expect(fetchMock.mock.calls[0][0]).toContain('collect=accountList')
  })

  it('sends the approved Origin on portal calls', async () => {
    await gateWith().call('bootstrap')
    expect(fetchMock.mock.calls[0][1].headers.Origin).toBe(BASE.portalOrigin)
    expect(fetchMock.mock.calls[0][1].credentials).toBe('include')
  })

  it('does not send cookies on trading calls', async () => {
    await gateWith().call('accountList')
    expect(fetchMock.mock.calls[0][1].credentials).toBe('omit')
  })
})
