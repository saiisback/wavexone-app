import { tradingViewPayload } from '../../src/features/chart/tradingview-data'
import { buildChartSeries } from '../../src/data/chart-series'

it('sends real OHLC values with epoch seconds to TradingView', () => {
  const series = buildChartSeries([
    { time: 1790812800000, open: 100, high: 110, low: 90, close: 105 },
    { time: 1790816400000, open: 105, high: 112, low: 98, close: 102 },
  ], '1D')!
  expect(tradingViewPayload('c:xauusd', '1D', 2, series).candles).toEqual([
    { time: 1790812800, open: 100, high: 110, low: 90, close: 105 },
    { time: 1790816400, open: 105, high: 112, low: 98, close: 102 },
  ])
})

it('does not fabricate candle wicks or dates when the source only contains a line', () => {
  const payload = tradingViewPayload('gold', '1D', 2, {
    points: [100, 105], labels: [], min: 100, max: 105, step: 1,
    cursorIndex: 1, cursorOpen: 100, cursorClose: 105,
  })
  expect(payload.candles).toEqual([])
  expect(payload.line).toEqual([])
})

it('uses the candle interval for intraday axes and resets zoom when that interval changes', () => {
  const series = buildChartSeries([
    { time: 1790812800000, open: 100, high: 110, low: 90, close: 105 },
    { time: 1790816400000, open: 105, high: 112, low: 98, close: 102 },
  ], '1M')!
  const daily = tradingViewPayload('gold', '1M', 2, series, '1D')
  const minute = tradingViewPayload('gold', '1M', 2, series, '15m')
  expect(daily.intraday).toBe(false)
  expect(minute.intraday).toBe(true)
  expect(daily.key).not.toEqual(minute.key)
})
