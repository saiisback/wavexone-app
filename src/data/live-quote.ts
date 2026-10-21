import type { Instrument, Position } from './types'

/** A streamed price, as `backend.prices` reports it. */
export type Quote = { bid: number; ask: number; price: number }

/** The instrument with its price fields moved to the live quote. */
export function applyQuote(instrument: Instrument, quote: Quote | undefined): Instrument {
  if (!quote) return instrument
  const open = instrument.dayOpen
  return {
    ...instrument,
    bid: quote.bid,
    ask: quote.ask,
    price: quote.price,
    changePercent: open ? ((quote.price - open) / open) * 100 : instrument.changePercent,
  }
}

/** Adds the day-open context once its slower sparkline request arrives. */
export function applySparkSnapshot(
  instrument: Instrument,
  closes: readonly number[] | undefined,
): Instrument {
  if (!closes || closes.length === 0) return instrument
  const open = closes[0]
  if (!Number.isFinite(open) || open === 0) return instrument
  return {
    ...instrument,
    dayOpen: open,
    changePercent: ((instrument.price - open) / open) * 100,
    spark: closes,
  }
}

/**
 * An open position marked to the live quote: a buy closes at the bid, a sell
 * at the ask. Pending and closed rows are left as the server reported them.
 */
export function markPosition(
  position: Position,
  instrument: Instrument | undefined,
  quote: Quote | undefined,
): Position {
  const contractSize = position.contractSize ?? instrument?.contractSize
  if (!quote || contractSize === undefined || position.state !== 'Open') return position
  const current = position.side === 'Buy' ? quote.bid : quote.ask
  const direction = position.side === 'Buy' ? 1 : -1
  return {
    ...position,
    current,
    pnl: (current - position.entry) * position.lots * contractSize * direction
      + (position.swap ?? 0)
      + (position.commission ?? 0),
  }
}
