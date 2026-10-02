import { BackendError } from './errors'

/**
 * The WebSocket side of the API (reference: "WebSocket – chart feeds" and
 * "WebSocket – trading stream").
 *
 * `http.ts` remains the only `fetch`; these are the only sockets. Nothing here
 * sends an order or moves money — the feeds are read-only, so reconnecting on
 * a dropped connection is safe in a way that retrying a mutation never is.
 */

export const MARKET_FEED_URL = 'wss://cloud.wavexone.com/ws'
export const TRADING_STREAM_URL = 'wss://cloud.wavexone.com/server/'

/** Mid, bid and ask as the tick feed sends them. */
export type LiveQuote = { bid: number; ask: number; price: number }

type SocketFactory = (url: string) => WebSocket

const defaultSocket: SocketFactory = (url) => new WebSocket(url)

/** Reference: "Reconnect with exponential back-off (1 s → 30 s)". */
function backoff(attempt: number): number {
  return Math.min(30_000, 1_000 * 2 ** attempt)
}

const HEARTBEAT_MS = 25_000

// ---------------------------------------------------------------------------
// Live prices — /ws/ticks
// ---------------------------------------------------------------------------

export type QuoteFeed = {
  /** `listener` runs whenever the symbol's quote changes. */
  subscribe(symbol: string, listener: () => void): () => void
  latest(symbol: string): LiveQuote | undefined
}

/**
 * One socket shared by every price on screen. Rows subscribe by symbol; the
 * socket opens with the first subscriber and closes shortly after the last.
 */
export function createQuoteFeed(
  url = `${MARKET_FEED_URL}/ticks`,
  createSocket: SocketFactory = defaultSocket,
): QuoteFeed {
  const listeners = new Map<string, Set<() => void>>()
  const quotes = new Map<string, LiveQuote>()
  let socket: WebSocket | null = null
  let attempt = 0
  let syncTimer: ReturnType<typeof setTimeout> | undefined
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  function sendSubscription() {
    if (socket?.readyState !== 1 || listeners.size === 0) return
    socket.send(JSON.stringify({ action: 'subscribe', symbols: [...listeners.keys()] }))
  }

  function connect() {
    if (socket || reconnectTimer) return
    const current = createSocket(url)
    socket = current
    current.onopen = () => {
      attempt = 0
      sendSubscription()
      heartbeat = setInterval(() => {
        if (current.readyState === 1) current.send(JSON.stringify({ action: 'heartbeat' }))
      }, HEARTBEAT_MS)
    }
    current.onmessage = (event) => receive(event.data)
    current.onclose = () => {
      if (socket !== current) return
      socket = null
      clearInterval(heartbeat)
      if (listeners.size === 0) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined
        connect()
      }, backoff(attempt++))
    }
    current.onerror = () => {
      // `onclose` follows and schedules the reconnect.
    }
  }

  function disconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    clearInterval(heartbeat)
    const current = socket
    socket = null
    current?.close()
  }

  function receive(data: unknown) {
    let message: unknown
    try {
      message = JSON.parse(String(data))
    } catch {
      return
    }
    if (!message || typeof message !== 'object' || 'status' in message) return
    for (const [symbol, value] of Object.entries(message as Record<string, unknown>)) {
      const quote = readQuote(value)
      if (!quote) continue
      const previous = quotes.get(symbol)
      if (previous && previous.bid === quote.bid && previous.ask === quote.ask) continue
      quotes.set(symbol, quote)
      listeners.get(symbol)?.forEach((listener) => listener())
    }
  }

  /** Batches the subscribe message while a list mounts its rows. */
  function scheduleSync() {
    clearTimeout(syncTimer)
    syncTimer = setTimeout(() => {
      if (listeners.size === 0) disconnect()
      else if (socket) sendSubscription()
      else connect()
    }, listeners.size === 0 ? 5_000 : 50)
  }

  return {
    subscribe(symbol, listener) {
      let set = listeners.get(symbol)
      const added = !set
      if (!set) {
        set = new Set()
        listeners.set(symbol, set)
      }
      set.add(listener)
      if (added) scheduleSync()
      return () => {
        const current = listeners.get(symbol)
        if (!current) return
        current.delete(listener)
        if (current.size === 0) {
          listeners.delete(symbol)
          scheduleSync()
        }
      }
    },
    latest: (symbol) => quotes.get(symbol),
  }
}

