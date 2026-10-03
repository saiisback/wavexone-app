/**
 * Formatters are created once at module scope — `Intl` constructors parse
 * locale data on every instantiation, which is far too expensive to repeat
 * inside a list row.
 */

const money2 = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const decimal2 = new Intl.NumberFormat('en-US', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const priceFormatters = new Map<number, Intl.NumberFormat>([[2, decimal2]])

/** "$24,860.40" */
export function formatMoney(value: number) {
  return money2.format(value)
}

/** "+$320.00" / "-$137.30" — the signed P&L form used on cards and rows. */
export function formatSignedMoney(value: number) {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${money2.format(Math.abs(value))}`
}

/** Price precision follows the instrument: 2 digits for metals, 4 for FX. */
export function formatPrice(value: number, precision: number) {
  let formatter = priceFormatters.get(precision)
  if (!formatter) {
    formatter = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: precision,
      maximumFractionDigits: precision,
    })
    priceFormatters.set(precision, formatter)
  }
  return formatter.format(value)
}

/** "+0.34%" / "-1.20%" */
export function formatPercent(value: number) {
  const sign = value < 0 ? '-' : '+'
  return `${sign}${Math.abs(value).toFixed(2)}%`
}

/** "0.50 lots" — singular below one lot boundary, as in the mockups. */
export function formatLots(value: number) {
  return `${decimal2.format(value)} ${value === 1 ? 'lot' : 'lots'}`
}

export function directionOf(value: number): 'up' | 'down' {
  return value < 0 ? 'down' : 'up'
}

/** As `directionOf`, but an amount that rounds to zero cents is `flat`. */
export function trendOf(value: number): 'up' | 'down' | 'flat' {
  return Math.abs(value) < 0.005 ? 'flat' : directionOf(value)
}
