/**
 * Maps a ticker to remote artwork for its badge.
 *
 * Nothing here is bundled: the catalogue comes from the server and can list
 * any symbol, so the logo is looked up by convention instead. Every source is
 * an ordered list — the badge walks it on load errors and falls back to the
 * drawn mark in `asset-icon.tsx` when all of them miss, so an unknown ticker
 * costs a 404, never a broken image.
 */

export type LogoSource = {
  uri: string
  /**
   * `cover` artwork is already a full-bleed tile or disc and is clipped to
   * the circle; `contain` artwork is a bare mark that needs a white plate.
   */
  fit: 'cover' | 'contain'
}

export type AssetLogo =
  | { type: 'single'; sources: readonly LogoSource[] }
  /** Two overlapping discs: the base currency in front, the quote behind. */
  | { type: 'pair'; base: readonly LogoSource[]; quote: readonly LogoSource[]; baseCode: string; quoteCode: string }

/** ISO 4217 code → ISO 3166 flag code on flagcdn. */
const CURRENCY_FLAGS: Readonly<Record<string, string>> = {
  USD: 'us', EUR: 'eu', GBP: 'gb', JPY: 'jp', CHF: 'ch', AUD: 'au', NZD: 'nz',
  CAD: 'ca', CNH: 'cn', CNY: 'cn', HKD: 'hk', SGD: 'sg', SEK: 'se', NOK: 'no',
  DKK: 'dk', ZAR: 'za', MXN: 'mx', TRY: 'tr', INR: 'in', PLN: 'pl', HUF: 'hu',
  CZK: 'cz', THB: 'th', RUB: 'ru', BRL: 'br', KRW: 'kr', ILS: 'il', AED: 'ae',
  SAR: 'sa', IDR: 'id', MYR: 'my', PHP: 'ph', TWD: 'tw', CLP: 'cl', COP: 'co',
}

/** Index tickers without a country prefix. */
const INDEX_FLAGS_EXACT: Readonly<Record<string, string>> = {
  NDX: 'us', SPX: 'us', DJI: 'us', USTEC: 'us', DOW: 'us', RUSSELL: 'us', VIX: 'us',
  DAX: 'de', FTSE: 'gb', HSI: 'hk', NIKKEI: 'jp', CAC: 'fr', STOXX: 'eu', NIFTY: 'in',
}

/** Leading letters of `US30`, `GER40`, `JP225`… → flag. */
const INDEX_FLAGS_PREFIX: Readonly<Record<string, string>> = {
  US: 'us', USA: 'us', NAS: 'us', SPX: 'us', SP: 'us', DJ: 'us', WS: 'us',
  GER: 'de', DE: 'de', DAX: 'de', UK: 'gb', FTSE: 'gb', JP: 'jp', JPN: 'jp', NI: 'jp',
  FRA: 'fr', FR: 'fr', CAC: 'fr', AUS: 'au', AU: 'au', ASX: 'au', HK: 'hk',
  EU: 'eu', ESTX: 'eu', STOXX: 'eu', EUSTX: 'eu', ESP: 'es', ES: 'es', SPA: 'es',
  IT: 'it', ITA: 'it', CN: 'cn', CHINA: 'cn', CHINAA: 'cn', SWI: 'ch', CH: 'ch',
  NETH: 'nl', NL: 'nl', SG: 'sg', IN: 'in', NIFTY: 'in',
}

/** Quote legs stripped from a crypto ticker to find the coin. */
const CRYPTO_QUOTES = ['USDT', 'USDC', 'USD', 'EUR', 'GBP', 'JPY', 'BTC', 'ETH']

/** Coins recognised without a category, for call sites that have none. */
const KNOWN_COINS = new Set([
  'BTC', 'ETH', 'SOL', 'XRP', 'ADA', 'DOGE', 'DOT', 'LTC', 'BCH', 'BNB', 'LINK',
  'AVAX', 'MATIC', 'TRX', 'XLM', 'UNI', 'ATOM', 'ETC', 'SHIB', 'XMR', 'EOS',
])

