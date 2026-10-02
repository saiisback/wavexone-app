import { DENIED_ENDPOINTS, ENDPOINTS, type EndpointKey, type Phase } from './endpoints'
import { BackendError } from './errors'
import { assertHttps, buildUrl, send, unwrapEnvelope, type HttpResponse } from './http'
import { logBackendEvent } from './redact'

/**
 * Policy in front of the transport.
 *
 * Every rule in guide §6 that the client is responsible for is enforced
 * here, once, instead of being remembered at each call site.
 */

export type BackendConfig = {
  /** Host serving `/api-v1/v1.php`. */
  tradingBaseUrl: string
  /** Client Portal host. */
  portalBaseUrl: string
  /** `charting_base_url` from the chart configuration (guide §4.4). */
  chartingBaseUrl: string
  /** Approved `Origin` for portal calls (guide §3.2 step 2). */
  portalOrigin: string
  /** Guide §8. Read-only until the backend team authorizes more. */
  phase: Phase
  timeoutMs: number
}

export const DEFAULT_TIMEOUT_MS = 20_000

/**
 * Catches a parameter name the API does not know.
 *
 * This API ignores what it does not recognise rather than rejecting it, so
 * `orderID` misspelled as `orderId` on `mobileapp_modifyorder` would return a
 * cheerful success having modified nothing. The registry records the real
 * names (guide §5, "legacy parameter names"), so checking against it turns a
 * silent no-op into an error at the call site.
 */
function assertKnownParams(key: EndpointKey, options: CallOptions): void {
  const allowed = ENDPOINTS[key].params
  if (!allowed) return

  const supplied = [...Object.keys(options.query ?? {}), ...Object.keys(options.body ?? {})]
  const unknown = supplied.filter((name) => !allowed.includes(name))
  if (unknown.length > 0) {
    throw new BackendError(
      'blocked',
      `"${key}" does not accept ${unknown.join(', ')}. It accepts: ${allowed.join(', ')}.`,
      { endpoint: key },
    )
  }
}

/**
 * How long a completed mutation is remembered. Long enough to swallow a
 * double tap and an impatient second attempt, short enough that a genuine
 * second order a minute later goes through.
 */
const MUTATION_MEMORY_MS = 30_000

type CallOptions = {
  query?: Record<string, string>
  body?: Record<string, unknown>
  headers?: Record<string, string>
  /**
   * Required for mutations. Identifies one user intent, so a repeat of the
   * same intent is recognised instead of executed twice.
   */
  idempotencyKey?: string
}

type Remembered = { at: number; promise: Promise<HttpResponse> }

export class Gate {
  private readonly inFlight = new Map<string, Remembered>()

  constructor(private readonly config: BackendConfig) {
    assertHttps(config.tradingBaseUrl, 'tradingBaseUrl')
    assertHttps(config.portalBaseUrl, 'portalBaseUrl')
    assertHttps(config.chartingBaseUrl, 'chartingBaseUrl')
  }

  /**
   * Guide §6.7 / §9. Exposed so an adapter cannot construct a denied route by
   * string concatenation and slip past the registry.
   */
  static assertAllowed(name: string): void {
    const reason = DENIED_ENDPOINTS[name]
    if (reason) throw new BackendError('blocked', reason, { endpoint: name })
  }

  /**
   * `getCurrentDayData` does not accept a symbol list directly. The supplied
   * collection sends a chart-service URL in its `data` multipart field.
   */
  currentDayDataSource(symbols: readonly string[]): string {
    const encodedSymbols = symbols.map((symbol) => encodeURIComponent(symbol)).join(',')
    return `${this.config.chartingBaseUrl}/consolidated/data?symbol=${encodedSymbols}`
  }

