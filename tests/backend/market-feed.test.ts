import {
  createQuoteFeed,
  createTradingEvents,
  fetchCandles,
  fetchSparklines,
  type TradingEvent,
} from '../../src/backend/market-feed'
import { BackendError } from '../../src/backend/errors'
import { FakeSocket, createFakeSocket } from './fixtures/fake-socket'

beforeEach(() => {
  jest.useFakeTimers()
  FakeSocket.instances = []
})

afterEach(() => {
  jest.useRealTimers()
})

describe('quote feed', () => {
  it('opens one socket for every subscribed symbol and subscribes them together', () => {
    const feed = createQuoteFeed('wss://feed.test/ticks', createFakeSocket)
    feed.subscribe('XAUUSD', jest.fn())
    feed.subscribe('EURUSD', jest.fn())
    jest.advanceTimersByTime(60)

    expect(FakeSocket.instances).toHaveLength(1)
    const socket = FakeSocket.latest()
    socket.open()
    expect(socket.sent).toEqual([{ action: 'subscribe', symbols: ['XAUUSD', 'EURUSD'] }])
  })

  it('notifies only the listeners of a symbol whose quote changed', () => {
    const feed = createQuoteFeed('wss://feed.test/ticks', createFakeSocket)
    const gold = jest.fn()
    const euro = jest.fn()
    feed.subscribe('XAUUSD', gold)
    feed.subscribe('EURUSD', euro)
    jest.advanceTimersByTime(60)
    const socket = FakeSocket.latest()
    socket.open()

    socket.receive({ status: 'subscribed', symbols: ['XAUUSD', 'EURUSD'] })
    socket.receive({
      XAUUSD: { p: 2400.5, v: 1, b: 2400.4, a: 2400.6 },
      EURUSD: { p: 1.1, v: 1, b: 1.09, a: 1.11 },
    })
    socket.receive({
      XAUUSD: { p: 2401, v: 1, b: 2400.9, a: 2401.1 },
      EURUSD: { p: 1.1, v: 1, b: 1.09, a: 1.11 },
    })

    expect(gold).toHaveBeenCalledTimes(2)
    expect(euro).toHaveBeenCalledTimes(1)
    expect(feed.latest('XAUUSD')).toEqual({ bid: 2400.9, ask: 2401.1, price: 2401 })
  })

  it('accepts finite numeric strings from the PHP-backed feed', () => {
    const feed = createQuoteFeed('wss://feed.test/ticks', createFakeSocket)
    feed.subscribe('WAVE:C.XAUUSD', jest.fn())
    jest.advanceTimersByTime(60)
    const socket = FakeSocket.latest()
    socket.open()
    socket.receive({
      'WAVE:C.XAUUSD': { p: '2400.50', v: '1', b: '2400.40', a: '2400.60' },
    })
    expect(feed.latest('WAVE:C.XAUUSD')).toEqual({ bid: 2400.4, ask: 2400.6, price: 2400.5 })
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
  it('finishes a partial response burst without waiting for the hard timeout', async () => {
    const pending = fetchSparklines(['XAUUSD', 'MISSING'], {
      timeoutMs: 10_000,
      createSocket: createFakeSocket,
    })
    const socket = FakeSocket.latest()
    socket.open()
    socket.receive({
      action: 'ohlc_response',
      success: true,
      uid: 'XAUUSD',
      data: [
        { t: '2026-10-02T01:00:00.000Z', o: 1, h: 1, l: 1, c: 2401 },
        { t: '2026-10-02T02:00:00.000Z', o: 1, h: 1, l: 1, c: 2402 },
      ],
    })

    let settled = false
    void pending.then(() => { settled = true })
    await Promise.resolve()
    expect(settled).toBe(false)

    await jest.advanceTimersByTimeAsync(500)

    expect(settled).toBe(true)
    await expect(pending).resolves.toEqual(new Map([['XAUUSD', [2401, 2402]]]))
  })

  it('collects closes per symbol over one socket and skips symbols the feed lacks', async () => {
    const pending = fetchSparklines(['XAUUSD', 'US30'], { createSocket: createFakeSocket })
    const socket = FakeSocket.latest()
    socket.open()
    expect(socket.sent).toHaveLength(2)
    socket.receive({
      action: 'ohlc_response',
      success: true,
      uid: 'XAUUSD',
      data: [
        { t: '2026-10-02T02:00:00.000Z', o: 1, h: 1, l: 1, c: 2402 },
        { t: '2026-10-02T01:00:00.000Z', o: 1, h: 1, l: 1, c: 2401 },
      ],
    })
    socket.receive({ action: 'ohlc_response', success: false, uid: 'US30', error: 'not entitled' })

    const result = await pending
    expect(result.get('XAUUSD')).toEqual([2401, 2402])
    expect(result.has('US30')).toBe(false)
  })
})

describe('candle errors', () => {
  it('reports a market the feed does not carry as a rejection', async () => {
    const pending = fetchCandles('US30', '60', 10, { createSocket: createFakeSocket })
    const socket = FakeSocket.latest()
    socket.open()
    const { uid } = socket.sent[0] as { uid: string }
    socket.receive({ action: 'ohlc_response', success: false, uid, error: 'not entitled' })
    await expect(pending).rejects.toBeInstanceOf(BackendError)
  })
})
