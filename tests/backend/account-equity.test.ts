import { reconcileAccountEquity } from '../../src/backend/account-equity'

describe('account equity reconciliation', () => {
  it('uses current open P&L instead of a stale portal snapshot', () => {
    const result = reconcileAccountEquity({
      balance: 10_000,
      portalEquity: 10_000,
      portalFreeMargin: 9_500,
      positions: [
        { state: 'Open', pnl: 42.5 },
        { state: 'Open', pnl: -2.25 },
        { state: 'Pending', pnl: 99 },
      ],
    })
    expect(result).toEqual({
      equity: 10_040.25,
      floatingPnl: 40.25,
      freeMargin: 9_540.25,
      changePercent: expect.closeTo(0.4025),
    })
  })

  it('returns balance as equity once the last open position is gone', () => {
    expect(reconcileAccountEquity({
      balance: 500,
      portalEquity: 507,
      portalFreeMargin: 490,
      positions: [],
    })).toEqual({
      equity: 500,
      floatingPnl: 0,
      freeMargin: 483,
      changePercent: 0,
    })
  })
})
