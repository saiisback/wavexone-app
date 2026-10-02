import { WAVEX_PORTAL_ORIGIN, WAVEX_PORTAL_URL, WAVEX_TRADING_URL } from '../../src/backend'
import { DEFAULT_TIMEOUT_MS, Gate } from '../../src/backend/gate'

/**
 * The transport against the real servers, without signing in: what the API
 * really does with a request that carries no credentials, and proof that the
 * live suite cannot send a mutation even by accident.
 */

const gate = new Gate({
  tradingBaseUrl: WAVEX_TRADING_URL,
  portalBaseUrl: WAVEX_PORTAL_URL,
  portalOrigin: WAVEX_PORTAL_ORIGIN,
  chartingBaseUrl: WAVEX_PORTAL_URL,
  // Above every phase, so only the test fetch's own guard stands in the way.
  phase: 4,
  timeoutMs: DEFAULT_TIMEOUT_MS,
})

it('reports a trading read without credentials as signed out, not as data', async () => {
  await expect(gate.callJson('watch')).rejects.toMatchObject({ kind: 'auth', status: 401 })
})

it('reports a portal read without a session as signed out', async () => {
  await expect(gate.callJson('bootstrap')).rejects.toMatchObject({ kind: 'auth' })
})

it('never lets a mutation leave the machine during a live run', async () => {
  const failure = await gate
    .call('placeOrder', { query: { token: 'none' }, idempotencyKey: 'live-guard' })
    .then(() => undefined, (error: unknown) => error)

  // The app reads a failed send as "may not have gone through", which is the
  // safe reading for an order. Underneath it is the guard, not the network.
  expect(failure).toMatchObject({ kind: 'blocked' })
  const transport = (failure as { cause?: { cause?: unknown } }).cause
  expect(String(transport?.cause)).toMatch(/read-only/)
})
