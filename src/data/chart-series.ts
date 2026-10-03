import type { ChartSeries, Timeframe } from './types'

/**
 * What each timeframe button asks the chart feed for. `days` trims the bars
 * to the window ending at the newest bar, so a weekend (no forex bars) still
 * shows the last full stretch instead of an empty chart.
 */
export const CHART_REQUESTS: Record<Timeframe, { timeframe: string; limit: number; days: number }> = {
  '1D': { timeframe: '15', limit: 120, days: 1 },
  '5D': { timeframe: '60', limit: 150, days: 5 },
  '1W': { timeframe: '60', limit: 200, days: 7 },
  '1M': { timeframe: '240', limit: 220, days: 30 },
  '3M': { timeframe: '1D', limit: 120, days: 91 },
  '6M': { timeframe: '1D', limit: 220, days: 182 },
}

const DAY_MS = 24 * 60 * 60 * 1000

const timeLabel = new Intl.DateTimeFormat('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
const weekdayLabel = new Intl.DateTimeFormat('en-US', { weekday: 'short' })
const dayLabel = new Intl.DateTimeFormat('en-US', { day: 'numeric', month: 'short' })
const monthLabel = new Intl.DateTimeFormat('en-US', { month: 'short' })

/** Column count and label per timeframe, so every column reads differently. */
const COLUMNS: Record<Timeframe, { count: number; label: Intl.DateTimeFormat }> = {
  '1D': { count: 5, label: timeLabel },
  '5D': { count: 5, label: weekdayLabel },
  '1W': { count: 5, label: weekdayLabel },
  '1M': { count: 4, label: dayLabel },
  '3M': { count: 3, label: monthLabel },
  '6M': { count: 6, label: monthLabel },
}

export type CandleLike = { time: number; open: number; close: number }

/** Shapes feed bars into the line chart: closes, column labels and a round axis. */
export function buildChartSeries(candles: readonly CandleLike[], timeframe: Timeframe): ChartSeries | null {
  const sorted = [...candles].sort((left, right) => left.time - right.time)
  const newest = sorted.at(-1)
  if (!newest) return null
  const cutoff = newest.time - CHART_REQUESTS[timeframe].days * DAY_MS
  const bars = sorted.filter((bar) => bar.time > cutoff)
  if (bars.length < 2) return null

  const points = bars.map((bar) => bar.close)
  const { count, label } = COLUMNS[timeframe]
  const labels = Array.from({ length: count }, (_, column) => {
    const index = Math.min(bars.length - 1, Math.floor(((column + 0.5) / count) * bars.length))
    return label.format(bars[index].time)
  })
  const last = bars.length - 1

  return {
    points,
    opens: bars.map((bar) => bar.open),
    times: bars.map((bar) => bar.time),
    labels,
    cursorIndex: last,
    cursorOpen: bars[last].open,
    cursorClose: bars[last].close,
    ...niceAxis(Math.min(...points), Math.max(...points)),
  }
}

/**
 * Moves the newest point to the live price, widening the axis only when the
 * price leaves it — so the chart follows the quote without jumping.
 */
export function withLivePrice(series: ChartSeries, price: number | undefined): ChartSeries {
  if (price === undefined || series.points.length === 0) return series
  const last = series.points.length - 1
  const points = [...series.points.slice(0, last), price]
  const axis = price < series.min || price > series.max
    ? niceAxis(Math.min(series.min, price), Math.max(series.max, price))
    : { min: series.min, max: series.max, step: series.step, axisDecimals: series.axisDecimals }
  return {
    ...series,
    points,
    ...(series.cursorIndex === last ? { cursorClose: price } : {}),
    ...axis,
  }
}

/** Round axis bounds with about five gridlines. */
export function niceAxis(low: number, high: number) {
  const span = high - low || Math.abs(high) * 0.001 || 1
  const raw = span / 5
  const magnitude = 10 ** Math.floor(Math.log10(raw))
  const normalized = raw / magnitude
  const factor = normalized <= 1 ? 1 : normalized <= 2 ? 2 : normalized <= 2.5 ? 2.5 : normalized <= 5 ? 5 : 10
  const step = factor * magnitude
  const axisDecimals = Math.max(0, -Math.floor(Math.log10(step)) + (factor === 2.5 ? 1 : 0))
  const round = (value: number) => Number(value.toFixed(axisDecimals))
  const min = round(Math.floor(low / step) * step)
  let max = round(Math.ceil(high / step) * step)
  if (max <= min) max = round(min + step)
  return { min, max, step, axisDecimals }
}