  async call(key: EndpointKey, options: CallOptions = {}): Promise<HttpResponse> {
    const spec = ENDPOINTS[key]
    Gate.assertAllowed(spec.name)

    if (spec.phase > this.config.phase) {
      throw new BackendError(
        'blocked',
        `"${key}" belongs to delivery phase ${spec.phase}; this build runs phase ${this.config.phase} (guide §8).`,
        { endpoint: key },
      )
    }

    if (spec.mutation) return this.callMutation(key, options)
    return this.perform(key, options)
  }

  private async callMutation(key: EndpointKey, options: CallOptions): Promise<HttpResponse> {
    if (!options.idempotencyKey) {
      throw new BackendError(
        'blocked',
        `"${key}" changes server state and needs an idempotency key so a repeat is not executed twice (guide §6.4).`,
        { endpoint: key },
      )
    }

    const memoryKey = `${key}:${options.idempotencyKey}`
    this.forgetExpired()

    const remembered = this.inFlight.get(memoryKey)
    if (remembered) {
      // Guide §9: "mutations pass staging tests without duplicate execution."
      // Returning the original promise means a double tap waits for the first
      // result rather than placing a second order.
      logBackendEvent('mutation.deduplicated', { endpoint: key })
      return remembered.promise
    }

    // The memo holds the *translated* outcome, not the raw one. Storing the
    // raw promise would hand a later caller a `network` error — which reads
    // as retryable, which is the one conclusion it must not reach.
    const promise = this.perform(key, options).catch((error: unknown) => {
      // A mutation that failed in transit is the dangerous case: the server
      // may or may not have acted. Guide §4.5 forbids replaying it, so the
      // memo is kept and the user is told to check before trying again.
      if (error instanceof BackendError && error.retryable) {
        throw new BackendError(
          'blocked',
          'We could not confirm whether that went through. Check your positions before trying again.',
          { endpoint: key, cause: error },
        )
      }
      // A clean rejection means the server definitely did not act, so the
      // user may legitimately correct their input and resubmit.
      this.inFlight.delete(memoryKey)
      throw error
    })

    this.inFlight.set(memoryKey, { at: Date.now(), promise })
    return promise
  }

  private perform(key: EndpointKey, options: CallOptions): Promise<HttpResponse> {
    const spec = ENDPOINTS[key]
    assertKnownParams(key, options)

    return send({
      url: this.urlFor(key, options.query ?? {}),
      method: spec.method,
      headers: {
        // Guide §3.2 step 2 — and since 2026-08-21 `setPortalSession` returns
        // 403 "Untrusted origin" without a matching Origin or Referer.
        ...(spec.transport === 'portal' ? { Origin: this.config.portalOrigin } : null),
        ...options.headers,
      },
      body: options.body,
      encoding: spec.encoding,
      endpoint: key,
      timeoutMs: this.config.timeoutMs,
      withCredentials: spec.transport === 'portal',
    })
  }

  private urlFor(key: EndpointKey, query: Record<string, string>): string {
    const spec = ENDPOINTS[key]
    switch (spec.transport) {
      case 'trading':
        // Everything on this host dispatches through one script.
        return buildUrl(`${this.config.tradingBaseUrl}/api-v1/v1.php`, {
          collect: spec.name,
          ...query,
        })
      case 'portal':
        // `portalBaseUrl` already ends in /client-portal.
        return buildUrl(`${this.config.portalBaseUrl}/${spec.name}`, query)
      case 'charting':
        // The charting host has a real path and still wants `collect` in the
        // query string: /charting_library2/history?…&collect=watchlist_charting
        return buildUrl(`${this.config.chartingBaseUrl}/charting_library2/history`, {
          ...query,
          collect: spec.name,
        })
    }
  }

  private forgetExpired() {
    const cutoff = Date.now() - MUTATION_MEMORY_MS
    for (const [key, entry] of this.inFlight) {
      if (entry.at < cutoff) this.inFlight.delete(key)
    }
  }

  /** Convenience: call, then validate the envelope (guide §5). */
  async callJson(key: EndpointKey, options: CallOptions = {}): Promise<unknown> {
    const response = await this.call(key, options)
    return unwrapEnvelope(response, key)
  }
}