/** Spot metals and energy keep their drawn marks; there is no company to show. */
const COMMODITY = /^(XAU|XAG|XPT|XPD|XCU|USOIL|UKOIL|WTI|BRENT|XTI|XBR|NGAS|XNG|NATGAS|OIL)/

export function flagUri(country: string): string {
  return `https://flagcdn.com/w80/${country}.png`
}

function flagSources(country: string): LogoSource[] {
  return [{ uri: flagUri(country), fit: 'cover' }]
}

function coinSources(coin: string): LogoSource[] {
  const lower = coin.toLowerCase()
  return [
    { uri: `https://cdn.jsdelivr.net/gh/spothq/cryptocurrency-icons@master/128/color/${lower}.png`, fit: 'cover' },
    { uri: `https://assets.coincap.io/assets/icons/${lower}@2x.png`, fit: 'cover' },
  ]
}

function stockSources(ticker: string): LogoSource[] {
  return [
    // Square app-icon style tiles, which crop cleanly to a circle.
    { uri: `https://assets.parqet.com/logos/symbol/${ticker}?format=png&size=128`, fit: 'cover' },
    // Transparent marks with wider coverage.
    { uri: `https://financialmodelingprep.com/image-stock/${ticker}.png`, fit: 'contain' },
  ]
}

/** "C:EURUSD", "eur/usd", "#AAPL", "AAPL.US" → the bare upper-case ticker. */
export function normalizeTicker(symbol: string): string {
  const withoutPrefix = symbol.trim().replace(/^[A-Za-z]:/, '')
  const [head = ''] = withoutPrefix.split('.')
  return head.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function forexLegs(ticker: string): [string, string] | null {
  if (ticker.length !== 6) return null
  const base = ticker.slice(0, 3)
  const quote = ticker.slice(3)
  return CURRENCY_FLAGS[base] && CURRENCY_FLAGS[quote] ? [base, quote] : null
}

function coinOf(ticker: string): string | null {
  for (const quote of CRYPTO_QUOTES) {
    if (ticker.length > quote.length + 1 && ticker.endsWith(quote)) {
      return ticker.slice(0, -quote.length)
    }
  }
  return ticker.length >= 2 ? ticker : null
}

function indexFlag(ticker: string): string | null {
  const exact = INDEX_FLAGS_EXACT[ticker.replace(/\d+$/, '')]
  if (exact) return exact
  const match = /^([A-Z]+)\d+/.exec(ticker)
  return match ? (INDEX_FLAGS_PREFIX[match[1]] ?? null) : null
}

/**
 * Artwork for one instrument, or `null` when its drawn mark is the better
 * badge (metals, energy) or there is nothing to look up.
 */
export function resolveAssetLogo(symbol: string, category?: string): AssetLogo | null {
  const ticker = normalizeTicker(symbol)
  if (!ticker) return null
  if (COMMODITY.test(ticker) || category === 'Metals' || category === 'Energy') return null

  const legs = forexLegs(ticker)
  if (legs && (category === undefined || category === 'Forex')) {
    const [base, quote] = legs
    return {
      type: 'pair',
      base: flagSources(CURRENCY_FLAGS[base]),
      quote: flagSources(CURRENCY_FLAGS[quote]),
      baseCode: base,
      quoteCode: quote,
    }
  }

  if (category === 'Crypto' || (category === undefined && KNOWN_COINS.has(coinOf(ticker) ?? ''))) {
    const coin = coinOf(ticker)
    return coin ? { type: 'single', sources: coinSources(coin) } : null
  }

  if (category === 'Indices' || (category === undefined && indexFlag(ticker))) {
    const flag = indexFlag(ticker)
    return flag ? { type: 'single', sources: flagSources(flag) } : null
  }

  if (category === 'Stocks' || category === undefined) {
    return /^[A-Z][A-Z0-9]{0,5}$/.test(ticker) ? { type: 'single', sources: stockSources(ticker) } : null
  }

  return null
}
