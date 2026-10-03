/** Presentation metadata only: never used to request prices or place orders. */
export type StockMarkKind = 'apple' | 'tesla' | 'nvidia' | 'microsoft' | 'amazon' | 'meta' | 'google' | 'netflix'
export type AssetIconKind = StockMarkKind | 'gold' | 'silver' | 'euro' | 'bitcoin' | 'ethereum' | 'oil' | 'generic'

const STOCK_MARKS: Readonly<Record<string, StockMarkKind>> = {
  AAPL: 'apple', TSLA: 'tesla', NVDA: 'nvidia', MSFT: 'microsoft',
  AMZN: 'amazon', META: 'meta', GOOGL: 'google', GOOG: 'google', NFLX: 'netflix',
}

/** Exchange decoration is removed for artwork only; server symbols stay intact. */
function markSymbol(ticker: string): string {
  return ticker.trim().toUpperCase().replace(/^.*:/, '').split('.')[0].replace(/[^A-Z0-9]/g, '')
}

export function instrumentMark(ticker: string): AssetIconKind {
  const symbol = markSymbol(ticker)
  const stock = STOCK_MARKS[symbol]
  if (stock) return stock
  if (symbol.startsWith('XAU')) return 'gold'
  if (symbol.startsWith('XAG')) return 'silver'
  if (symbol.startsWith('BTC')) return 'bitcoin'
  if (symbol.startsWith('ETH')) return 'ethereum'
  if (symbol.startsWith('EUR')) return 'euro'
  if (symbol.includes('WTI') || symbol.includes('OIL')) return 'oil'
  return 'generic'
}

export function instrumentMonogram(ticker: string): string {
  return markSymbol(ticker).slice(0, 2) || '?'
}
