import { z } from 'zod'

import { BackendError } from '../errors'
import type { Gate } from '../gate'
import { unwrapEnvelope } from '../http'
import { logBackendEvent } from '../redact'
import {
  parseChartHistory,
  parseCheckedSession,
  parseFavoriteIds,
  parseMarketCatalogue,
  parseOpenPositions,
  parseClosedHistory,
  parseOrderCounts,
  parseSymbolMetadata,
} from '../responses/trading'
import type { SessionMaterial } from '../secure-session-store'
import type { CloseOrderRequest, ModifyOrderRequest, PlaceOrderRequest } from '../contract'

/**
 * `/api-v1/v1.php?collect=…` — the trading API.
 *
 * Guide §3.1 documents this handshake step by step, so it is implemented
 * exactly as written. Live-tested response schemas are parsed strictly while
 * the known legacy field spellings stay confined to this adapter.
 */

/**
 * Field names vary between collections (`account_token`, `accountToken`,
 * `token`). Picking the first present one keeps that mess out of the caller.
 */
function pick(source: Record<string, unknown>, ...names: string[]): string | undefined {
  for (const name of names) {
    const value = source[name]
    if (typeof value === 'string' && value.length > 0) return value
    if (typeof value === 'number') return String(value)
  }
  return undefined
}

const objectish = z.record(z.string(), z.unknown())

export type SignInOutcome =
  | { kind: 'authenticated'; material: SessionMaterial }
  /** Guide §4.1 mentions a verification state; the UI must handle it. */
  | { kind: 'verification-required'; accountToken: string }

export class TradingApiAdapter {
  constructor(private readonly gate: Gate) {}

  /**
   * Guide §3.1 steps 1–4.
   *
   * `password` is a parameter and nothing more: it is never stored, never
   * logged, and never returned (guide §3.3).
   */
  async signIn(email: string, password: string, footprint: string): Promise<SignInOutcome> {
    const checked = await this.gate.call('check', {
      body: { email, password, footprint },
    })
    const body = objectish.safeParse(unwrapEnvelope(checked, 'check'))
    if (!body.success) {
      throw new BackendError('malformed', 'Sign-in returned an unreadable response.', {
        endpoint: 'check',
      })
    }

    const accountToken = pick(body.data, 'token', 'accountToken', 'account_token')
    const secretKey = pick(body.data, 'secretkey', 'secretKey', 'secret_key')
    if (!accountToken || !secretKey) {
      throw new BackendError('malformed', 'Sign-in did not return a usable session.', {
        endpoint: 'check',
      })
    }

    const verified = pick(body.data, 'verify', 'verified', 'isVerified', 'verification')
    if (verified === '0' || verified === 'false' || verified === 'pending') {
      return { kind: 'verification-required', accountToken }
    }

    let session: ReturnType<typeof parseCheckedSession>
    try {
      session = parseCheckedSession({
        status: 'success',
        token: accountToken,
        secret_key: secretKey,
        verify: '1',
        footprint: pick(body.data, 'footprint'),
        userID: pick(body.data, 'userID'),
        mode: pick(body.data, 'mode'),
        session_id: pick(body.data, 'session_id'),
      })
    } catch (cause) {
      throw new BackendError('malformed', 'Sign-in returned an unreadable session.', {
        endpoint: 'check',
        cause,
      })
    }

    const bearerToken = await this.issueBearer(
      session.accountToken,
      session.secretKey,
      session.footprint ?? footprint,
    )
    return {
      kind: 'authenticated',
      material: {
        accountToken: session.accountToken,
        secretKey: session.secretKey,
        bearerToken,
        // Guide §3.1 step 2 says the footprint comes back; trust the server's
        // value when it does, so both sides agree on the device identity.
        footprint: session.footprint ?? footprint,
        issuedAt: new Date().toISOString(),
      },
    }
  }

  /**
   * Guide §3.1 step 4: "Treat the entire successful response body as the
   * bearer token. The endpoint currently returns a raw token, not a JSON
   * document." So this is the one call that must not be parsed.
   */
  async issueBearer(accountToken: string, secretKey: string, footprint: string): Promise<string> {
    const response = await this.gate.call('bearer', {
      body: { token: accountToken, footprint },
      headers: { Secretkey: secretKey },
    })

    const token = response.text.trim()
    if (!token) {
      throw new BackendError('auth', 'The service issued an empty bearer token.', {
        endpoint: 'bearer',
      })
    }
    // A JSON body here means the contract changed underneath us. Better to
    // stop than to send `{"status":"ok"}` as an Authorization value.
    if (token.startsWith('{') || token.startsWith('[')) {
      throw new BackendError(
        'malformed',
        'The bearer endpoint returned JSON where a raw token was expected.',
        { endpoint: 'bearer' },
      )
    }
    return token
  }

