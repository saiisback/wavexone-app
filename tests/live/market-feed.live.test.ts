import {
  createQuoteFeed,
  fetchBars,
  fetchCandles,
  fetchDayBars,
  fetchQuoteSnapshot,
  fetchSparklines,
  type Candle,
} from '../../src/backend/market-feed'
import { CHART_REQUESTS, buildChartSeries } from '../../src/data/chart-series'
import type { Timeframe } from '../../src/data/types'

/**
 * The public price and chart feeds, against the real servers. No sign-in.
 *
 * Gold, the euro and bitcoin cover the three price scales the app formats
 * (two places, four-plus places, five digits), and they trade on different
 * calendars, so between them something is always moving.
 */

const SYMBOLS = ['XAUUSD', 'EURUSD', 'BTCUSD']
/** Not a market anywhere; the feed must say so rather than hang. */
const UNKNOWN = 'NOPEXX'

function expectSaneCandle(candle: Candle) {
  expect(Number.isFinite(candle.time)).toBe(true)
  expect(candle.low).toBeLessThanOrEqual(Math.min(candle.open, candle.close))
  expect(candle.high).toBeGreaterThanOrEqual(Math.max(candle.open, candle.close))
  expect(candle.low).toBeGreaterThan(0)
}

describe('ticks', () => {
  it('answers a snapshot with a positive bid at or below the ask for every symbol', async () => {
    const quotes = await fetchQuoteSnapshot(SYMBOLS)
    expect([...quotes.keys()].sort()).toEqual([...SYMBOLS].sort())
    for (const quote of quotes.values()) {
      expect(quote.bid).toBeGreaterThan(0)
      expect(quote.bid).toBeLessThanOrEqual(quote.ask)
      expect(quote.price).toBeGreaterThanOrEqual(quote.bid)
      expect(quote.price).toBeLessThanOrEqual(quote.ask)
    }
  })

  it('leaves out a symbol the feed does not carry', async () => {
    const quotes = await fetchQuoteSnapshot(['XAUUSD', UNKNOWN])
    expect(quotes.has('XAUUSD')).toBe(true)
    expect(quotes.has(UNKNOWN)).toBe(false)
  })

  it('streams every subscribed symbol through one shared socket', async () => {
    const feed = createQuoteFeed()
    const seen: number[] = []
    const unsubscribers: (() => void)[] = []
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('No bitcoin ticks within 15 s')), 15_000)
      for (const symbol of SYMBOLS) {
        unsubscribers.push(feed.subscribe(symbol, () => {
          if (symbol !== 'BTCUSD') return
          seen.push(feed.latest(symbol)!.price)
          // Bitcoin trades every day, so it is the one to wait on.
          if (seen.length >= 10) {
            clearTimeout(timer)
            resolve()
          }
        }))
      }
    })
    unsubscribers.forEach((unsubscribe) => unsubscribe())
    expect(seen.every((price) => price > 0)).toBe(true)
    for (const symbol of SYMBOLS) expect(feed.latest(symbol)?.bid).toBeGreaterThan(0)
  })
})

describe('candles', () => {
  it.each(Object.keys(CHART_REQUESTS) as Timeframe[])(
    'draws a %s chart for gold from what the feed sends',
    async (timeframe) => {
      const request = CHART_REQUESTS[timeframe]
      const candles = await fetchCandles('XAUUSD', request.timeframe, request.limit)
      expect(candles.length).toBeGreaterThan(1)
      expect(candles.length).toBeLessThanOrEqual(request.limit)
      candles.forEach(expectSaneCandle)

      const series = buildChartSeries(candles, timeframe)
      expect(series).not.toBeNull()
      expect(series!.cursorClose).toBe(candles.at(-1)!.close)
      for (const point of series!.points) {
        expect(point).toBeGreaterThanOrEqual(series!.min)
        expect(point).toBeLessThanOrEqual(series!.max)
      }
    },
  )

  it('gives an FX chart an axis fine enough to tell its prices apart', async () => {
    const request = CHART_REQUESTS['1M']
    const candles = await fetchCandles('EURUSD', request.timeframe, request.limit)
    const series = buildChartSeries(candles, '1M')!
    expect(series.axisDecimals).toBeGreaterThanOrEqual(2)
    expect(series.max - series.min).toBeLessThan(1)
  })

  it('rejects a market the feed does not carry instead of drawing an empty chart', async () => {
    await expect(fetchCandles(UNKNOWN, '1D', 1)).rejects.toMatchObject({ kind: 'rejected' })
  })

  it('returns bars oldest first over one socket and skips the unknown symbol', async () => {
    const bars = await fetchBars([...SYMBOLS, UNKNOWN], { timeframe: '60', limit: 24 })
    expect([...bars.keys()].sort()).toEqual([...SYMBOLS].sort())
    for (const series of bars.values()) {
      series.forEach(expectSaneCandle)
      expect(series.map((bar) => bar.time)).toEqual([...series.map((bar) => bar.time)].sort((a, b) => a - b))
    }
  })

  it('gives each market a day bar and a sparkline', async () => {
    const [days, sparks] = await Promise.all([fetchDayBars(SYMBOLS), fetchSparklines(SYMBOLS)])
    for (const symbol of SYMBOLS) {
      expectSaneCandle(days.get(symbol)!)
      expect(sparks.get(symbol)!.length).toBeGreaterThanOrEqual(2)
    }
  })
})
