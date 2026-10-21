import { DENIED_ENDPOINTS, ENDPOINTS, type EndpointSpec } from '../../src/backend/endpoints'

/**
 * Invariants over the whole registry.
 *
 * Guide §9 requires that "legacy and unsafe endpoints are blocked by the
 * client module". A test per endpoint would go stale the moment someone adds
 * one, so these assert the property instead — a new entry that breaks a rule
 * fails here without anyone remembering to write a test for it.
 */

const entries = Object.entries(ENDPOINTS) as [string, EndpointSpec][]

describe('the registry as a whole', () => {
  it('lists every endpoint the guide §4 tables name', () => {
    // A rough guard against an endpoint being dropped during a refactor.
    expect(entries.length).toBeGreaterThanOrEqual(45)
  })

  it('never allows an endpoint that is also denied', () => {
    // The denial has to win; an allowed duplicate would route straight past it.
    const allowed = entries.map(([, spec]) => spec.name)
    for (const denied of Object.keys(DENIED_ENDPOINTS)) {
      expect(allowed).not.toContain(denied)
    }
  })

  it('denies every legacy and unsafe route the guide names', () => {
    // §6.5, §6.6, §6.7. The collections turned up further legacy and
    // view-rendering routes; those are additions, never removals.
    for (const required of [
      'getPayinInfo',
      'getPayoutInfo',
      'sendnotification',
      'swapFunctionality',
      'transferBalance',
    ]) {
      expect(Object.keys(DENIED_ENDPOINTS)).toContain(required)
    }
  })

  it('explains every denial rather than just refusing', () => {
    for (const [name, reason] of Object.entries(DENIED_ENDPOINTS)) {
      expect(reason).toMatch(/Blocked/)
      expect(reason.length).toBeGreaterThan(30)
      expect(name).toBeTruthy()
    }
  })

  it('uses a known transport and method everywhere', () => {
    for (const [key, spec] of entries) {
      expect(['trading', 'portal', 'charting']).toContain(spec.transport)
      expect(['GET', 'POST']).toContain(spec.method)
      expect(spec.name).toBeTruthy()
      expect([1, 2, 3, 4]).toContain(spec.phase)
      expect(typeof spec.mutation).toBe('boolean')
      expect(key).toBeTruthy()
    }
  })

  it('keys each entry to exactly one transport+name pair', () => {
    // Two keys pointing at the same route would give it two phase settings,
    // and the looser one would silently win.
    const seen = entries.map(([, spec]) => `${spec.transport}:${spec.name}`)
    expect(new Set(seen).size).toBe(seen.length)
  })
})

describe('phase gating (guide §8)', () => {
  it('keeps every read reachable in phase 1 except margin preview', () => {
    // Phase 1 is the read-only integration, so reads must not be gated
    // higher. `forexmargin` is the documented exception: guide §8 lists
    // margin preview under phase 2.
    const gatedReads = entries.filter(([, spec]) => !spec.mutation && spec.phase > 1)
    expect(gatedReads.map(([key]) => key)).toEqual(['forexMargin'])
  })

  it('puts every order-placing mutation at phase 2 or higher', () => {
    // Guide §8: trading only happens in a controlled environment.
    for (const key of [
      'placeOrder',
      'modifyOrder',
      'modifyPendingOrder',
      'cancelStopLossTakeProfit',
      'closePosition',
      'bulkClosePositions',
      'bulkCancelPending',
    ] as const) {
      expect(ENDPOINTS[key].phase).toBeGreaterThanOrEqual(2)
      expect(ENDPOINTS[key].mutation).toBe(true)
    }
  })

  it('puts every money-moving endpoint at phase 3', () => {
    // Guide §8 phase 3 is funding; §2 says real-money funding stays disabled
    // until then. A phase-1 build cannot reach any of these.
    for (const key of [
      'requestPayment',
      'saveWithdrawDetails',
      'sendWithdrawOtp',
      'submitDemoDeposit',
    ] as const) {
      expect(ENDPOINTS[key].phase).toBe(3)
      expect(ENDPOINTS[key].mutation).toBe(true)
    }
  })

  it('treats the trading mutations that guide §4.5 flags as GET as mutations', () => {
    // The dangerous set: a GET that places an order. Marking them `mutation`
    // is what forces an idempotency key and blocks prefetch and replay.
    for (const key of ['placeOrder', 'closePosition', 'bulkClosePositions'] as const) {
      expect(ENDPOINTS[key].method).toBe('GET')
      expect(ENDPOINTS[key].mutation).toBe(true)
    }
  })
})

