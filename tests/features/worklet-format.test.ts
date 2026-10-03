import { formatPercent, formatPrice } from '../../src/data/format'
import {
  formatPercentWorklet,
  formatPriceWorklet,
  formatStampWorklet,
} from '../../src/features/chart/worklet-format'

/**
 * The chart read-out formats on the UI thread, where `Intl` is unavailable,
 * so it carries its own formatters. Scrubbing must print exactly what the
 * static price would, or the number visibly jumps when the finger lifts.
 */

describe('formatPriceWorklet matches formatPrice', () => {
  it.each([
    [2387.42, 2],
    [2387.4, 2],
    [68241.8, 2],
    [1.08421, 4],
    [1.0842, 5],
    [156.4, 3],
    [0.5, 2],
    [999.999, 2],
    [1234567.891, 2],
    [42315.6, 1],
    [12, 0],
    [-1234.5, 2],
    [-0.001, 2],
  ])('%d at %d places', (value, precision) => {
    expect(formatPriceWorklet(value, precision)).toBe(formatPrice(value, precision))
  })
})

describe('formatPercentWorklet matches formatPercent', () => {
  it.each([0.34, -1.2, 0, 12.345, -0.004])('%d', (value) => {
    expect(formatPercentWorklet(value)).toBe(formatPercent(value))
  })
})

describe('formatStampWorklet', () => {
  // Built from local parts so the expectation holds in any time zone.
  const stamp = new Date(2022, 11, 21, 9, 5).getTime()

  it('reads hours and minutes for intraday bars', () => {
    expect(formatStampWorklet(stamp, true)).toBe('21 Dec, 09:05')
  })

  it('reads the year for daily bars', () => {
    expect(formatStampWorklet(stamp, false)).toBe('21 Dec 2022')
  })
})
