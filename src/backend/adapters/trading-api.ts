import { z } from 'zod'

import { BackendError } from '../errors'
import type { Gate } from '../gate'
import { unwrapEnvelope, type HttpResponse } from '../http'
import { logBackendEvent } from '../redact'
import {
  parseAccountDetail,
  parseCheckedSession,
  parseFavoriteIds,
  parseMarketCatalogue,
  parseOpenPositions,
  parseClosedHistory,
  parseOrderCounts,
  parseSymbolMetadata,
} from '../responses/trading'
import type { SessionMaterial } from '../secure-session-store'
import type { CloseOrderRequest, FundingRequest, ModifyOrderRequest, PlaceOrderRequest } from '../contract'

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
// The official Postman history sample omits `data` for this empty outcome.
const noHistoryResultsSchema = z.object({
  status: z.literal('fail'),
  message: z.literal('No Results'),
}).strict()

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
        ...(session.sessionId === undefined ? {} : { sessionId: session.sessionId }),
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
    const [catalogueResponse, metadataResponse] = await Promise.all([
      this.gate.callJson('watch', { headers }),
      this.gate.callJson('symbolSpread', { headers }),
    ])
    const catalogue = parseResponse(
      'watch',
      catalogueResponse,
      parseMarketCatalogue,
    )
    const metadata = parseResponse(
      'symbolSpread',
      metadataResponse,
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

  async orderCounts(material: SessionMaterial) {
    const response = await this.gate.call('ordersCount', {
      query: { token: material.accountToken },
      headers: this.headers(material),
    })
    return parseOrderCounts(response.json)
  }

  async accountDetail(material: SessionMaterial) {
    const response = await this.gate.call('instrumentDetail', {
      query: { token: material.accountToken, data: '[]' },
      headers: this.headers(material),
    })
    return parseResponse('instrumentDetail', response.json, parseAccountDetail)
  }

  async openOrders(material: SessionMaterial) {
    const response = await this.gate.call('orders', {
      query: { token: material.accountToken },
      headers: this.headers(material),
    })
    return parseResponse('orders', response.json, parseOpenPositions)
  }

  async closedOrders(material: SessionMaterial, options: { page?: number; filter?: '24hr' } = {}) {
    const page = options.page ?? 1
    if (!Number.isSafeInteger(page) || page < 1) {
      throw new BackendError('blocked', 'History page must be a positive integer.', { endpoint: 'closedHistory' })
    }
    const response = await this.gate.call('closedHistory', {
      query: {
        token: material.accountToken,
        page: String(page),
        type: '',
        filter: options.filter ?? '24hr',
        from: '',
        to: '',
      },
      headers: this.headers(material),
    })
    return parseClosedHistory(noHistoryResultsSchema.safeParse(response.json).success
      ? { status: 'fail', message: 'No Results', data: [] }
      : response.json)
  }

  async placeOrder(material: SessionMaterial, request: PlaceOrderRequest, fingerprint: string) {
    const response = await this.gate.call('placeOrder', {
      query: {
        token: material.accountToken,
        type: request.limitPrice ? 'limit' : 'market',
        bs: request.side.toLowerCase(),
        // `placeorder` resolves the market from the catalogue namespace too
        // (`C:AUDCAD`, `S:AAPL`, …). Dropping it can make a valid account look
        // unauthenticated because the order service cannot resolve the route.
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
    assertAcknowledged(response, 'placeOrder')
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
    assertAcknowledged(response, endpoint)
  }

  async closeOrder(material: SessionMaterial, request: CloseOrderRequest, fingerprint: string) {
    const response = await this.gate.call('closePosition', {
      query: { token: material.accountToken, id: request.positionId, fingerprint },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response, 'closePosition')
  }

  async cancelOrder(material: SessionMaterial, request: CloseOrderRequest, fingerprint: string) {
    const response = await this.gate.call('bulkCancelPending', {
      query: { token: material.accountToken, bulkCloseId: request.positionId, fingerprint },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response, 'bulkCancelPending')
  }

  async submitDepositRequest(material: SessionMaterial, request: FundingRequest) {
    const response = await this.gate.call('requestPayment', {
      body: {
        name: 'deposit',
        data: JSON.stringify({ method: request.method, wamount: request.amount }),
        token: material.accountToken,
      },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response, 'requestPayment')
  }

  async submitWithdrawalRequest(material: SessionMaterial, request: FundingRequest) {
    const response = await this.gate.call('requestPayment', {
      body: {
        name: 'request',
        data: JSON.stringify({
          funds_withdraw_method: request.method,
          wamount: request.amount,
          otp: request.otp ?? '',
        }),
        token: material.accountToken,
      },
      headers: this.headers(material),
      idempotencyKey: request.idempotencyKey,
    })
    assertAcknowledged(response, 'requestPayment')
  }

  /**
   * The per-account `fingerprint` every order mutation carries.
   *
   * Separate from `material.footprint`, which is the pre-auth device value
   * sent to `check`/`bearer`. The two are shaped differently: a footprint is
   * a short client-chosen label, a fingerprint is `<32 hex chars>_<accountId>`.
   * Sending the wrong one would fail only at order time, so the two never
   * share a field. The order fingerprint is opaque; its format is not a
   * client-side validation rule.
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
      query: {
        token: material.accountToken,
        account_id: accountId,
        ...(material.sessionId === undefined ? {} : { sid: material.sessionId }),
      },
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

    // The service owns this value and the reference documents it as opaque.
    // Do not infer an account-id suffix from historical samples: production
    // returns a top-level fingerprint whose format is not client-defined.
    if (!fingerprint) {
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

function assertAcknowledged(response: HttpResponse, endpoint: string): void {
  // The trading API reports business rejections (closed market, invalid lot,
  // insufficient margin, disabled symbol, …) with HTTP 200 and
  // `status: "fail"`. Normalize that envelope before checking the success
  // acknowledgement so the order ticket can show the actionable reason.
  unwrapEnvelope(response, endpoint)
  const input = response.json
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