function readQuote(value: unknown): LiveQuote | undefined {
  if (!value || typeof value !== 'object') return undefined
  const { b, a, p } = value as Record<string, unknown>
  if (typeof b !== 'number' || typeof a !== 'number' || !Number.isFinite(b) || !Number.isFinite(a)) {
    return undefined
  }
  return { bid: b, ask: a, price: typeof p === 'number' && Number.isFinite(p) ? p : (a + b) / 2 }
}

// ---------------------------------------------------------------------------
// Chart history — /ws/ohlcV2
// ---------------------------------------------------------------------------

export type Candle = { time: number; open: number; high: number; low: number; close: number }

/**
 * One request, one answer: opens a socket, asks for `limit` bars ending now,
 * and closes it. `timeframe` is the feed's own value — minutes (`15`, `60`,
 * `240`) or `1D` / `1W` / `1M`.
 */
export function fetchCandles(
  symbol: string,
  timeframe: string,
  limit: number,
  { url = `${MARKET_FEED_URL}/ohlcV2`, timeoutMs = 15_000, createSocket = defaultSocket } = {},
): Promise<Candle[]> {
  return new Promise((resolve, reject) => {
    const socket = createSocket(url)
    const uid = String(Date.now())
    let settled = false

    const finish = (outcome: () => void) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      socket.close()
      outcome()
    }
    const timer = setTimeout(
      () => finish(() => reject(new BackendError('timeout', 'The chart feed did not answer.', { endpoint: 'ohlcV2' }))),
      timeoutMs,
    )

    socket.onopen = () => {
      socket.send(JSON.stringify({ action: 'ohlc', uid, symbol, timeframe, limit, end: null }))
    }
    socket.onmessage = (event) => {
      let message: Record<string, unknown>
      try {
        message = JSON.parse(String(event.data)) as Record<string, unknown>
      } catch {
        return
      }
      if (message.action !== 'ohlc_response' || message.uid !== uid) return
      if (message.success !== true || !Array.isArray(message.data)) {
        finish(() => reject(new BackendError('rejected', 'Chart data is not available for this market.', {
          endpoint: 'ohlcV2',
          serverMessage: typeof message.error === 'string' ? message.error : undefined,
        })))
        return
      }
      const candles = message.data.flatMap(readCandle)
      finish(() => resolve(candles))
    }
    socket.onerror = () => {
      finish(() => reject(new BackendError('network', 'Could not reach the chart feed.', { endpoint: 'ohlcV2' })))
    }
    socket.onclose = () => {
      finish(() => reject(new BackendError('network', 'The chart feed closed the connection.', { endpoint: 'ohlcV2' })))
    }
  })
}

type BarsOptions = {
  timeframe?: string
  limit?: number
  url?: string
  timeoutMs?: number
  createSocket?: SocketFactory
}

/**
 * Bars for many symbols over one socket, oldest first. Resolves with whatever
 * answered before the timeout; a symbol the feed does not carry is absent.
 */