  /** Guide §3.1 step 6. Cheap call used to decide whether a session survives. */
  async isSessionValid(material: SessionMaterial): Promise<boolean> {
    try {
      await this.gate.callJson('auth', {
        query: { token: material.accountToken },
        headers: this.headers(material),
      })
      return true
    } catch (error) {
      if (error instanceof BackendError && error.kind === 'auth') return false
      throw error
    }
  }

  /**
   * Guide §3.1 step 5. The API reference names `Authorization: Bearer <jwt>`
   * as the header and still accepts the legacy `Bearer: <jwt>`; both go out
   * so either server behaviour authenticates.
   */
  headers(material: SessionMaterial): Record<string, string> {
    return {
      Authorization: `Bearer ${material.bearerToken}`,
      Secretkey: material.secretKey,
      Bearer: material.bearerToken,
    }
  }

  /**
   * The account's market list and per-symbol precision and lot size.
   *
   * Prices are not read here. `getCurrentDayData` wants a `data` URL on the
   * charting host, and the one every collection uses (`charting.fxinvezt.com`)
   * no longer resolves, so it answers with an error page. The day's open and
   * the quotes come from the chart feeds instead (`market-feed.ts`).
   */
  async marketData(material: SessionMaterial) {
    const headers = this.headers(material)
    const catalogue = parseResponse(
      'watch',
      await this.gate.callJson('watch', { headers }),
      parseMarketCatalogue,
    )
    const metadata = parseResponse(
      'symbolSpread',
      await this.gate.callJson('symbolSpread', { headers }),
      parseSymbolMetadata,
    )
    return { catalogue, metadata }
  }

  async favoriteIds(material: SessionMaterial): Promise<string[]> {
    const response = await this.gate.call('favorites', {
      query: { token: material.accountToken, data: '[]' },
      headers: this.headers(material),
    })
    return parseResponse('favorites', response.json, parseFavoriteIds)
  }

