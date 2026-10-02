import { fs, path, root } from '../../support/node'
/**
 * Real server traffic, recorded by `npm run capture:fixtures` (see
 * `tests/live/`). Unit tests replay these instead of hand-written payloads,
 * so a parser is always tested against what the API actually sends.
 *
 * Identity values are pseudonymised and only demo-account money is kept —
 * `tests/live/redaction.ts` has the rules.
 */

type Message = Record<string, unknown>
type SocketCapture = { url: string; sent: Message[]; received: Message[] }

function read<T>(relative: string): T {
  const file = path.join(root, 'tests', 'fixtures', 'captured', relative)
  if (!fs.existsSync(file)) {
    throw new Error(
      `No capture at tests/fixtures/captured/${relative}. Run \`npm run capture:fixtures\` ` +
        '(account captures need WAVEX_LIVE_EMAIL / WAVEX_LIVE_PASSWORD for a demo login in .env.local).',
    )
  }
  return JSON.parse(fs.readFileSync(file, 'utf8')) as T
}

/** Every socket a live test file opened, in order. */
export function feedCapture(suite: 'market-feed' | 'account'): SocketCapture[] {
  return read<{ sockets: SocketCapture[] }>(`feeds/${suite}.json`).sockets
}

export type OhlcRequest = { action: 'ohlc'; uid: string; symbol: string; timeframe: string; limit: number }
export type OhlcResponse = {
  action: 'ohlc_response'
  success: boolean
  uid: string
  data?: { t: string; o: number; h: number; l: number; c: number; v: number }[]
  error?: string
}

/** Every chart request the feed answered, paired with its answer. */
export function ohlcExchanges(suite: 'market-feed' | 'account' = 'market-feed') {
  return feedCapture(suite)
    .filter((socket) => socket.url.endsWith('/ohlcV2'))
    .flatMap((socket) =>
      (socket.sent as OhlcRequest[]).flatMap((request) => {
        const response = (socket.received as OhlcResponse[]).find((message) => message.uid === request.uid)
        return response ? [{ request, response }] : []
      }),
    )
}

/** The feed's answer to one chart request. */
export function ohlcResponse(
  match: { symbol: string; timeframe: string; limit?: number; success?: boolean },
  suite: 'market-feed' | 'account' = 'market-feed',
): OhlcResponse {
  const found = ohlcExchanges(suite).find(
    ({ request, response }) =>
      request.symbol === match.symbol &&
      request.timeframe === match.timeframe &&
      (match.limit === undefined || request.limit === match.limit) &&
      (match.success === undefined || response.success === match.success),
  )
  if (!found) throw new Error(`No captured ohlc response for ${JSON.stringify(match)}`)
  return found.response
}

/** The same bars as `fetchCandles` returns them. */
export function capturedCandles(match: { symbol: string; timeframe: string; limit?: number }) {
  return (ohlcResponse(match).data ?? []).map((bar) => ({
    time: Date.parse(bar.t),
    open: bar.o,
    high: bar.h,
    low: bar.l,
    close: bar.c,
  }))
}

/**
 * A ticks socket's traffic: the subscribe it sent, the ack, then price
 * frames. The longest recording wins when several sockets asked for the same
 * symbols (a snapshot hangs up after one frame; a stream keeps going).
 */
export function tickCapture(symbols: readonly string[], suite: 'market-feed' | 'account' = 'market-feed') {
  const socket = feedCapture(suite)
    .filter(
      (candidate) =>
        candidate.url.endsWith('/ticks') &&
        JSON.stringify((candidate.sent[0] as { symbols?: string[] })?.symbols) === JSON.stringify(symbols),
    )
    .sort((left, right) => right.received.length - left.received.length)[0]
  if (!socket) throw new Error(`No captured ticks socket subscribed to ${symbols.join(', ')}`)
  const acknowledgement = socket.received.find((message) => 'status' in message)!
  const frames = socket.received.filter((message) => !('status' in message)) as Record<
    string,
    { p: number; v: number; b: number; a: number }
  >[]
  return { subscribe: socket.sent[0], acknowledgement, frames }
}

type Endpoint = `${'trading' | 'portal'}/${string}`
/** `account` is the signed-in run; `gate` is the same API with no credentials. */
type HttpSuite = 'account' | 'gate'

/** A recorded HTTP response, as the server sent it (after redaction). */
export function httpCapture<T = unknown>(endpoint: Endpoint, suite: HttpSuite = 'account'): { status: number; body: T } {
  return read(`http/${suite}/${endpoint}.json`)
}

/** The body as text, the way `fetch` delivered it to the app. */
export function httpText(endpoint: Endpoint, suite: HttpSuite = 'account'): string {
  const { body } = httpCapture(endpoint, suite)
  return typeof body === 'string' ? body : JSON.stringify(body)
}
