import type {
  ActivityEntry,
  ChartSeries,
  DetailedAccount,
  Instrument,
  Notification,
  Position,
  Profile,
  Signal,
  Timeframe,
} from './types'

/**
 * Fixtures. Values, names and dates are taken from the design mockups so the
 * screens render exactly what was specified.
 *
 * Replace this module with the `WaveXBackend` client described in
 * WAVEXONE_BACKEND_INTEGRATION_GUIDE.md §5 when the API work starts; the
 * screens only consume the types in `./types`.
 */

export const profile: Profile = {
  holder: 'Jonathan Reed',
  // Remote portrait stands in for the avatar returned by `getuser`.
  // Requested at 2x the 96pt display size.
  avatarUrl:
    'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?auto=format&fit=facearea&facepad=2.6&w=200&h=200&q=80',
  email: 'j.reed@example.com',
  phone: '+44 7700 900412',
  country: 'United Kingdom',
  verified: true,
  kycStatus: 'Verified',
}

export const accounts: readonly DetailedAccount[] = [
  {
    id: 'wx012345',
    mode: 'LIVE',
    number: 'WX012345',
    currency: 'USD',
    leverage: 200,
    equity: 24860.4,
    balance: 24677.7,
    freeMargin: 21883.94,
    changePercent: 4.31,
    asOf: 'December 21, 2022',
    floatingPnl: 182.7,
    openPositions: 2,
    monthNetResult: 1284.6,
    monthTrades: 48,
    monthWinRate: 62,
  },
  {
    id: 'wx012346',
    mode: 'LIVE',
    number: 'WX012346',
    currency: 'USD',
    leverage: 100,
    equity: 8420.15,
    balance: 8420.15,
    freeMargin: 8420.15,
    changePercent: -0.62,
    asOf: 'December 21, 2022',
    floatingPnl: 0,
    openPositions: 0,
    monthNetResult: -118.4,
    monthTrades: 11,
    monthWinRate: 45,
  },
  {
    id: 'wxd90001',
    mode: 'DEMO',
    number: 'WXD90001',
    currency: 'USD',
    leverage: 500,
    equity: 100000,
    balance: 100000,
    freeMargin: 100000,
    changePercent: 0,
    asOf: 'December 21, 2022',
    floatingPnl: 0,
    openPositions: 0,
    monthNetResult: 0,
    monthTrades: 0,
    monthWinRate: 0,
  },
]

