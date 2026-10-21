import type { BrandMarkKind, CoinMarkKind, FlagCode } from './artwork.generated'

/** Presentation metadata only: never used to request prices or place orders. */

/** Stocks with a hand-drawn multi-colour mark in `asset-icon.tsx`. */
export type DrawnStockKind =
  | 'microsoft' | 'amazon'

export type StockMarkKind = DrawnStockKind | BrandMarkKind

export type CryptoMarkKind = 'bitcoin' | 'ethereum' | 'eos' | CoinMarkKind

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
  EBAY: 'ebay', RACE: 'ferrari', F: 'ford', GDDY: 'goDaddy',
  INTC: 'intel', LHAG: 'lufthansa', MA: 'mastercard', NKE: 'nike', PYPL: 'paypal',
  PINS: 'pinterest', P911: 'porsche', QCOM: 'qualcomm', SHOP: 'shopify', SIEGN: 'siemens',
  SNAP: 'snapchat', SBUX: 'starbucks', TRIP: 'tripadvisor', UBER: 'uber', V: 'visa',
  VOWG_P: 'volkswagen', WIX: 'wix', ZM: 'zoom',
  ACN: 'accenture', ADS: 'adidas', ADYEN: 'adyen', ARM: 'arm', AVGO: 'broadcom',
  BA: 'boeing', BABA: 'alibaba', BAC: 'bankOfAmerica', BIDU: 'baidu', BKNG: 'booking',
  DAL: 'delta', DBK: 'deutscheBank', DDOG: 'datadog', DELL: 'dell', DTE: 'deutscheTelekom',
  ETSY: 'etsy', EXPE: 'expedia', FDX: 'fedex', FTNT: 'fortinet', GM: 'generalMotors',
  GS: 'goldmanSachs', HMC: 'honda', HOOD: 'robinhood', HPQ: 'hp', HSBA: 'hsbc', HSBC: 'hsbc',
  INTU: 'intuit', LYFT: 'lyft', MCD: 'mcdonalds', MDB: 'mongodb', NET: 'cloudflare',
  OKTA: 'okta', PANW: 'paloAltoNetworks', PLTR: 'palantir', RBLX: 'roblox', RDDT: 'reddit',
  ROKU: 'roku', RR: 'rollsRoyce', SAP: 'sap', SHEL: 'shell', SNOW: 'snowflake', SONY: 'sony',
  SPOT: 'spotify', SQ: 'block', T: 'att', TGT: 'target', TM: 'toyota', U: 'unity', UPS: 'ups',
  VOD: 'vodafone', VZ: 'verizon', XYZ: 'block',
}

const CRYPTO_MARKS: Readonly<Record<string, CryptoMarkKind>> = {
  BTC: 'bitcoin', ETH: 'ethereum', EOS: 'eos',
  ADA: 'cardano', ALGO: 'algorand', BCH: 'bitcoinCash', BNB: 'bnb', DASH: 'dash',
  DOGE: 'dogecoin', DOT: 'polkadot', HBAR: 'hedera', LINK: 'chainlink', LTC: 'litecoin',
  MATIC: 'polygon', POL: 'polygon', SOL: 'solana', SUI: 'sui', XLM: 'stellar',
  XMR: 'monero', XRP: 'xrp', ZEC: 'zcash',
}