export function fetchBars(
  symbols: readonly string[],
  { timeframe = '60', limit = 24, url = `${MARKET_FEED_URL}/ohlcV2`, timeoutMs = 10_000, createSocket = defaultSocket }: BarsOptions = {},
): Promise<Map<string, Candle[]>> {
  const result = new Map<string, Candle[]>()
  const wanted = new Set(symbols)
  if (wanted.size === 0) return Promise.resolve(result)

  return new Promise((resolve) => {
    const socket = createSocket(url)
    let answered = 0
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      socket.close()
      resolve(result)
    }
    const timer = setTimeout(finish, timeoutMs)

    socket.onopen = () => {
      for (const symbol of wanted) {
        socket.send(JSON.stringify({ action: 'ohlc', uid: symbol, symbol, timeframe, limit, end: null }))
      }
    }
    socket.onmessage = (event) => {
      let message: Record<string, unknown>
      try {
        message = JSON.parse(String(event.data)) as Record<string, unknown>
      } catch {
        return
      }
      if (message.action !== 'ohlc_response' || typeof message.uid !== 'string' || !wanted.has(message.uid)) return
      answered += 1
      if (message.success === true && Array.isArray(message.data)) {
        const bars = message.data.flatMap(readCandle).sort((a, b) => a.time - b.time)
        if (bars.length > 0) result.set(message.uid, bars)
      }
      if (answered >= wanted.size) finish()
    }
    socket.onerror = finish
    socket.onclose = finish
  })
}

/** Recent closes per symbol — the row sparklines. */
export async function fetchSparklines(
  symbols: readonly string[],
  options: BarsOptions = {},
): Promise<Map<string, number[]>> {
  const bars = await fetchBars(symbols, { timeframe: '60', limit: 24, ...options })
  const result = new Map<string, number[]>()
  for (const [symbol, series] of bars) {
    if (series.length >= 2) result.set(symbol, series.map((bar) => bar.close))
  }
  return result
}

/** Today's bar per symbol: the day's open, high, low and latest close. */
export async function fetchDayBars(
  symbols: readonly string[],
  options: BarsOptions = {},
): Promise<Map<string, Candle>> {
  const bars = await fetchBars(symbols, { timeframe: '1D', limit: 1, ...options })
  const result = new Map<string, Candle>()
  for (const [symbol, series] of bars) {
    const today = series.at(-1)
    if (today) result.set(symbol, today)
  }
  return result
}

/**
 * Bid and ask for many symbols right now: subscribes, takes the snapshot the
 * feed sends first, and hangs up. Symbols the feed lacks are absent.
 */
export function fetchQuoteSnapshot(
  symbols: readonly string[],
  { url = `${MARKET_FEED_URL}/ticks`, timeoutMs = 6_000, createSocket = defaultSocket }: Omit<BarsOptions, 'timeframe' | 'limit'> = {},
): Promise<Map<string, LiveQuote>> {
  const result = new Map<string, LiveQuote>()
  if (symbols.length === 0) return Promise.resolve(result)

  return new Promise((resolve) => {
    const socket = createSocket(url)
    let settled = false
    const finish = () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      socket.onopen = socket.onmessage = socket.onerror = socket.onclose = null
      socket.close()
      resolve(result)
    }
    const timer = setTimeout(finish, timeoutMs)

    socket.onopen = () => {
      socket.send(JSON.stringify({ action: 'subscribe', symbols: [...new Set(symbols)] }))
    }
    socket.onmessage = (event) => {
      const message = parse(event.data)
      if (!message || 'status' in message) return
      for (const [symbol, value] of Object.entries(message)) {
        const quote = readQuote(value)
        if (quote) result.set(symbol, quote)
      }
      finish()
    }
    socket.onerror = finish
    socket.onclose = finish
  })
}

function readCandle(value: unknown): Candle[] {
  if (!value || typeof value !== 'object') return []
  const { t, o, h, l, c } = value as Record<string, unknown>
  const time = typeof t === 'string' ? Date.parse(t) : typeof t === 'number' ? t : NaN
  const numbers = [o, h, l, c]
  if (!Number.isFinite(time) || !numbers.every((n) => typeof n === 'number' && Number.isFinite(n))) {
    return []
  }
  return [{ time, open: o as number, high: h as number, low: l as number, close: c as number }]
}

// ---------------------------------------------------------------------------
// Order and account events — trading stream
// ---------------------------------------------------------------------------

/**
 * A signal to re-read, never data to apply (reference: "Treat them as
 * signals to reload state from the REST API").
 */
