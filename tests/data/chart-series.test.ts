import { CHART_REQUESTS, buildChartSeries, niceAxis, withLivePrice } from '../../src/data/chart-series'
import type { Timeframe } from '../../src/data/types'
import { capturedCandles } from '../fixtures/captured'

/** The bars the feed sent for one chart button, exactly as the app requests them. */
function candlesFor(symbol: string, timeframe: Timeframe) {
  const request = CHART_REQUESTS[timeframe]
  return capturedCandles({ symbol, timeframe: request.timeframe, limit: request.limit })
}

const DAY_MS = 24 * 60 * 60 * 1000

describe('buildChartSeries', () => {
  it.each(Object.keys(CHART_REQUESTS) as Timeframe[])(
    'keeps only the %s window ending at the newest gold bar and rests the cursor on it',
    (timeframe) => {
      const candles = candlesFor('XAUUSD', timeframe)
      const newest = candles.at(-1)!
      const kept = candles.filter((bar) => bar.time > newest.time - CHART_REQUESTS[timeframe].days * DAY_MS)

      const series = buildChartSeries(candles, timeframe)!
      expect(series.points).toEqual(kept.map((bar) => bar.close))
      expect(series.opens).toEqual(kept.map((bar) => bar.open))
      expect(series.cursorIndex).toBe(kept.length - 1)
      expect(series.cursorClose).toBe(newest.close)
      expect(series.cursorOpen).toBe(newest.open)
      expect(new Set(series.labels).size).toBe(series.labels.length)
    },
  )

  it('sorts bars that arrive out of order', () => {
    const candles = candlesFor('XAUUSD', '5D')
    const shuffled = [...candles].reverse()
    expect(buildChartSeries(shuffled, '5D')).toEqual(buildChartSeries(candles, '5D'))
  })

  it('returns null when there is too little to draw', () => {
    expect(buildChartSeries([], '1M')).toBeNull()
    expect(buildChartSeries(candlesFor('XAUUSD', '1M').slice(-1), '1M')).toBeNull()
  })

  it('puts every point inside the axis', () => {
    for (const [symbol, timeframe] of [['XAUUSD', '3M'], ['EURUSD', '1M']] as const) {
      const series = buildChartSeries(candlesFor(symbol, timeframe), timeframe)!
      for (const point of series.points) {
        expect(point).toBeGreaterThanOrEqual(series.min)
        expect(point).toBeLessThanOrEqual(series.max)
      }
    }
  })
})

describe('niceAxis', () => {
  const closes = (symbol: string, timeframe: Timeframe) => candlesFor(symbol, timeframe).map((bar) => bar.close)

  it('rounds gold-sized prices to whole steps', () => {
    const gold = closes('XAUUSD', '6M')
    const axis = niceAxis(Math.min(...gold), Math.max(...gold))
    expect(axis.axisDecimals).toBe(0)
    expect(Number.isInteger(axis.step)).toBe(true)
    expect(axis.min % axis.step).toBe(0)
  })

  it('gives FX prices enough decimals and no float noise', () => {
    const euro = closes('EURUSD', '1M')
    const axis = niceAxis(Math.min(...euro), Math.max(...euro))
    expect(axis.axisDecimals).toBeGreaterThanOrEqual(2)
    expect(axis.min).toBe(Number(axis.min.toFixed(axis.axisDecimals)))
    expect(axis.max).toBe(Number(axis.max.toFixed(axis.axisDecimals)))
    expect(axis.min).toBeLessThanOrEqual(Math.min(...euro))
    expect(axis.max).toBeGreaterThanOrEqual(Math.max(...euro))
  })

  it('survives a flat series', () => {
    const price = closes('XAUUSD', '1D').at(-1)!
    const axis = niceAxis(price, price)
    expect(axis.max).toBeGreaterThan(axis.min)
  })
})

describe('withLivePrice', () => {
  const candles = candlesFor('XAUUSD', '1D')
  const series = buildChartSeries(candles, '1D')!

  it('moves the newest point and the read-out to the live price', () => {
    // A price inside the drawn range: the median close of the day.
    const inside = [...series.points].sort((a, b) => a - b)[Math.floor(series.points.length / 2)]
    const live = withLivePrice(series, inside)
    expect(live.points.at(-1)).toBe(inside)
    expect(live.cursorClose).toBe(inside)
    expect(live.min).toBe(series.min)
    expect(live.max).toBe(series.max)
  })

  it('widens the axis only when the price leaves it', () => {
    // The 6-month high is far above a single day's range.
    const high = Math.max(...candlesFor('XAUUSD', '6M').map((bar) => bar.high))
    const live = withLivePrice(series, high)
    expect(high).toBeGreaterThan(series.max)
    expect(live.max).toBeGreaterThanOrEqual(high)
  })

  it('leaves the series alone without a quote', () => {
    expect(withLivePrice(series, undefined)).toBe(series)
  })
})
