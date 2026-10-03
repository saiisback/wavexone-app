import {
  currencyPairFlags,
  indexFlag,
  instrumentIconLabel,
  instrumentMark,
} from '../../src/design-system/instrument-marks'

describe('instrument artwork metadata', () => {
  it.each([
    ['X:BTCUSD', 'bitcoin'],
    ['X:LTCUSD', 'litecoin'],
    ['X:ADAUSD', 'cardano'],
    ['X:DOTUSD', 'polkadot'],
    ['X:EOSUSD', 'eos'],
  ])('maps crypto symbol %s to its own mark', (symbol, mark) => {
    expect(instrumentMark(symbol, 'Crypto')).toBe(mark)
  })

  it.each(['C:EURUSD', 'C:AUDCAD', 'C:USDJPY'])('maps %s to a currency-pair mark', (symbol) => {
    expect(instrumentMark(symbol, 'Forex')).toBe('forex')
  })

  it.each([
    ['C:XAUUSD', 'gold'],
    ['C:XAGUSD', 'silver'],
    ['C:COPPER', 'copper'],
    ['C:XPTUSD', 'platinum'],
    ['C:XPDUSD', 'palladium'],
    ['C:WTIcash', 'oil'],
    ['C:NGAScash', 'gas'],
  ])('maps commodity %s to %s artwork', (symbol, mark) => {
    expect(instrumentMark(symbol)).toBe(mark)
  })

  it('uses a market-aware index mark', () => {
    expect(instrumentMark('C:US100cash', 'Indices')).toBe('index')
  })

  it('uses bundled brands when available and a stock badge otherwise', () => {
    expect(instrumentMark('US:AAPL.OQ', 'Stocks')).toBe('apple')
    expect(instrumentMark('US:COIN.OQ', 'Stocks')).toBe('coinbase')
    expect(instrumentMark('HK:0001.HK', 'Stocks')).toBe('stock')
  })

  it.each([
    ['C:AUDCAD', 'AUDCAD'],
    ['US:AAPL.OQ', 'AAPL'],
    ['HK:0001.HK', '0001'],
  ])('keeps a useful artwork label for %s', (symbol, label) => {
    expect(instrumentIconLabel(symbol)).toBe(label)
  })

  it.each([
    ['X:SOLUSD', 'solana'],
    ['XRPUSDT', 'xrp'],
    ['DOGEUSD', 'dogecoin'],
    ['LINKUSD', 'chainlink'],
  ])('maps the wider coin set: %s → %s', (symbol, mark) => {
    expect(instrumentMark(symbol)).toBe(mark)
  })

  it('treats quoted coins as coins even when the feed labels them stocks', () => {
    expect(instrumentMark('X:BTCUSD', 'Stocks')).toBe('bitcoin')
    expect(instrumentMark('SOLUSD', 'Stocks')).toBe('solana')
  })

  it('keeps bare stock tickers that collide with coin codes as stocks', () => {
    expect(instrumentMark('US:SOL', 'Stocks')).toBe('stock')
    expect(instrumentMark('US:LTC', 'Stocks')).toBe('stock')
    expect(instrumentMark('LTC', 'Crypto')).toBe('litecoin')
    expect(instrumentMark('SOLVAY')).toBe('generic')
  })

  it('does not show a parcel courier for Hermès', () => {
    expect(instrumentMark('HRMS', 'Stocks')).toBe('stock')
  })

  it.each([
    ['C:EURUSD', ['eu', 'us']],
    ['GBP/JPY', ['gb', 'jp']],
    ['USDTRY', ['us', 'tr']],
  ])('finds both flags for %s', (symbol, flags) => {
    expect(currencyPairFlags(symbol)).toEqual(flags)
  })

  it('has no flags for an unknown pair', () => {
    expect(currencyPairFlags('XAUUSD')).toBeNull()
    expect(currencyPairFlags('AAPL')).toBeNull()
  })

  it.each([
    ['C:US100cash', 'us'],
    ['US30', 'us'],
    ['NAS100', 'us'],
    ['GER40', 'de'],
    ['UK100', 'gb'],
    ['JP225', 'jp'],
    ['AUS200', 'au'],
    ['EU50', 'eu'],
  ])('finds the home market of index %s', (symbol, flag) => {
    expect(indexFlag(symbol)).toBe(flag)
  })

  it('has no flag for an unknown index', () => {
    expect(indexFlag('ZZ10')).toBeNull()
  })
})
