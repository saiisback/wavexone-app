import {
  checkedSessionResponse,
  closedHistoryResponse,
  emptyClosedHistoryResponse,
  favoritesResponse,
  marketCatalogueResponse,
  openPositionsResponse,
  orderCountsResponse,
  symbolMetadataResponse,
  tradingAccountsResponse,
} from './fixtures/trading-responses'
import {
  parseCheckedSession,
  parseClosedHistory,
  parseFavoriteIds,
  parseMarketCatalogue,
  parseOpenPositions,
  parseOrderCounts,
  parseSymbolMetadata,
  parseTradingAccounts,
} from '../../src/backend/responses/trading'

describe('trading response parsers', () => {
  it('extracts session material without retaining the echoed password', () => {
    const session = parseCheckedSession(checkedSessionResponse)

    expect(session).toEqual({
      accountToken: 'account-token-placeholder',
      secretKey: 'secret-placeholder',
      verified: true,
      footprint: 'device-placeholder',
      userId: 'user-1',
      mode: 'live',
      sessionId: 'session-placeholder',
    })
    expect(session).not.toHaveProperty('password')
  })

  it('rejects a session missing its secret key', () => {
    const { secret_key: _secret, ...missingSecret } = checkedSessionResponse
    expect(() => parseCheckedSession(missingSecret)).toThrow()
  })

  it('parses accounts and order counts without losing numeric strings', () => {
    expect(parseTradingAccounts(tradingAccountsResponse)[0]).toMatchObject({
      id: 'account-1',
      balance: 1250.5,
      mode: 'LIVE',
    })
    expect(parseOrderCounts(orderCountsResponse)).toEqual({ open: 1, pending: 1, total: 2 })
  })

  it.each([Number.NaN, Number.POSITIVE_INFINITY])('rejects a non-finite balance: %s', (balance) => {
    expect(() => parseTradingAccounts([{ ...tradingAccountsResponse[0], balance }])).toThrow()
  })

  it('parses catalogue groups, symbol metadata, and stringified favorites', () => {
    expect(parseMarketCatalogue(marketCatalogueResponse)).toEqual([
      { ticker: 'XAUUSD', market: 'metals', category: 'Metals' },
      { ticker: 'BTCUSD', market: 'crypto', category: 'Crypto' },
    ])
    expect(parseSymbolMetadata(symbolMetadataResponse).get('XAUUSD')).toEqual({
      spread: 0.25,
      precision: 2,
      lot: 100,
    })
    expect(parseFavoriteIds(favoritesResponse)).toEqual(['xauusd', 'eurusd'])
  })

  it('rejects malformed stringified favorites', () => {
    expect(() => parseFavoriteIds({ ...favoritesResponse, data: '["XAUUSD"' })).toThrow()
  })

  it('parses open and pending order transport records', () => {
    const orders = parseOpenPositions(openPositionsResponse)
    expect(orders.map((order) => order.state)).toEqual(['Open', 'Pending'])
    expect(orders[0]).toMatchObject({ id: 'order-open', side: 'Buy', lots: 0.5, entry: 2400.25 })
  })

  it('rejects unknown order states instead of guessing', () => {
    const invalid = {
      ...openPositionsResponse,
      data: [{ ...openPositionsResponse.data[0], status: 'mystery' }],
    }
    expect(() => parseOpenPositions(invalid)).toThrow()
  })

  it('parses a closed history page and accepts an empty page', () => {
    expect(parseClosedHistory(closedHistoryResponse).orders[0]).toMatchObject({
      id: 'order-closed',
      state: 'Closed',
      pnl: 25.75,
    })
    expect(parseClosedHistory(emptyClosedHistoryResponse).orders).toEqual([])
  })
})
