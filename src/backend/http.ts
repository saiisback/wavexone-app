import type { BodyEncoding } from './endpoints'
import { BackendError } from './errors'
import { logBackendEvent } from './redact'

/**
 * The one `fetch` in the application.
 *
 * Everything policy-shaped lives a layer up in `gate.ts`; this file only
 * handles transport: TLS, timeouts, and turning four different failure
 * shapes into one `BackendError`.
 */

export type HttpRequest = {
  url: string
  method: 'GET' | 'POST'
  headers?: Record<string, string>
  /**
   * Request body, already keyed by the API's own parameter names.
   *
   * The encoding is not a detail the caller gets to pick: the trading API
   * reads form fields, the portal's `api*` routes parse a JSON document, and
   * `apiSubmitDeposit` is multipart because it carries a proof image. Sending
   * JSON to a route that calls `$this->input->post()` yields an empty body
   * and a confusing 400, so `encoding` comes off the endpoint spec.
   */
  body?: Record<string, unknown>
  encoding?: BodyEncoding
  /** Endpoint key, for logging. Never a URL — URLs carry tokens. */
  endpoint: string
  timeoutMs: number
  /** Portal calls need the session cookie; trading calls do not. */
  withCredentials?: boolean
}

export type HttpResponse = {
  status: number
  /** Parsed JSON, or `undefined` when the body was not JSON. */
  json?: unknown
  /** Raw body. `collect=bearer` returns a bare token, not a document. */
  text: string
}

/**
 * Guide §6.9: "Use certificate-valid HTTPS only; never bypass TLS
 * verification." There is no way to weaken TLS from JS, so the check that
 * matters is refusing a plaintext base URL — which is how it would actually
 * go wrong, via a misconfigured staging host.
 */
export function assertHttps(url: string, what: string): void {
  if (!url.startsWith('https://')) {
    throw new BackendError('blocked', `${what} must be an https:// URL (guide §6.9).`)
  }
}

export async function send(request: HttpRequest): Promise<HttpResponse> {
  assertHttps(request.url, 'Request URL')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), request.timeoutMs)

  const encoded = encodeBody(request)

  let response: Response
  try {
    response = await fetch(request.url, {
      method: request.method,
      headers: {
        Accept: 'application/json, text/plain',
        ...encoded.headers,
        ...request.headers,
      },
      body: encoded.body,
      // Guide §3.2 step 3: the portal session is cookie-backed. On iOS and
      // Android the platform keeps the jar; on web the browser does, but only
      // if the request opts in.
      credentials: request.withCredentials ? 'include' : 'omit',
      signal: controller.signal,
    })
  } catch (cause) {
    clearTimeout(timer)
    const aborted = controller.signal.aborted
    logBackendEvent(aborted ? 'request.timeout' : 'request.network-error', {
      endpoint: request.endpoint,
    })
    throw new BackendError(
      aborted ? 'timeout' : 'network',
      aborted ? 'The request timed out.' : 'The request could not be sent.',
      { endpoint: request.endpoint, cause },
    )
  }
  clearTimeout(timer)

  const text = await response.text()
  logBackendEvent('request.complete', { endpoint: request.endpoint, status: response.status })

  if (response.status === 429) {
    throw new BackendError('throttled', 'Rate limited.', {
      endpoint: request.endpoint,
      status: response.status,
    })
  }

  if (response.status === 401 || response.status === 403) {
    throw new BackendError('auth', 'Not authenticated.', {
      endpoint: request.endpoint,
      status: response.status,
    })
  }

  if (response.status >= 500) {
    throw new BackendError('server', 'The service returned an error.', {
      endpoint: request.endpoint,
      status: response.status,
    })
  }

  if (response.status >= 400) {
    throw new BackendError('rejected', 'The request was declined.', {
      endpoint: request.endpoint,
      status: response.status,
      serverMessage: serverText(text),
    })
  }

  return { status: response.status, json: tryParseJson(text), text }
}

type EncodedBody = { body?: string | FormData; headers: Record<string, string> }

/**
 * Turns the caller's parameter map into whatever the route actually parses.
 *
 * `undefined` values are dropped rather than sent as the string "undefined",
 * which matters because most optional parameters here (`sl`, `target`,
 * `trigger`) are meaningful when absent and dangerous when garbage.
 */
function encodeBody(request: HttpRequest): EncodedBody {
  if (!request.body || request.method === 'GET') return { headers: {} }

  const entries = Object.entries(request.body).filter(([, value]) => value !== undefined)

  switch (request.encoding) {
    case 'json':
      return {
        body: JSON.stringify(Object.fromEntries(entries)),
        headers: { 'Content-Type': 'application/json' },
      }

    case 'multipart': {
      const form = new FormData()
      for (const [key, value] of entries) {
        form.append(key, value as string | Blob)
      }
      // No explicit Content-Type: the boundary has to come from the runtime,
      // and setting the header by hand omits it.
      return { body: form, headers: {} }
    }

    case 'form':
    default:
      return {
        body: entries
          .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`)
          .join('&'),
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      }
  }
}

function tryParseJson(text: string): unknown {
  const trimmed = text.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return undefined
  try {
    return JSON.parse(trimmed)
  } catch {
    return undefined
  }
}

/** Server text is for diagnostics only, so one short line is enough. */
/**
 * The readable part of an error body: a JSON envelope's `message` (as
 * `unwrapEnvelope` reads it), otherwise the first line of plain text — never
 * the raw `{"status":"fail",…}` document.
 */
function serverText(text: string): string | undefined {
  const parsed = tryParseJson(text)
  if (typeof parsed === 'object' && parsed !== null) {
    const message = (parsed as Record<string, unknown>).message
    return typeof message === 'string' && message.trim() ? message.trim().slice(0, 200) : undefined
  }
  return firstLine(text)
}

function firstLine(text: string): string | undefined {
  const line = text.trim().split('\n', 1)[0]
  return line ? line.slice(0, 200) : undefined
}

/**
 * Guide §5: an HTTP 200 from this API can still be a failure, signalled by
 * `status: success|fail|error` inside the envelope. Callers run every decoded
 * body through here before trusting it.
 */
export function unwrapEnvelope(response: HttpResponse, endpoint: string): unknown {
  const body = response.json
  if (body === undefined) {
    throw new BackendError('malformed', 'The service returned a non-JSON body.', {
      endpoint,
      status: response.status,
    })
  }

  if (typeof body !== 'object' || body === null) return body

  const envelope = body as Record<string, unknown>
  const status = typeof envelope.status === 'string' ? envelope.status.toLowerCase() : undefined
  if (status === 'fail' || status === 'error') {
    const message = typeof envelope.message === 'string' ? envelope.message : undefined
    throw new BackendError('rejected', 'The request was declined.', {
      endpoint,
      status: response.status,
      serverMessage: message,
    })
  }

  return 'data' in envelope ? envelope.data : envelope
}

/**
 * URL builder that keeps `?collect=` construction in one place.
 *
 * Deliberately does not log what it builds. This API puts the account token
 * in the query string, so a per-request URL log is the exact habit guide §3.3
 * rules out — `redactUrl` exists for the one place a URL must be shown to a
 * human, not as a licence to log them all.
 */
export function buildUrl(base: string, query: Record<string, string>): string {
  const params = Object.entries(query)
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join('&')
  return params ? `${base}?${params}` : base
}
