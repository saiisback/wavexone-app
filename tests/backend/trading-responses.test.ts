import {
  checkedSessionResponse,
  chartHistoryResponse,
  closedHistoryResponse,
  dailySnapshotResponse,
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
  parseChartHistory,
  parseClosedHistory,
  parseDailySnapshots,
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
      databaseId: 'account-1',
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
      { ticker: 'C:XAUUSD', name: 'Gold', market: 'metals', category: 'Metals' },
      { ticker: 'X:BTCUSD', name: 'Bitcoin', market: 'crypto', category: 'Crypto' },
    ])
    expect(parseSymbolMetadata(symbolMetadataResponse).get('XAUUSD')).toEqual({
      spread: 0.25,
      precision: 2,
      lot: 100,
    })
    expect(parseFavoriteIds(favoritesResponse)).toEqual(['xauusd', 'eurusd'])
  })

  it.each([
    ['metal', 'Metals'],
    ['silver', 'Metals'],
    ['crudoil', 'Energy'],
    ['NGAS', 'Energy'],
    ['yen', 'Forex'],
    ['index', 'Indices'],
    ['stocks', 'Stocks'],
  ] as const)('maps the live %s market label to %s', (market, category) => {
    expect(
      parseMarketCatalogue({ fx: [{ name: 'Test', ticker: 'TEST', market }], crypto: [] })[0].category,
    ).toBe(category)
  })

  it('parses daily quote snapshots and chart arrays without inventing fields', () => {
    expect(parseDailySnapshots(dailySnapshotResponse).get('XAUUSD')).toMatchObject({
      bid: 2400.1,
      ask: 2400.35,
      open: 2390,
    })
    expect(parseChartHistory(chartHistoryResponse).closes).toEqual([2395, 2400, 2405])
    expect(() =>
      parseDailySnapshots({ ...dailySnapshotResponse, XAUUSD: { ...dailySnapshotResponse.XAUUSD, broker: null } }),
    ).toThrow()
  })

  it('rejects malformed stringified favorites', () => {
    expect(() => parseFavoriteIds({ ...favoritesResponse, data: '["XAUUSD"' })).toThrow()
  })

  it('parses the numeric-keyed favorite object produced by PHP arrays with sparse indexes', () => {
    expect(
      parseFavoriteIds({ ...favoritesResponse, data: '{"0":"XAUUSD","2":"EURUSD"}' }),
    ).toEqual(['xauusd', 'eurusd'])
  })

  it('parses favorite sections containing symbol records', () => {
    expect(
      parseFavoriteIds({
        ...favoritesResponse,
        data: JSON.stringify({
          forex: [{ symbol: 'C:XAUUSD' }],
          crypto: [{ ticker: 'X:BTCUSD' }],
        }),
      }),
    ).toEqual(['c:xauusd', 'x:btcusd'])
  })

  it('treats documented empty orders and null counts as empty zero state', () => {
    expect(
      parseOpenPositions({ status: 'fail', message: 'Orders Not available!', data: [] }),
    ).toEqual([])
    expect(
      parseOrderCounts({
        status: 'success',
        total_count: '0',
        open_count: null,
        pending_count: null,
      }),
    ).toEqual({ open: 0, pending: 0, total: 0 })
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