describe('mutation safety', () => {
  it('marks every state-changing endpoint as a mutation', () => {
    // Anything that writes must be a mutation, or it skips the idempotency
    // requirement entirely. Name-based so a new write endpoint is caught.
    // The trailing `[A-Z]|$` keeps it on camelCase boundaries, so reads like
    // `marketWatch` and `closedHistory` are not mistaken for writes.
    const writeish =
      /^(place|modify|cancel|close|bulk|submit|save|send|create|add|change|toggle|update|request|transfer|mark|register|mail|switch)([A-Z]|$)/
    for (const [key, spec] of entries) {
      if (writeish.test(key) && !spec.mutation) {
        throw new Error(`"${key}" looks like a write but is not marked as a mutation`)
      }
    }
  })

  it('does not mark the read-only auth handshake as a mutation', () => {
    // These three run before any idempotency key exists, so marking them
    // mutations would deadlock sign-in.
    for (const key of ['check', 'bearer', 'auth', 'setPortalSession'] as const) {
      expect(ENDPOINTS[key].mutation).toBe(false)
    }
  })

  it('records the parameter names every endpoint accepts', () => {
    // This API ignores parameters it does not recognise instead of rejecting
    // them, so a misspelling returns a cheerful success having done nothing.
    // The registry is what lets `Gate` catch that at the call site.
    for (const [key, spec] of entries) {
      expect(Array.isArray(spec.params)).toBe(true)
      expect(key).toBeTruthy()
    }
  })

  it('gives every POST an encoding and every GET none', () => {
    // The two transports disagree: trading reads form fields, the portal's
    // api* routes parse JSON. Guessing wrong yields an empty server-side body.
    for (const [key, spec] of entries) {
      if (spec.method === 'POST') {
        expect(['form', 'json', 'multipart']).toContain(spec.encoding)
      } else {
        expect(spec.encoding).toBeUndefined()
      }
      expect(key).toBeTruthy()
    }
  })

  it('sends the portal api* routes JSON and its legacy routes form fields', () => {
    expect(ENDPOINTS.markNotificationsRead.encoding).toBe('json')
    expect(ENDPOINTS.saveProfile.encoding).toBe('json')
    expect(ENDPOINTS.requestPayment.encoding).toBe('form')
    // Pre-api routes still read form fields.
    expect(ENDPOINTS.setPortalSession.encoding).toBe('form')
    expect(ENDPOINTS.switchAccountPortal.encoding).toBe('form')
  })

  it('keeps the auth footprint and the order fingerprint apart', () => {
    // Two different device identifiers, spelled differently by the API.
    // Sending one where the other belongs fails only at order time.
    expect(ENDPOINTS.check.params).toContain('footprint')
    expect(ENDPOINTS.bearer.params).toContain('footprint')

    for (const key of [
      'placeOrder',
      'closePosition',
      'modifyOrder',
      'modifyPendingOrder',
      'bulkClosePositions',
      'bulkCancelPending',
    ] as const) {
      expect(ENDPOINTS[key].params).toContain('fingerprint')
      expect(ENDPOINTS[key].params).not.toContain('footprint')
    }
  })

  it('keeps the unavailable REST chart-history route out of the client', () => {
    // History comes from /ws/ohlcV2. The docs explicitly mark
    // collect=watchlist_charting as not callable through api-v1.
    expect(ENDPOINTS.chartConfig.transport).toBe('trading')
    expect(ENDPOINTS).not.toHaveProperty('chartBars')
  })

  it('exempts only getuser from the Bearer header', () => {
    const open = entries.filter(([, spec]) => spec.unauthenticated).map(([key]) => key)
    expect(open).toEqual(['getUser'])
  })
})
