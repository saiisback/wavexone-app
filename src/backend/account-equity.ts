type ValuedPosition = {
  state: 'Open' | 'Pending' | 'Closed'
  pnl: number
}

/**
 * Reconciles the slower portal snapshot with the positions valued from the
 * live quote feed. Margin in use is retained from the portal; only the
 * floating-P&L delta moves free margin.
 */
export function reconcileAccountEquity({
  balance,
  portalEquity,
  portalFreeMargin,
  positions,
}: {
  balance: number
  portalEquity: number
  portalFreeMargin: number
  positions: readonly ValuedPosition[]
}) {
  const floatingPnl = positions.reduce(
    (total, position) => position.state === 'Open' ? total + position.pnl : total,
    0,
  )
  const portalFloatingPnl = portalEquity - balance
  return {
    equity: balance + floatingPnl,
    floatingPnl,
    freeMargin: portalFreeMargin + floatingPnl - portalFloatingPnl,
    changePercent: balance === 0 ? 0 : (floatingPnl / balance) * 100,
  }
}
