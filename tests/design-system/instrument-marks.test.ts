import { instrumentIconLabel, instrumentMark } from '../../src/design-system/instrument-marks'

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
})
