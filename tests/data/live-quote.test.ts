import { applyQuote, markPosition } from '../../src/data/live-quote'
import { instruments, positions } from '../../src/data/mock'

const GOLD = { ...instruments.find((item) => item.symbol === 'XAU/USD')!, dayOpen: 2000 }

describe('applyQuote', () => {
  it('moves bid, ask and price, and measures the change from the day open', () => {
    const live = applyQuote(GOLD, { bid: 2199, ask: 2201, price: 2200 })
    expect(live).toMatchObject({ bid: 2199, ask: 2201, price: 2200, changePercent: 10 })
  })

  it('returns the instrument unchanged before the first tick', () => {
    expect(applyQuote(GOLD, undefined)).toBe(GOLD)
  })
})

describe('markPosition', () => {
  const open = positions.find((item) => item.state === 'Open')!

  it('closes a buy at the bid and a sell at the ask', () => {
    const quote = { bid: open.entry + 1, ask: open.entry + 2, price: open.entry + 1.5 }
    const buy = markPosition({ ...open, side: 'Buy' }, GOLD, quote)
    const sell = markPosition({ ...open, side: 'Sell' }, GOLD, quote)
    expect(buy.current).toBe(quote.bid)
    expect(buy.pnl).toBeCloseTo(1 * open.lots * GOLD.contractSize)
    expect(sell.current).toBe(quote.ask)
    expect(sell.pnl).toBeCloseTo(-2 * open.lots * GOLD.contractSize)
  })

  it('leaves pending orders alone', () => {
    const pending = { ...open, state: 'Pending' as const }
    expect(markPosition(pending, GOLD, { bid: 1, ask: 2, price: 1.5 })).toBe(pending)
  })
})
