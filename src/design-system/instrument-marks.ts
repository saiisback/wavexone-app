/** Presentation metadata only: never used to request prices or place orders. */
export type StockMarkKind =
  | 'apple' | 'tesla' | 'nvidia' | 'microsoft' | 'amazon' | 'meta' | 'google' | 'netflix'
  | 'airbnb' | 'airbus' | 'amd' | 'americanExpress' | 'bmw' | 'cisco' | 'cocaCola'
  | 'coinbase' | 'dropbox' | 'ebay' | 'ferrari' | 'ford' | 'goDaddy' | 'hermes'
  | 'intel' | 'lufthansa' | 'mastercard' | 'nike' | 'paypal' | 'pinterest' | 'porsche'
  | 'qualcomm' | 'shopify' | 'siemens' | 'snapchat' | 'starbucks' | 'tripadvisor'
  | 'uber' | 'visa' | 'volkswagen' | 'wix' | 'xiaomi' | 'zoom'

export type CryptoMarkKind = 'bitcoin' | 'ethereum' | 'litecoin' | 'cardano' | 'polkadot' | 'eos'

export type AssetIconKind =
  | StockMarkKind
  | CryptoMarkKind
  | 'gold' | 'silver' | 'copper' | 'platinum' | 'palladium' | 'oil' | 'gas'
  | 'forex' | 'index' | 'stock' | 'generic'

export type InstrumentArtworkCategory = 'Metals' | 'Forex' | 'Crypto' | 'Energy' | 'Indices' | 'Stocks'

const STOCK_MARKS: Readonly<Record<string, StockMarkKind>> = {
  AAPL: 'apple', TSLA: 'tesla', NVDA: 'nvidia', MSFT: 'microsoft', AMZN: 'amazon',
  META: 'meta', FB: 'meta', GOOGL: 'google', GOOG: 'google', NFLX: 'netflix',
  ABNB: 'airbnb', AIR: 'airbus', AIRF: 'airbus', AMD: 'amd', AXP: 'americanExpress',
  BMWG: 'bmw', CSCO: 'cisco', KO: 'cocaCola', COIN: 'coinbase', DBX: 'dropbox',
  EBAY: 'ebay', RACE: 'ferrari', F: 'ford', GDDY: 'goDaddy', HRMS: 'hermes',
  INTC: 'intel', LHAG: 'lufthansa', MA: 'mastercard', NKE: 'nike', PYPL: 'paypal',
  PINS: 'pinterest', P911: 'porsche', QCOM: 'qualcomm', SHOP: 'shopify', SIEGN: 'siemens',
  SNAP: 'snapchat', SBUX: 'starbucks', TRIP: 'tripadvisor', UBER: 'uber', V: 'visa',
  VOWG_P: 'volkswagen', WIX: 'wix', ZM: 'zoom',
}

const CRYPTO_MARKS: Readonly<Record<string, CryptoMarkKind>> = {
  BTC: 'bitcoin', ETH: 'ethereum', LTC: 'litecoin', ADA: 'cardano', DOT: 'polkadot', EOS: 'eos',
}

const CURRENCIES = new Set([
  'AUD', 'CAD', 'CHF', 'EUR', 'GBP', 'HKD', 'JPY', 'MXN', 'NOK', 'NZD', 'PLN', 'SEK', 'TRY', 'USD', 'ZAR',
])

/** Exchange decoration is removed for artwork only; server symbols stay intact. */
function markSymbol(ticker: string): string {
  return ticker
    .trim()
    .toUpperCase()
    .replace(/^.*:/, '')
    .split('.')[0]
    .replace(/[^A-Z0-9_]/g, '')
    .replace(/CASH$/, '')
}

function isCurrencyPair(symbol: string): boolean {
  return symbol.length === 6 && CURRENCIES.has(symbol.slice(0, 3)) && CURRENCIES.has(symbol.slice(3))
}

export function instrumentMark(ticker: string, category?: InstrumentArtworkCategory): AssetIconKind {
  const symbol = markSymbol(ticker)
  const stock = STOCK_MARKS[symbol]
  if (stock) return stock

  for (const [prefix, mark] of Object.entries(CRYPTO_MARKS)) {
    if (symbol.startsWith(prefix)) return mark
  }

  if (symbol.startsWith('XAU')) return 'gold'
  if (symbol.startsWith('XAG')) return 'silver'
  if (symbol.startsWith('XPT')) return 'platinum'
  if (symbol.startsWith('XPD')) return 'palladium'
  if (symbol.includes('COPPER')) return 'copper'
  if (symbol.includes('WTI') || symbol.includes('BRENT') || symbol.includes('OIL')) return 'oil'
  if (symbol.includes('NGAS')) return 'gas'
  if (category === 'Forex' || isCurrencyPair(symbol)) return 'forex'
  if (category === 'Indices') return 'index'
  if (category === 'Stocks' || /^(US|EU|HK|S):/i.test(ticker.trim())) return 'stock'
  return 'generic'
}

/** Full compact label used by pair/index/stock artwork. */
export function instrumentIconLabel(ticker: string): string {
  return markSymbol(ticker).slice(0, 6) || '?'
}

/** Two-character fallback for the smallest generic discs. */
export function instrumentMonogram(ticker: string): string {
  return markSymbol(ticker).slice(0, 2) || '?'
}
