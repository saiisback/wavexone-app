import {
  createQuoteFeed,
  createTradingEvents,
  fetchCandles,
  fetchSparklines,
  type TradingEvent,
} from '../../src/backend/market-feed'
import { FakeSocket, createFakeSocket } from './fixtures/fake-socket'
import { ohlcResponse, tickCapture } from '../fixtures/captured'

beforeEach(() => {
  jest.useFakeTimers()
  FakeSocket.instances = []
})

afterEach(() => {
  jest.useRealTimers()
})

describe('quote feed', () => {
  // Gold, the euro and bitcoin streaming together, as the live feed sent them.
  const live = tickCapture(['XAUUSD', 'EURUSD', 'BTCUSD'])

  it('opens one socket for every subscribed symbol and subscribes them together', () => {
    const feed = createQuoteFeed('wss://feed.test/ticks', createFakeSocket)
    feed.subscribe('XAUUSD', jest.fn())
    feed.subscribe('EURUSD', jest.fn())
    feed.subscribe('BTCUSD', jest.fn())
    jest.advanceTimersByTime(60)

    expect(FakeSocket.instances).toHaveLength(1)
    const socket = FakeSocket.latest()
    socket.open()
    // Exactly what the app sent the real feed.
    expect(socket.sent).toEqual([live.subscribe])
  })

  it('notifies only the listeners of a symbol whose quote changed', () => {
    const feed = createQuoteFeed('wss://feed.test/ticks', createFakeSocket)
    const calls: Record<string, number> = {}
    for (const symbol of ['XAUUSD', 'EURUSD', 'BTCUSD']) {
      calls[symbol] = 0
      feed.subscribe(symbol, () => (calls[symbol] += 1))
    }
    jest.advanceTimersByTime(60)
    const socket = FakeSocket.latest()
    socket.open()

    socket.receive(live.acknowledgement)
    live.frames.forEach((frame) => socket.receive(frame))

    // The feed resends unchanged quotes; only a moved bid or ask is news.
    const changes: Record<string, number> = {}
    for (const symbol of Object.keys(calls)) {
      const quotes = live.frames.map((frame) => frame[symbol]).filter(Boolean)
      changes[symbol] = quotes.filter(
        (quote, index) => index === 0 || quote.b !== quotes[index - 1].b || quote.a !== quotes[index - 1].a,
      ).length
      expect(calls[symbol]).toBe(changes[symbol])
    }
    // The capture has to show at least one resent quote for this to prove anything.
    expect(Object.values(changes).some((count) => count < live.frames.length)).toBe(true)

    const last = live.frames.at(-1)!.XAUUSD
    expect(feed.latest('XAUUSD')).toEqual({ bid: last.b, ask: last.a, price: last.p })
  })

  it('reconnects with back-off and re-subscribes after a drop', () => {
    const feed = createQuoteFeed('wss://feed.test/ticks', createFakeSocket)
    feed.subscribe('XAUUSD', jest.fn())
    jest.advanceTimersByTime(60)
    FakeSocket.latest().open()
    FakeSocket.latest().drop()

    jest.advanceTimersByTime(999)
    expect(FakeSocket.instances).toHaveLength(1)
    jest.advanceTimersByTime(1)
    expect(FakeSocket.instances).toHaveLength(2)
    FakeSocket.latest().open()
    expect(FakeSocket.latest().sent).toEqual([{ action: 'subscribe', symbols: ['XAUUSD'] }])
  })

  it('closes the socket once nothing is subscribed', () => {
    const feed = createQuoteFeed('wss://feed.test/ticks', createFakeSocket)
    const unsubscribe = feed.subscribe('XAUUSD', jest.fn())
    jest.advanceTimersByTime(60)
    const socket = FakeSocket.latest()
    socket.open()

    unsubscribe()
    jest.advanceTimersByTime(5_000)
    expect(socket.readyState).toBe(3)
  })
})