export const instruments: readonly Instrument[] = [
  {
    id: 'xauusd',
    symbol: 'XAU/USD',
    name: 'Gold',
    description: 'Gold / US Dollar',
    icon: 'gold',
    price: 2387.42,
    precision: 2,
    changePercent: 0.34,
    bid: 2387.12,
    ask: 2387.72,
    spark: [12, 10, 16, 14, 22, 19, 27, 24, 30, 26, 33, 31, 38, 35, 42, 46],
    category: 'Metals',
    favorite: true,
    contractSize: 100,
  },
  {
    id: 'eurusd',
    symbol: 'EUR/USD',
    name: 'Euro / US Dollar',
    description: 'Euro / US Dollar',
    icon: 'euro',
    price: 1.0842,
    precision: 4,
    changePercent: 0.18,
    bid: 1.084,
    ask: 1.0844,
    spark: [44, 30, 38, 26, 31, 24, 29, 18, 24, 14, 20, 10, 16, 12, 9, 6],
    // The mockup draws this row's line red even though the day is positive.
    sparkTone: 'negative',
    category: 'Forex',
    favorite: true,
    contractSize: 100000,
  },
  {
    id: 'btcusd',
    symbol: 'BTC/USD',
    name: 'Bitcoin',
    description: 'Bitcoin / US Dollar',
    icon: 'bitcoin',
    price: 68241.8,
    precision: 2,
    changePercent: 1.06,
    bid: 68238.4,
    ask: 68245.2,
    spark: [8, 12, 10, 18, 15, 24, 20, 29, 26, 34, 30, 38, 34, 42, 40, 47],
    category: 'Crypto',
    favorite: true,
    contractSize: 1,
  },
  {
    id: 'gbpusd',
    symbol: 'GBP/USD',
    name: 'British Pound',
    description: 'British Pound / US Dollar',
    icon: 'generic',
    iconLabel: '£',
    iconTint: '#1F3B73',
    price: 1.2714,
    precision: 4,
    changePercent: -0.22,
    bid: 1.2712,
    ask: 1.2716,
    spark: [36, 34, 38, 31, 33, 28, 30, 24, 27, 22, 25, 19, 22, 17, 20, 15],
    sparkTone: 'negative',
    category: 'Forex',
    favorite: false,
    contractSize: 100000,
  },
  {
    id: 'usdjpy',
    symbol: 'USD/JPY',
    name: 'US Dollar / Yen',
    description: 'US Dollar / Japanese Yen',
    icon: 'generic',
    iconLabel: '¥',
    iconTint: '#BC002D',
    price: 156.42,
    precision: 2,
    changePercent: 0.41,
    bid: 156.4,
    ask: 156.44,
    spark: [10, 14, 12, 19, 16, 23, 21, 27, 24, 31, 28, 35, 32, 39, 37, 43],
    category: 'Forex',
    favorite: false,
    contractSize: 100000,
  },
  {
    id: 'xagusd',
    symbol: 'XAG/USD',
    name: 'Silver',
    description: 'Silver / US Dollar',
    icon: 'silver',
    price: 30.86,
    precision: 2,
    changePercent: 0.92,
    bid: 30.84,
    ask: 30.88,
    spark: [14, 11, 17, 15, 21, 18, 25, 22, 28, 25, 32, 29, 36, 33, 40, 44],
    category: 'Metals',
    favorite: false,
    contractSize: 5000,
  },
  {
    id: 'ethusd',
    symbol: 'ETH/USD',
    name: 'Ethereum',
    description: 'Ethereum / US Dollar',
    icon: 'ethereum',
    price: 3542.16,
    precision: 2,
    changePercent: -0.78,
    bid: 3541.2,
    ask: 3543.1,
    spark: [42, 38, 40, 33, 36, 30, 32, 26, 29, 23, 26, 20, 23, 18, 21, 16],
    sparkTone: 'negative',
    category: 'Crypto',
    favorite: false,
    contractSize: 1,
  },
  {
    id: 'usoil',
    symbol: 'USOIL',
    name: 'Crude Oil',
    description: 'WTI Crude Oil',
    icon: 'oil',
    price: 78.34,
    precision: 2,
    changePercent: 0.55,
    bid: 78.31,
    ask: 78.37,
    spark: [18, 15, 21, 19, 24, 21, 27, 25, 30, 27, 33, 31, 36, 34, 39, 42],
    category: 'Energy',
    favorite: false,
    contractSize: 1000,
  },
]

export const instrumentsById = new Map(instruments.map((item) => [item.id, item]))

/** Market Watch on the balance screen shows only the first three. */
export const marketWatch = instruments.slice(0, 3)

export const positions: readonly Position[] = [
  {
    id: 'p-1',
    instrumentId: 'xauusd',
    side: 'Buy',
    lots: 0.5,
    entry: 2340.1,
    current: 2346.5,
    pnl: 320,
    state: 'Open',
  },
  {
    id: 'p-2',
    instrumentId: 'eurusd',
    side: 'Sell',
    lots: 1,
    entry: 1.085,
    current: 1.0824,
    pnl: -137.3,
    state: 'Open',
  },
  {
    id: 'p-3',
    instrumentId: 'btcusd',
    side: 'Buy',
    lots: 0.1,
    entry: 67400,
    current: 68241.8,
    pnl: 84.18,
    state: 'Pending',
  },
  {
    id: 'p-4',
    instrumentId: 'xagusd',
    side: 'Buy',
    lots: 2,
    entry: 30.4,
    current: 30.86,
    pnl: 92,
    state: 'Closed',
  },
]

export const positionsById = new Map(positions.map((item) => [item.id, item]))

