import { normalizeTicker, resolveAssetLogo } from '../../src/design-system/asset-logo'

/**
 * The badge resolver turns whatever ticker the server lists into artwork.
 * What matters is the routing — which family a ticker lands in and what it
 * falls back to — not the CDN, which the badge already survives losing.
 */

const uris = (logo: ReturnType<typeof resolveAssetLogo>) =>
  logo?.type === 'single' ? logo.sources.map((source) => source.uri) : []

describe('normalizeTicker', () => {
  it.each([
    ['C:EURUSD', 'EURUSD'],
    ['eur/usd', 'EURUSD'],
    ['X:BTCUSD', 'BTCUSD'],
    ['#AAPL', 'AAPL'],
    ['AAPL.US', 'AAPL'],
    [' us30 ', 'US30'],
  ])('%s → %s', (input, expected) => {
    expect(normalizeTicker(input)).toBe(expected)
  })
})

describe('resolveAssetLogo', () => {
  it('shows both flags for a currency pair, base first', () => {
    const logo = resolveAssetLogo('EUR/USD', 'Forex')
    expect(logo).toMatchObject({ type: 'pair', baseCode: 'EUR', quoteCode: 'USD' })
    if (logo?.type !== 'pair') throw new Error('expected a pair')
    expect(logo.base[0].uri).toContain('/eu.png')
    expect(logo.quote[0].uri).toContain('/us.png')
  })

  it('recognises a pair without a category', () => {
    expect(resolveAssetLogo('GBPJPY')).toMatchObject({ type: 'pair', baseCode: 'GBP', quoteCode: 'JPY' })
  })

  it('leaves an unknown currency pair to the drawn badge', () => {
    expect(resolveAssetLogo('ABCXYZ', 'Forex')).toBeNull()
  })

  it('looks a coin up by its base, whatever the quote leg', () => {
    for (const symbol of ['BTC/USD', 'BTCUSDT', 'X:BTCUSD']) {
      expect(uris(resolveAssetLogo(symbol, 'Crypto'))[0]).toMatch(/\/btc\.png$/)
    }
    expect(uris(resolveAssetLogo('DOGEUSD', 'Crypto'))[0]).toMatch(/\/doge\.png$/)
  })

  it('recognises a well-known coin without a category', () => {
    expect(uris(resolveAssetLogo('ETH/USD'))[0]).toMatch(/\/eth\.png$/)
  })

  it('gives a stock its company logo with a second source to fall back on', () => {
    const sources = uris(resolveAssetLogo('AAPL', 'Stocks'))
    expect(sources).toHaveLength(2)
    expect(sources.every((uri) => uri.includes('AAPL'))).toBe(true)
  })

  it.each([
    ['US30', 'us'],
    ['NAS100', 'us'],
    ['SPX500', 'us'],
    ['GER40', 'de'],
    ['UK100', 'gb'],
    ['JP225', 'jp'],
    ['HK50', 'hk'],
    ['NDX', 'us'],
  ])('flags index %s as %s', (symbol, country) => {
    expect(uris(resolveAssetLogo(symbol, 'Indices'))[0]).toContain(`/${country}.png`)
  })

  it.each([
    ['XAU/USD', 'Metals'],
    ['XAG/USD', 'Metals'],
    ['USOIL', 'Energy'],
    ['XAUUSD', undefined],
    ['UKOIL', undefined],
  ])('keeps the drawn mark for %s', (symbol, category) => {
    expect(resolveAssetLogo(symbol, category)).toBeNull()
  })

  it('returns nothing for an empty symbol', () => {
    expect(resolveAssetLogo('', 'Stocks')).toBeNull()
    expect(resolveAssetLogo('/', undefined)).toBeNull()
  })
})