describe('trading events', () => {
  function connected(token = 'acct-1') {
    const events: TradingEvent[] = []
    const stream = createTradingEvents(() => token, 'wss://stream.test/server/', createFakeSocket)
    stream.subscribe((event) => events.push(event))
    const socket = FakeSocket.latest()
    socket.open()
    socket.receive({ type: 'auth_success' })
    return { events, socket, stream }
  }

  it('authenticates with the account token on every message it sends', () => {
    const { socket } = connected()
    jest.advanceTimersByTime(25_000)
    expect(socket.sent[0]).toEqual({ type: 'auth', token: 'acct-1' })
    expect(socket.sent[1]).toMatchObject({ type: 'ping', token: 'acct-1' })
  })

  it('turns order and balance messages into re-read signals', () => {
    const { events, socket } = connected()
    socket.receive({ type: 'ws_oms', order_id: '8955', event_id: 'a' })
    socket.receive({ type: 'notification', data: 'Order 8955: XAUUSD 0.1 lots opened at 2350.42', ordID: '8955' })
    socket.receive({ type: 'operation_event', operation: 'fund.order_rejected', event_id: 'b' })
    socket.receive({ type: 'equity', data: {} })
    socket.receive({ type: 'pong' })

    expect(events).toEqual([
      { kind: 'orders' },
      { kind: 'orders', message: 'Order 8955: XAUUSD 0.1 lots opened at 2350.42' },
      { kind: 'orders', rejected: true },
      { kind: 'account' },
    ])
  })

  it('ignores a repeated event id', () => {
    const { events, socket } = connected()
    socket.receive({ type: 'ws_oms', event_id: 'same' })
    socket.receive({ type: 'ws_oms', event_id: 'same' })
    expect(events).toHaveLength(1)
  })

  it('asks for a reload after reconnecting, since missed events are not replayed', () => {
    const { events, socket } = connected()
    socket.drop()
    jest.advanceTimersByTime(1_000)
    const next = FakeSocket.latest()
    expect(next).not.toBe(socket)
    next.open()
    next.receive({ type: 'auth_success' })
    expect(events).toEqual([{ kind: 'orders' }])
  })

  it('stays offline without a signed-in account', () => {
    const stream = createTradingEvents(() => null, 'wss://stream.test/server/', createFakeSocket)
    stream.subscribe(jest.fn())
    expect(FakeSocket.instances).toHaveLength(0)
  })
})

describe('sparklines', () => {
  it('collects closes per symbol over one socket and skips symbols the feed lacks', async () => {
    const pending = fetchSparklines(['XAUUSD', 'NOPEXX'], { createSocket: createFakeSocket })
    const socket = FakeSocket.latest()
    socket.open()
    expect(socket.sent).toHaveLength(2)

    const gold = ohlcResponse({ symbol: 'XAUUSD', timeframe: '60', limit: 24 })
    // Delivered newest first, to show the order is the app's job, not the feed's.
    socket.receive({ ...gold, data: [...gold.data!].reverse() })
    socket.receive({ ...ohlcResponse({ symbol: 'NOPEXX', timeframe: '1D' }), uid: 'NOPEXX' })

    const result = await pending
    expect(result.get('XAUUSD')).toEqual(gold.data!.map((bar) => bar.c))
    expect(result.has('NOPEXX')).toBe(false)
  })
})

describe('candle errors', () => {
  it('reports a market the feed does not carry as a rejection', async () => {
    const pending = fetchCandles('NOPEXX', '1D', 1, { createSocket: createFakeSocket })
    const socket = FakeSocket.latest()
    socket.open()
    const { uid } = socket.sent[0] as { uid: string }
    const refusal = ohlcResponse({ symbol: 'NOPEXX', timeframe: '1D' })
    socket.receive({ ...refusal, uid })
    await expect(pending).rejects.toMatchObject({ kind: 'rejected', serverMessage: refusal.error })
  })
})