/** Legs a coin ticker may be quoted in; "SOLUSD" → SOL, never "SOLVAY" → SOL. */
const CRYPTO_QUOTES = ['USD', 'USDT', 'USDC', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH']

/** ISO 4217 → the flag shown on a currency-pair badge. */
const CURRENCY_FLAGS: Readonly<Record<string, FlagCode>> = {
  AED: 'ae', AUD: 'au', BRL: 'br', CAD: 'ca', CHF: 'ch', CLP: 'cl', CNH: 'cn', CNY: 'cn',
  COP: 'co', CZK: 'cz', DKK: 'dk', EUR: 'eu', GBP: 'gb', HKD: 'hk', HUF: 'hu', IDR: 'id',
  ILS: 'il', INR: 'in', JPY: 'jp', KRW: 'kr', MXN: 'mx', MYR: 'my', NOK: 'no', NZD: 'nz',
  PHP: 'ph', PLN: 'pl', RUB: 'ru', SAR: 'sa', SEK: 'se', SGD: 'sg', THB: 'th', TRY: 'tr',
  TWD: 'tw', USD: 'us', ZAR: 'za',
}

/** Index tickers, minus trailing digits ("GER40" → "GER"), → home market. */
const INDEX_FLAGS: Readonly<Record<string, FlagCode>> = {
  US: 'us', USA: 'us', NAS: 'us', NDX: 'us', USTEC: 'us', SPX: 'us', SP: 'us', DJ: 'us',
  DJI: 'us', DOW: 'us', WS: 'us', RUSSELL: 'us', VIX: 'us',
  GER: 'de', DE: 'de', DAX: 'de', UK: 'gb', FTSE: 'gb', JP: 'jp', JPN: 'jp', NIKKEI: 'jp',
  FRA: 'fr', FR: 'fr', CAC: 'fr', AUS: 'au', AU: 'au', ASX: 'au', HK: 'hk', HSI: 'hk',
  EU: 'eu', ESTX: 'eu', STOXX: 'eu', EUSTX: 'eu', ESP: 'es', ES: 'es', SPA: 'es', IBEX: 'es',
  IT: 'it', ITA: 'it', CN: 'cn', CHINA: 'cn', CHINAA: 'cn', SWI: 'ch', CH: 'ch', SMI: 'ch',
  NETH: 'nl', NL: 'nl', AEX: 'nl', SG: 'sg', IN: 'in', NIFTY: 'in',
}

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

/** "EURUSD" → ['eu', 'us']; `null` unless both legs are known currencies. */
export function currencyPairFlags(ticker: string): [FlagCode, FlagCode] | null {
  const symbol = markSymbol(ticker)
  if (symbol.length !== 6) return null
  const base = CURRENCY_FLAGS[symbol.slice(0, 3)]
  const quote = CURRENCY_FLAGS[symbol.slice(3)]
  return base && quote ? [base, quote] : null
}

/** "US100" → 'us', "GER40" → 'de'; `null` for anything unrecognised. */
export function indexFlag(ticker: string): FlagCode | null {
  return INDEX_FLAGS[markSymbol(ticker).replace(/_?\d+[A-Z]?$/, '')] ?? null
}

/**
 * "SOLUSD" is a coin in any category (servers label whole feeds "stocks"),
 * but a bare "SOL", "LTC" or "SUI" is also a listed stock ticker, so it only
 * counts as a coin when the category allows it.
 */
function cryptoMark(symbol: string, category?: InstrumentArtworkCategory): CryptoMarkKind | null {
  const bareAllowed = category === undefined || category === 'Crypto'
  for (const [coin, mark] of Object.entries(CRYPTO_MARKS)) {
    if (!symbol.startsWith(coin)) continue
    const quote = symbol.slice(coin.length)
    if (quote === '' ? bareAllowed : CRYPTO_QUOTES.includes(quote)) return mark
  }
  return null
}

export function instrumentMark(ticker: string, category?: InstrumentArtworkCategory): AssetIconKind {
  const symbol = markSymbol(ticker)
  const stock = STOCK_MARKS[symbol]
  if (stock) return stock

  const coin = cryptoMark(symbol, category)
  if (coin) return coin

  if (symbol.startsWith('XAU')) return 'gold'
  if (symbol.startsWith('XAG')) return 'silver'
  if (symbol.startsWith('XPT')) return 'platinum'
  if (symbol.startsWith('XPD')) return 'palladium'
  if (symbol.includes('COPPER')) return 'copper'
  if (symbol.includes('WTI') || symbol.includes('BRENT') || symbol.includes('OIL')) return 'oil'
  if (symbol.includes('NGAS')) return 'gas'
  if (category === 'Forex' || currencyPairFlags(symbol)) return 'forex'
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
