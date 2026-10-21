import type { CandleInterval, ChartSeries, Timeframe } from '../../data/types'

export type TradingViewPayload = ReturnType<typeof tradingViewPayload>

/** Only prices/times cross the chart bridge. No session material is needed. */
export function tradingViewPayload(symbol: string, timeframe: Timeframe, precision: number, series: ChartSeries, interval?: CandleInterval) {
  const points = new Map<number, { time: number; value: number }>()
  const bars = new Map<number, { time: number; open: number; high: number; low: number; close: number }>()
  series.points.forEach((close, index) => {
    const stamp = series.times?.[index]
    if (stamp === undefined || !Number.isFinite(stamp) || !Number.isFinite(close)) return
    const time = Math.floor(stamp / 1000)
    points.set(time, { time, value: close })
    const open = series.opens?.[index]
    const high = series.highs?.[index]
    const low = series.lows?.[index]
    if (open === undefined || high === undefined || low === undefined) return
    if (![open, high, low].every(Number.isFinite) || high < Math.max(open, close) || low > Math.min(open, close)) return
    bars.set(time, { time, open, high, low, close })
  })
  return {
    key: `${symbol}:${timeframe}:${interval ?? 'Auto'}`,
    symbol,
    precision,
    intraday: interval ? interval !== '1D' : ['1D', '5D', '1W', '1M'].includes(timeframe),
    line: [...points.values()].sort((a, b) => a.time - b.time),
    candles: bars.size === points.size ? [...bars.values()].sort((a, b) => a.time - b.time) : [],
  }
}