  async setFavorite(
    material: SessionMaterial,
    request: { instrumentId: string; favorite: boolean; idempotencyKey: string },
  ): Promise<void> {
    const response = await this.gate.call('toggleFavorite', {
      query: {
        token: material.accountToken,
        data: JSON.stringify({
          symbol: request.instrumentId.toUpperCase(),
          watch: request.favorite ? '1' : '0',
          type: request.favorite ? 'add' : 'remove',
        }),
      },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    unwrapEnvelope(response, 'toggleFavorite')
  }

  async chart(material: SessionMaterial, instrumentId: string, resolution: string, count: number) {
    const toTs = Math.floor(Date.now() / 1000)
    const fromTs = toTs - count * 24 * 60 * 60
    const response = await this.gate.call('chartBars', {
      query: {
        symbol: instrumentId.toUpperCase(),
        fromTs: String(fromTs),
        toTs: String(toTs),
        count: String(count),
        previouscount: '0',
        resolution,
        firstDataRequest: 'true',
      },
      headers: this.headers(material),
    })
    return parseChartHistory(response.json)
  }

  async orderCounts(material: SessionMaterial) {
    const response = await this.gate.call('ordersCount', {
      query: { token: material.accountToken },
      headers: this.headers(material),
    })
    return parseOrderCounts(response.json)
  }

  async openOrders(material: SessionMaterial) {
    const response = await this.gate.call('orders', {
      query: { token: material.accountToken },
      headers: this.headers(material),
    })
    return parseOpenPositions(response.json)
  }

  async closedOrders(material: SessionMaterial) {
    const response = await this.gate.call('closedHistory', {
      query: { token: material.accountToken, page: '1', type: '', filter: '24hr', from: '', to: '' },
      headers: this.headers(material),
    })
    return parseClosedHistory(response.json)
  }

  async placeOrder(material: SessionMaterial, request: PlaceOrderRequest, fingerprint: string) {
    const response = await this.gate.call('placeOrder', {
      query: {
        token: material.accountToken,
        type: request.limitPrice ? 'limit' : 'market',
        bs: request.side.toLowerCase(),
        symbol: request.instrumentId.toUpperCase(),
        lot: request.lots,
        sl: request.stopLoss ?? '',
        target: request.takeProfit ?? '',
        trigger: request.limitPrice ?? '',
        // API reference §2.4: `clicked=yes`.
        clicked: 'yes',
        fingerprint,
      },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response.json, 'placeOrder')
  }

  async modifyOrder(material: SessionMaterial, request: ModifyOrderRequest, fingerprint: string) {
    const query = {
      token: material.accountToken,
      orderID: request.positionId,
      stoploss: request.stopLoss ?? '',
      target: request.takeProfit ?? '',
      fingerprint,
    }
    const endpoint = request.state === 'Pending' ? 'modifyPendingOrder' : 'modifyOrder'
    const response = await this.gate.call(endpoint, {
      query: request.state === 'Pending' ? { ...query, trigger: request.trigger } : query,
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response.json, endpoint)
  }

  async closeOrder(material: SessionMaterial, request: CloseOrderRequest, fingerprint: string) {
    const response = await this.gate.call('closePosition', {
      query: { token: material.accountToken, id: request.positionId, fingerprint },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response.json, 'closePosition')
  }

  async cancelOrder(material: SessionMaterial, request: CloseOrderRequest, fingerprint: string) {
    const response = await this.gate.call('bulkCancelPending', {
      query: { token: material.accountToken, bulkCloseId: request.positionId, fingerprint },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response.json, 'bulkCancelPending')
  }

  /**
   * The per-account `fingerprint` every order mutation carries.
   *
   * Separate from `material.footprint`, which is the pre-auth device value
   * sent to `check`/`bearer`. The two are shaped differently: a footprint is
   * a short client-chosen label, a fingerprint is `<32 hex chars>_<accountId>`.
   * Sending the wrong one would fail only at order time, so the two never
   * share a field. (Shapes only — the collection's literal values are live
   * credentials and are not reproduced here.)
   *
   * Marked a mutation in the registry, so it needs an idempotency key; the
   * account id is a natural one, since a second call for the same account is
   * the same intent.
   *
   * The *request* is transcribed from the collection. The *response* is not —
   * the collection captured no body for any of its 121 trading requests. So
   * this accepts either a bare value or a JSON envelope carrying one, and
   * refuses anything else rather than handing a plausible-looking wrong
   * string to `placeorder`.
   */
  async issueOrderFingerprint(material: SessionMaterial, accountId: string): Promise<string> {
    const response = await this.gate.call('createFingerprint', {
      query: { token: material.accountToken, account_id: accountId },
      headers: this.headers(material),
      idempotencyKey: `fingerprint:${accountId}`,
    })

    // Unwrap first: a `{status, data}` envelope hides the value one level
    // down, and a `status: fail` envelope would otherwise read as a body.
    const unwrapped = response.json === undefined ? undefined : unwrapEnvelope(response, 'createFingerprint')
    const body = objectish.safeParse(unwrapped)
    const fingerprint = body.success
      ? pick(body.data, 'fingerprint', 'footprint', 'result', 'value')
      : typeof unwrapped === 'string'
        ? unwrapped
        : response.text.trim()

    // Every sample in the collection ends `_<accountId>`; anything else means
    // we are reading the wrong field out of an envelope we have never seen.
    if (!fingerprint || !fingerprint.endsWith(`_${accountId}`)) {
      throw new BackendError(
        'malformed',
        'The service did not return a usable order fingerprint.',
        { endpoint: 'createFingerprint' },
      )
    }
    return fingerprint
  }
}

function parseResponse<T>(
  endpoint: string,
  input: unknown,
  parser: (value: unknown) => T,
): T {
  try {
    return parser(input)
  } catch (cause) {
    // Endpoint key only: which read broke, never what it contained.
    logBackendEvent('response.malformed', { endpoint })
    throw new BackendError('malformed', 'The service returned an unexpected response.', {
      endpoint,
      cause,
    })
  }
}

function assertAcknowledged(input: unknown, endpoint: string): void {
  if (
    typeof input !== 'object' ||
    input === null ||
    String((input as Record<string, unknown>).status).toLowerCase() !== 'success'
  ) {
    throw new BackendError('malformed', 'The service did not acknowledge the mutation.', {
      endpoint,
    })
  }
}
