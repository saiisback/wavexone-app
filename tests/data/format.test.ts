import {
  directionOf,
  formatLots,
  formatMoney,
  formatPercent,
  formatPrice,
  formatSignedMoney,
} from '../../src/data/format'

/**
 * These strings are what the mockups specify, and they appear on every row,
 * card and header in the app. They are also the layer where a sign or a
 * precision slip reads as a different number rather than as a broken screen,
 * so the edges matter more than the happy path.
 */

describe('formatMoney', () => {
  it('renders the portfolio figure from the mockups', () => {
    expect(formatMoney(24860.4)).toBe('$24,860.40')
  })

  it('groups thousands and always keeps two places', () => {
    expect(formatMoney(1000000)).toBe('$1,000,000.00')
    expect(formatMoney(5)).toBe('$5.00')
  })

  it('keeps the minus inside the currency form for a negative balance', () => {
    expect(formatMoney(-42.5)).toBe('-$42.50')
  })

  it('rounds to the nearest cent rather than truncating', () => {
    expect(formatMoney(1.005)).toBe('$1.01')
    expect(formatMoney(1.004)).toBe('$1.00')
  })
})

describe('formatSignedMoney', () => {
  it('prefixes a plus on profit and a minus on loss', () => {
    expect(formatSignedMoney(320)).toBe('+$320.00')
    expect(formatSignedMoney(-137.3)).toBe('-$137.30')
  })

  it('treats flat as positive, as the mockups do', () => {
    expect(formatSignedMoney(0)).toBe('+$0.00')
  })

  it('puts the sign outside the dollar symbol', () => {
    // "-$137.30", not "$-137.30" — the latter is what the default currency
    // formatter would produce and is not what the design shows.
    expect(formatSignedMoney(-137.3).startsWith('-$')).toBe(true)
  })

  it('renders a loss too small to show as a negative zero', () => {
    // Documented wart rather than an assertion that this is desirable: a
    // sub-cent loss reads as "-$0.00". Worth rounding before formatting if a
    // real feed ever produces these.
    expect(formatSignedMoney(-0.001)).toBe('-$0.00')
  })
})

describe('formatPrice', () => {
  it('uses two places for metals and four for FX', () => {
    expect(formatPrice(2043.5, 2)).toBe('2,043.50')
    expect(formatPrice(1.0873, 4)).toBe('1.0873')
  })

  it('pads a short FX price to four places', () => {
    expect(formatPrice(1.08, 4)).toBe('1.0800')
  })

  it('honors the precision supplied by symbolSpreadApp', () => {
    expect(formatPrice(123.4, 3)).toBe('123.400')
    expect(formatPrice(1.23456, 5)).toBe('1.23456')
  })

  it('carries no currency symbol — the row supplies its own context', () => {
    expect(formatPrice(2043.5, 2)).not.toContain('$')
  })
})

describe('formatPercent', () => {
  it('signs the value and fixes two places', () => {
    expect(formatPercent(0.34)).toBe('+0.34%')
    expect(formatPercent(-1.2)).toBe('-1.20%')
  })

  it('treats flat as positive, matching formatSignedMoney', () => {
    expect(formatPercent(0)).toBe('+0.00%')
  })
})

describe('formatLots', () => {
  it('says "lot" only at exactly one', () => {
    expect(formatLots(1)).toBe('1.00 lot')
    expect(formatLots(0.5)).toBe('0.50 lots')
    expect(formatLots(2)).toBe('2.00 lots')
  })

  it('keeps two places on the smallest tradeable size', () => {
    expect(formatLots(0.01)).toBe('0.01 lots')
  })
})

describe('directionOf', () => {
  it('reads a negative as down and everything else as up', () => {
    // Drives the red/green treatment, so flat must resolve to one of them.
    expect(directionOf(-0.01)).toBe('down')
    expect(directionOf(0)).toBe('up')
    expect(directionOf(1)).toBe('up')
  })
})