export type TradingEvent = {
  /** `orders` — order lists changed. `account` — balance/equity changed. */
  kind: 'orders' | 'account'
  /** Ready-to-show text from a `notification` message, when there is one. */
  message?: string
  rejected?: boolean
}

export type TradingEvents = {
  subscribe(listener: (event: TradingEvent) => void): () => void
  /** Re-authenticates with the current account token (after sign-in or a switch). */
  reset(): void
}

export function createTradingEvents(
  accountToken: () => string | null,
  url = TRADING_STREAM_URL,
  createSocket: SocketFactory = defaultSocket,
): TradingEvents {
  const listeners = new Set<(event: TradingEvent) => void>()
  const seen: string[] = []
  let socket: WebSocket | null = null
  let attempt = 0
  let reconnectTimer: ReturnType<typeof setTimeout> | undefined
  let heartbeat: ReturnType<typeof setInterval> | undefined

  const emit = (event: TradingEvent) => listeners.forEach((listener) => listener(event))

  function connect() {
    const token = accountToken()
    if (socket || reconnectTimer || !token || listeners.size === 0) return
    const current = createSocket(url)
    socket = current
    let reconnected = attempt > 0
    current.onopen = () => {
      // Every client message carries the token, or the server hangs up.
      current.send(JSON.stringify({ type: 'auth', token }))
      heartbeat = setInterval(() => {
        if (current.readyState === 1) current.send(JSON.stringify({ type: 'ping', token, ts: Date.now() }))
      }, HEARTBEAT_MS)
    }
    current.onmessage = (incoming) => {
      const message = parse(incoming.data)
      if (!message) return
      if (message.type === 'auth_success') {
        attempt = 0
        // Events sent while disconnected are not replayed.
        if (reconnected) emit({ kind: 'orders' })
        reconnected = false
        return
      }
      const eventId = typeof message.event_id === 'string' ? message.event_id : undefined
      if (eventId) {
        if (seen.includes(eventId)) return
        seen.push(eventId)
        if (seen.length > 100) seen.shift()
      }
      const signal = toTradingEvent(message)
      if (signal) emit(signal)
    }
    current.onclose = () => {
      if (socket !== current) return
      socket = null
      clearInterval(heartbeat)
      if (listeners.size === 0) return
      reconnectTimer = setTimeout(() => {
        reconnectTimer = undefined
        connect()
      }, backoff(attempt++))
    }
    current.onerror = () => {}
  }

  function disconnect() {
    clearTimeout(reconnectTimer)
    reconnectTimer = undefined
    clearInterval(heartbeat)
    const current = socket
    socket = null
    current?.close()
  }

  return {
    subscribe(listener) {
      listeners.add(listener)
      connect()
      return () => {
        listeners.delete(listener)
        if (listeners.size === 0) disconnect()
      }
    },
    reset() {
      disconnect()
      attempt = 0
      connect()
    },
  }
}

function parse(data: unknown): Record<string, unknown> | null {
  try {
    const value: unknown = JSON.parse(String(data))
    return value && typeof value === 'object' ? (value as Record<string, unknown>) : null
  } catch {
    return null
  }
}

function toTradingEvent(message: Record<string, unknown>): TradingEvent | null {
  switch (message.type) {
    case 'notification':
      return message.ordID === undefined
        ? { kind: 'account' }
        : {
            kind: 'orders',
            ...(typeof message.data === 'string' ? { message: message.data } : {}),
          }
    case 'ws_oms':
      return { kind: 'orders' }
    case 'equity':
      return { kind: 'account' }
    case 'operation_event': {
      const operation = typeof message.operation === 'string' ? message.operation : ''
      if (operation.startsWith('fund.order_') || operation.startsWith('order.')) {
        return { kind: 'orders', ...(operation === 'fund.order_rejected' ? { rejected: true } : {}) }
      }
      return { kind: 'account' }
    }
    default:
      return null
  }
}
