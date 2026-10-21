import { buildChartSeries, niceAxis, withLivePrice } from '../../src/data/chart-series'

const HOUR = 60 * 60 * 1000
const start = Date.parse('2026-10-01T00:00:00Z')

function bars(count: number, stepMs: number, price = (index: number) => 100 + index) {
  return Array.from({ length: count }, (_, index) => ({
    time: start + index * stepMs,
    open: price(index) - 0.5,
    close: price(index),
  }))
}

describe('buildChartSeries', () => {
  it('keeps one real daily candle when the caller supports single-bar charts', () => {
    const series = buildChartSeries([
      { time: start, open: 100, high: 110, low: 90, close: 105 },
      { time: start + 24 * HOUR, open: 105, high: 112, low: 98, close: 102 },
    ], '1D', { allowSingleBar: true })!
    expect(series.points).toEqual([102])
    expect(series.opens).toEqual([105])
    expect(series.highs).toEqual([112])
    expect(series.lows).toEqual([98])
    expect(series.cursorIndex).toBe(0)
  })
  it('retains the actual candle wicks for the TradingView chart', () => {
    const series = buildChartSeries([
      { time: start, open: 100, high: 110, low: 90, close: 105 },
      { time: start + HOUR, open: 105, high: 112, low: 98, close: 102 },
    ], '1D')!
    expect(series.highs).toEqual([110, 112])
    expect(series.lows).toEqual([90, 98])
    const live = withLivePrice(series, 115)
    expect(live.highs).toEqual([110, 115])
    expect(live.lows).toEqual([90, 98])
  })
  it('keeps only the window ending at the newest bar and rests the cursor on it', () => {
    // 3 days of hourly bars; 1D keeps the last 24 hours.
    const series = buildChartSeries(bars(72, HOUR), '1D')!
    expect(series.points).toHaveLength(24)
    expect(series.cursorIndex).toBe(23)
    expect(series.cursorClose).toBe(171)
    expect(series.cursorOpen).toBe(170.5)
    expect(series.opens).toHaveLength(24)
    expect(series.labels).toHaveLength(5)
    expect(new Set(series.labels).size).toBe(5)
  })

  it('sorts bars that arrive out of order', () => {
    const series = buildChartSeries([...bars(3, HOUR)].reverse(), '5D')!
    expect(series.points).toEqual([100, 101, 102])
  })

  it('returns null when there is too little to draw', () => {
    expect(buildChartSeries([], '1M')).toBeNull()
    expect(buildChartSeries(bars(1, HOUR), '1M')).toBeNull()
  })

  it('puts every point inside the axis', () => {
    const series = buildChartSeries(bars(30, 24 * HOUR, (index) => 2380 + Math.sin(index) * 40), '3M')!
    for (const point of series.points) {
      expect(point).toBeGreaterThanOrEqual(series.min)
      expect(point).toBeLessThanOrEqual(series.max)
    }
  })
})

describe('niceAxis', () => {
  it('rounds gold-sized prices to whole steps', () => {
    expect(niceAxis(2012, 2588)).toEqual({ min: 2000, max: 2600, step: 200, axisDecimals: 0 })
  })

  it('gives FX prices enough decimals and no float noise', () => {
    const axis = niceAxis(1.12512, 1.12791)
    expect(axis.axisDecimals).toBe(3)
    expect(axis.min).toBe(1.125)
    expect(axis.max).toBe(1.128)
  })

  it('survives a flat series', () => {
    const axis = niceAxis(100, 100)
    expect(axis.max).toBeGreaterThan(axis.min)
  })
})

describe('withLivePrice', () => {
  const series = buildChartSeries(bars(24, HOUR), '1D')!

  it('moves the newest point and the read-out to the live price', () => {
    const live = withLivePrice(series, 123.4)
    expect(live.points.at(-1)).toBe(123.4)
    expect(live.cursorClose).toBe(123.4)
    expect(live.min).toBe(series.min)
  })

  it('widens the axis only when the price leaves it', () => {
    const live = withLivePrice(series, 500)
    expect(live.max).toBeGreaterThanOrEqual(500)
  })

  it('leaves the series alone without a quote', () => {
    expect(withLivePrice(series, undefined)).toBe(series)
  })
})