export const activity: readonly ActivityEntry[] = [
  {
    id: 'a-1',
    kind: 'trade',
    instrumentId: 'xauusd',
    title: 'XAU/USD',
    subtitle: 'Closed • Buy',
    date: 'Dec 21, 2022',
    time: '14:32',
    amount: 320,
    group: 'Today',
    tab: 'Trades',
  },
  {
    id: 'a-2',
    kind: 'deposit',
    title: 'Deposit',
    subtitle: 'Completed',
    date: 'Dec 21, 2022',
    time: '10:15',
    amount: 1000,
    group: 'Today',
    tab: 'Funds',
  },
  {
    id: 'a-3',
    kind: 'trade',
    instrumentId: 'eurusd',
    title: 'EUR/USD',
    subtitle: 'Closed • Sell',
    date: 'Dec 20, 2022',
    time: '16:08',
    amount: -82.4,
    group: 'Yesterday',
    tab: 'Trades',
  },
  {
    id: 'a-4',
    kind: 'withdrawal',
    title: 'Withdrawal',
    subtitle: 'Completed',
    date: 'Dec 20, 2022',
    time: '11:24',
    amount: -250,
    group: 'Yesterday',
    tab: 'Funds',
  },
  {
    id: 'a-5',
    kind: 'trade',
    instrumentId: 'btcusd',
    title: 'BTC/USD',
    subtitle: 'Closed • Buy',
    date: 'Dec 19, 2022',
    time: '09:41',
    amount: 146.2,
    group: 'Earlier',
    tab: 'Trades',
  },
  {
    id: 'a-6',
    kind: 'trade',
    instrumentId: 'xagusd',
    title: 'XAG/USD',
    subtitle: 'Pending • Buy limit',
    date: 'Dec 19, 2022',
    time: '08:05',
    amount: 0,
    group: 'Earlier',
    tab: 'Orders',
  },
]

export const activityById = new Map(activity.map((item) => [item.id, item]))

export const signals: readonly Signal[] = [
  {
    id: 's-1',
    instrumentId: 'xauusd',
    headline: 'Gold holds above key support as markets await data.',
    body: 'Bullion has defended the 2,340 area through three sessions. A close above 2,400 would open the prior high; losing 2,320 puts the range floor back in play.',
    date: 'Nov 21, 2022',
    source: 'WaveX Insight',
  },
  {
    id: 's-2',
    instrumentId: 'eurusd',
    headline: 'Euro steadies into the close as yields drift lower.',
    body: 'Front-end spreads narrowed for a second day. Momentum is neutral into the release; the pair has traded inside 1.0790–1.0870 all week.',
    date: 'Nov 20, 2022',
    source: 'WaveX Insight',
  },
  {
    id: 's-3',
    instrumentId: 'btcusd',
    headline: 'Bitcoin grinds higher on thinning weekend volume.',
    body: 'Spot has added 1.1% while order-book depth stays light. Treat breakouts on this volume profile with caution.',
    date: 'Nov 19, 2022',
    source: 'WaveX Insight',
  },
]

export const notifications: readonly Notification[] = [
  {
    id: 'n-1',
    kind: 'price',
    title: 'XAU/USD reached 2,387.00',
    body: 'Your price alert for Gold has triggered.',
    time: '14:36',
  },
  {
    id: 'n-2',
    kind: 'order',
    title: 'Order filled — XAU/USD Buy 0.50',
    body: 'Filled at 2,340.10. Position is now open.',
    time: '14:32',
  },
  {
    id: 'n-3',
    kind: 'funds',
    title: 'Deposit completed',
    body: '$1,000.00 has been credited to WX012345.',
    time: '10:15',
  },
  {
    id: 'n-4',
    kind: 'news',
    title: 'Weekly market outlook is available',
    body: 'Three setups to watch across metals and FX.',
    time: 'Yesterday',
  },
]

/* ------------------------------------------------------------------ */
/* Chart data                                                          */
/* ------------------------------------------------------------------ */

