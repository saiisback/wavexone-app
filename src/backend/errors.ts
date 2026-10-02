/**
 * One typed error model for every failure the backend can produce.
 *
 * Guide §5 ("Normalized result rules"): the API answers failures in at least
 * four different shapes — a JSON envelope with `status: fail`, a real HTTP
 * error, a non-JSON body, and an HTTP 200 that is actually a failure. Screens
 * must never have to tell them apart, so everything funnels through here.
 */

export type BackendErrorKind =
  /** Network never completed: offline, DNS, TLS, timeout. */
  | 'network'
  /** Request timed out on our side. */
  | 'timeout'
  /** Credentials rejected, or the session is gone and cannot be restored. */
  | 'auth'
  /** The server said no in a way the user can act on (bad amount, closed market). */
  | 'rejected'
  /** Server answered, but not in a shape we can trust. */
  | 'malformed'
  /** The client module refused to make the call at all. */
  | 'blocked'
  /** Too many requests. */
  | 'throttled'
  /** Anything else, including 5xx. */
  | 'server'

export type BackendErrorOptions = {
  /**
   * The server's own wording. Kept for diagnostics only — guide §5 requires
   * user-visible copy to be mapped separately, because these strings leak
   * internals and are not written for end users.
   */
  serverMessage?: string
  /** HTTP status, when there was one. */
  status?: number
  /** Endpoint key from the registry, never a full URL (URLs carry tokens). */
  endpoint?: string
  cause?: unknown
}

export class BackendError extends Error {
  readonly kind: BackendErrorKind
  readonly serverMessage?: string
  readonly status?: number
  readonly endpoint?: string

  constructor(kind: BackendErrorKind, message: string, options: BackendErrorOptions = {}) {
    super(message, { cause: options.cause })
    this.name = 'BackendError'
    this.kind = kind
    this.serverMessage = options.serverMessage
    this.status = options.status
    this.endpoint = options.endpoint
  }

  /** True when retrying the exact same call could plausibly succeed. */
  get retryable(): boolean {
    return this.kind === 'network' || this.kind === 'timeout' || this.kind === 'server'
  }
}

/**
 * User-facing copy. Deliberately does not fall back to `serverMessage`:
 * that text is unreviewed, may name internal systems, and has been observed
 * to echo request parameters back.
 */
export function userMessageFor(error: BackendError): string {
  switch (error.kind) {
    case 'network':
      return 'No connection. Check your network and try again.'
    case 'timeout':
      return 'The request took too long. Try again.'
    case 'auth':
      return 'Your session has expired. Please sign in again.'
    case 'rejected':
      return error.serverMessage ?? 'That request was declined.'
    case 'malformed':
      return 'We got an unexpected response. Nothing was changed.'
    case 'blocked':
      return error.message
    case 'throttled':
      return 'Too many requests. Wait a moment and try again.'
    case 'server':
      return 'The service is having trouble. Try again shortly.'
  }
}

/**
 * Copy for a failed mutation, from whatever its promise rejected with.
 *
 * Deliberately never says "try again" for an unknown failure: a mutation that
 * died somewhere unexpected may still have reached the server.
 */
export function mutationFailureMessage(error: unknown): string {
  return error instanceof BackendError
    ? userMessageFor(error)
    : 'Something went wrong. Check your account before trying again.'
}

/**
 * `rejected` is the one kind whose server text reaches the user, because it
 * is the only kind where the server knows something we do not — which field
 * was wrong, which market is closed. Callers pass copy they have reviewed.
 */
export function rejection(userFacing: string, options: BackendErrorOptions = {}) {
  return new BackendError('rejected', userFacing, { ...options, serverMessage: userFacing })
}
