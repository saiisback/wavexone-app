/**
 * Client-side preview only. A missing/non-positive leverage value means the
 * broker has not supplied enough information for a safe local estimate.
 */
export function estimateRequiredMargin(
  price: number,
  contractSize: number,
  lots: number,
  leverage: number,
): number | null {
  if (![price, contractSize, lots, leverage].every(Number.isFinite) || leverage <= 0) return null
  const estimate = (price * contractSize * lots) / leverage
  return Number.isFinite(estimate) && estimate >= 0 ? estimate : null
}
