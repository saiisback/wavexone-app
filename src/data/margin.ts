import type { InstrumentCategory } from './types'

/** Terms transcribed from the supplied XN LP specification (10 Aug 2026). */
export type TradingSpecification = {
  marginRate: number
  leverage: number
  minimumLots: number
  lotStep: number
}

const MAJOR_INDICES = new Set(['GER30', 'US100', 'US30', 'US500'])
const CRYPTO_MARGIN: Readonly<Record<string, number>> = {
  // Liquidity Full lists 10%, but the dedicated leverage sheet caps both at
  // 1:5. Use the stricter requirement when the workbook disagrees.
  BTCUSD: 0.2,
  ETHUSD: 0.2,
  ADAUSD: 0.2,
  LTCUSD: 0.2,
  EOSUSD: 0.2,
  DOTUSD: 0.5,
}

function plainSymbol(symbol: string): string {
  return symbol.toUpperCase().replace(/^[^:]+:/, '').replace(/[^A-Z0-9]/g, '')
}

function specification(marginRate: number, minimumLots: number): TradingSpecification {
  return {
    marginRate,
    leverage: Math.round(1 / marginRate),
    minimumLots,
    lotStep: minimumLots,
  }
}

/**
 * Per-instrument margin and minimum volume from the LP workbook. The live
 * catalogue remains authoritative for prices and contract sizes.
 */
export function tradingSpecification(
  symbol: string,
  category: InstrumentCategory,
): TradingSpecification | null {
  const plain = plainSymbol(symbol)

  if (category === 'Forex') return specification(plain.includes('TRY') ? 0.05 : 0.01, 0.01)
  if (category === 'Indices') {
    const index = plain.replace(/CASH$/, '')
    return specification(MAJOR_INDICES.has(index) ? 0.01 : 0.04, 1)
  }
  if (category === 'Energy') {
    return specification(/WTI|BRENT|OIL/.test(plain) ? 0.02 : 0.04, 1)
  }
  if (category === 'Metals') {
    const minimumLots = /^(XAU|XAG|XPT|XPD)/.test(plain) ? 0.01 : 1
    return specification(plain.startsWith('XAU') ? 0.02 : 0.04, minimumLots)
  }
  if (category === 'Crypto') return specification(CRYPTO_MARGIN[plain] ?? 0.2, 0.01)
  if (category === 'Stocks') return specification(0.1, 1)
  return null
}

/** Raise a draft to the nearest volume the LP accepts. */
export function normalizeOrderLots(lots: number, terms: TradingSpecification | null): number {
  if (!terms) return roundLots(Math.max(0.01, lots))
  const steps = Math.max(0, Math.ceil((lots - terms.minimumLots) / terms.lotStep - 1e-9))
  return roundLots(terms.minimumLots + steps * terms.lotStep)
}

export function adjustOrderLots(
  lots: number,
  direction: 1 | -1,
  terms: TradingSpecification | null,
): number {
  const current = normalizeOrderLots(lots, terms)
  const step = terms?.lotStep ?? 0.01
  const minimum = terms?.minimumLots ?? 0.01
  return roundLots(Math.max(minimum, current + direction * step))
}

function roundLots(value: number): number {
  return Math.round(value * 100) / 100
}

/**
 * Client-side preview only. Instrument margin wins over an account-wide
 * leverage because the LP specification varies by asset and symbol.
 */
export function estimateRequiredMargin(
  price: number,
  contractSize: number,
  lots: number,
  leverage: number,
  marginRate?: number,
): number | null {
  if (![price, contractSize, lots].every(Number.isFinite)) return null
  const effectiveRate = Number.isFinite(marginRate) && (marginRate ?? 0) > 0
    ? marginRate!
    : Number.isFinite(leverage) && leverage > 0
      ? 1 / leverage
      : null
  if (effectiveRate === null) return null
  const estimate = price * contractSize * lots * effectiveRate
  return Number.isFinite(estimate) && estimate >= 0 ? estimate : null
}
