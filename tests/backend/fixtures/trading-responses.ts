export const checkedSessionResponse = {
  userID: 'user-1',
  status: 'success',
  token: 'account-token-placeholder',
  mode: 'live',
  session_id: 'session-placeholder',
  password: 'must-never-escape',
  verify: '1',
  secret_key: 'secret-placeholder',
  footprint: 'device-placeholder',
} as const

export const tradingAccountsResponse = [
  {
    uid: 'user-1',
    token: 'account-1',
    account_id: 'account-1',
    balance: 1250.5,
    book: 'LIVE',
    account_type: 'standard',
  },
] as const

export const accountDetailResponse = {
  status: 'success',
  message: 'success',
  data: {
    balance: '2450.75',
    fund: '2180.25',
    credit: '25.00',
    equity: '2475.50',
    currency: 'USD',
  },
} as const

export const orderCountsResponse = {
  status: 'success',
  total_count: '2',
  open_count: '1',
  pending_count: '1',
} as const

export const marketCatalogueResponse = {
  fx: [{ name: 'Gold', ticker: 'C:XAUUSD', market: 'metals' }],
  crypto: [{ name: 'Bitcoin', ticker: 'X:BTCUSD', market: 'crypto' }],
} as const

export const symbolMetadataResponse = {
  XAUUSD: { spread: 100, decimal: 2, lot: 0.01 },
  EURUSD: { spread: 100000, decimal: 5, lot: 0.01 },
  BTCUSD: { spread: 100, decimal: 2, lot: 0.01 },
} as const

export const dailySnapshotResponse = {
  XAUUSD: { broker: '2400.10', feed: '2400.35', open: 2390, high: 2410, low: 2380, volume: 1200 },
  BTCUSD: { broker: '68000.00', feed: '68010.00', open: 67500, high: 68500, low: 67000, volume: 800 },
} as const

export const chartHistoryResponse = {
  s: 'ok',
  t: [1727654400, 1727740800, 1727827200],
  o: [2390, 2395, 2400],
  h: [2400, 2405, 2410],
  l: [2380, 2385, 2390],
  c: [2395, 2400, 2405],
  v: [100, 110, 120],
} as const

export const favoritesResponse = {
  status: 'success',
  message: 'ok',
  data: '["XAUUSD","EURUSD"]',
} as const

export const openPositionsResponse = {
  status: 'success',
  data: [
    {
      id: 'order-open',
      symbol: 'XAUUSD',
      formated_symbol: 'XAU/USD',
      pair: 'Gold / US Dollar',
      time: '2026-09-30 10:00:00',
      trigger: '0',
      type: 'market',
      lot: '0.50',
      bs: 'buy',
      sl: '2300.00',
      tp: '2500.00',
      avg: '2400.25',
      t_swap: '-1.25',
      commission: '-0.50',
      status: 'open',
      partiallot: '0',
    },
    {
      id: 'order-pending',
      symbol: 'EURUSD',
      formated_symbol: 'EUR/USD',
      pair: 'Euro / US Dollar',
      time: '2026-09-30 10:05:00',
      trigger: '1.0850',
      type: 'limit',
      lot: '1.00',
      bs: 'sell',
      sl: '1.0900',
      tp: '1.0750',
      avg: '0',
      t_swap: '0',
      commission: '0',
      status: 'pending',
      partiallot: '0',
    },
  ],
} as const

export const closedHistoryResponse = {
  info: {
    brokerage: '1.50',
    swap: '-0.50',
    total_deposit: '1000.00',
    total_withdraw: '0.00',
    mamShareValue: 0,
    mamUser: '0',
    sharedProfit: 0,
    pnl: 25.75,
    winning_trades: 1,
    losing_trades: 0,
    page: 1,
    total: 1,
    count: 1,
  },
  data: [
    {
      id: 'order-closed',
      symbol: 'XAUUSD',
      lot: '0.10',
      bs: 'buy',
      avg: '2300.00',
      close: '2325.75',
      pnl: '25.75',
      status: 'closed',
      time: '2026-09-29 09:00:00',
    },
  ],
} as const

export const emptyClosedHistoryResponse = {
  ...closedHistoryResponse,
  info: { ...closedHistoryResponse.info, total: 0, count: 0 },
  data: [],
} as const
