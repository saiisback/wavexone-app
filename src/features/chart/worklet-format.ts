/**
 * Formatters for the chart read-out, which runs on the UI thread while a
 * finger scrubs the plot.
 *
 * `Intl` is not available inside a worklet, so these rebuild the en-US
 * output of `src/data/format.ts` by hand. `tests/features/worklet-format`
 * holds them to the same strings.
 */

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** 2387.4 at precision 2 → "2,387.40" — matches `formatPrice`. */
export function formatPriceWorklet(value: number, precision: number): string {
  'worklet'
  const fixed = Math.abs(value).toFixed(precision)
  const dot = fixed.indexOf('.')
  const whole = dot === -1 ? fixed : fixed.slice(0, dot)
  const fraction = dot === -1 ? '' : fixed.slice(dot)
  let grouped = ''
  for (let index = 0; index < whole.length; index += 1) {
    if (index > 0 && (whole.length - index) % 3 === 0) grouped += ','
    grouped += whole[index]
  }
  // `Intl` keeps the sign on a value that rounds to zero ("-0.00"); so do we.
  return `${value < 0 ? '-' : ''}${grouped}${fraction}`
}

/** "+0.34%" / "-1.20%" — matches `formatPercent`. */
export function formatPercentWorklet(value: number): string {
  'worklet'
  return `${value < 0 ? '-' : '+'}${Math.abs(value).toFixed(2)}%`
}

/** "21 Dec, 14:05" intraday, "21 Dec 2022" otherwise; device time zone. */
export function formatStampWorklet(ms: number, withTime: boolean): string {
  'worklet'
  const date = new Date(ms)
  const day = `${date.getDate()} ${MONTHS[date.getMonth()]}`
  if (!withTime) return `${day} ${date.getFullYear()}`
  const hours = `${date.getHours()}`.padStart(2, '0')
  const minutes = `${date.getMinutes()}`.padStart(2, '0')
  return `${day}, ${hours}:${minutes}`
}