/**
 * Daily closes for the XAU/USD detail chart, August through December.
 * Index 52 is the value the crosshair reads, matching the mockup exactly.
 */
const XAU_MONTHLY: readonly number[] = [
  2212, 2206, 2222, 2216, 2234, 2246, 2240, 2258, 2272, 2266, 2284, 2298, 2292, 2310, 2326, 2342,
  2334, 2352, 2370, 2362, 2384, 2404, 2424, 2440, 2444, 2430, 2436, 2412, 2394, 2400, 2378, 2366,
  2372, 2350, 2338, 2344, 2322, 2308, 2314, 2292, 2278, 2266, 2262, 2274, 2286, 2280, 2296, 2310,
  2304, 2322, 2340, 2362, 2387.42, 2398, 2392, 2410, 2424, 2418, 2436, 2450, 2444, 2462, 2478, 2472,
  2490, 2504, 2498, 2514, 2524, 2508,
]

/**
 * Deterministic walk so every render — and every reviewer — sees the same
 * chart. A real client replaces this with `charting_library_cloned_data`.
 */
function walk(seed: number, count: number, start: number, drift: number, swing: number) {
  let state = seed
  const random = () => {
    state = (state * 1103515245 + 12345) % 2147483648
    return state / 2147483648
  }

  const points: number[] = []
  let value = start
  for (let index = 0; index < count; index++) {
    value += drift + (random() - 0.5) * swing
    points.push(Math.round(value * 100) / 100)
  }
  return points
}

/** Rounds the axis outward to the nearest step so labels stay whole. */
function bounds(points: readonly number[], step: number) {
  const min = Math.floor(Math.min(...points) / step) * step
  const max = Math.ceil(Math.max(...points) / step) * step
  return { min, max }
}

function buildSeries(
  points: readonly number[],
  labels: readonly string[],
  step: number,
  cursorIndex: number,
  cursorOpen?: number,
): ChartSeries {
  const close = points[cursorIndex] ?? points[points.length - 1]
  return {
    points,
    labels,
    cursorIndex,
    cursorOpen: cursorOpen ?? Math.round((close - 8.32) * 100) / 100,
    cursorClose: close,
    ...bounds(points, step),
    step,
  }
}

const INTRADAY = walk(7, 48, 2372, 0.34, 9)
const FIVE_DAY = walk(19, 60, 2352, 0.62, 14)
const ONE_WEEK = walk(31, 56, 2344, 0.82, 16)
const THREE_MONTH = walk(53, 78, 2180, 4.4, 34)
const SIX_MONTH = walk(71, 90, 1990, 4.6, 46)

/**
 * The 1M entry is the hand-tuned series from the mockup — same shape, same
 * crosshair values, same month labels. The others are generated.
 */
export const xauChart: Readonly<Record<Timeframe, ChartSeries>> = {
  '1D': buildSeries(INTRADAY, ['09:00', '11:00', '13:00', '15:00', '17:00'], 20, 34),
  '5D': buildSeries(FIVE_DAY, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 25, 43),
  '1W': buildSeries(ONE_WEEK, ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'], 25, 40),
  '1M': {
    points: XAU_MONTHLY,
    labels: ['Aug', 'Sept', 'Oct', 'Nov', 'Dec'],
    cursorIndex: 52,
    cursorOpen: 2379.1,
    cursorClose: 2387.42,
    min: 2000,
    max: 2600,
    step: 100,
  },
  '3M': buildSeries(THREE_MONTH, ['Oct', 'Nov', 'Dec'], 100, 56),
  '6M': buildSeries(SIX_MONTH, ['Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'], 100, 64),
}

export const timeframes: readonly Timeframe[] = ['1D', '5D', '1W', '1M', '3M', '6M']

/** Deposit methods and withdrawal destinations, shaped like `apiRedeemConfig`. */
export const fundingMethods = {
  deposit: ['Card', 'Bank transfer', 'Crypto (USDT)'],
  withdraw: ['Bank transfer', 'Crypto (USDT)'],
} as const

export const quickAmounts: readonly number[] = [100, 500, 1000, 5000]
