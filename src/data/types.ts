import type { AssetIconKind } from '../design-system'

/**
 * Presentation-layer shapes.
 *
 * These mirror the capabilities described in WAVEXONE_BACKEND_INTEGRATION_GUIDE.md
 * (`markets.catalogue`, `orders.list`, `funds.history`, …) but nothing here talks
 * to a network — the UI is wired to fixtures so the screens can be reviewed
 * before the `WaveXBackend` module exists.
 */

export type Instrument = {
  id: string
  /** "XAU/USD" */
  symbol: string
  /** "Gold" — the short form shown on Market Watch rows. */
  name: string
  /** "Gold / US Dollar" — the long form shown on detail and signal cards. */
  description: string
  icon: AssetIconKind
  /** Letters for the fallback disc. */
  iconLabel?: string
  iconTint?: string
  price: number
  /** Digits after the decimal point for this instrument. */
  precision: number
  changePercent: number
  bid: number
  ask: number
  /** Series driving the row sparkline. */
  spark: readonly number[]
  /** Mockup quirk: EUR/USD is up on the day but its sparkline is drawn red. */
  sparkTone?: 'positive' | 'negative'
  category: InstrumentCategory
  /** Seeds the favourites set in the session store. */
  favorite: boolean
  /** Units per lot, used for the margin preview. */
  contractSize: number
  /** Today's open, so a live price can recompute `changePercent`. */
  dayOpen?: number
}

export type InstrumentCategory = 'Metals' | 'Forex' | 'Crypto' | 'Energy' | 'Indices' | 'Stocks'

/** The person, independent of which trading account is selected. */
export type Profile = {
  holder: string
  avatarUrl: string
  email: string
  phone: string
  country: string
  verified: boolean
  kycStatus: 'Verified' | 'In review' | 'Not started'
}

export type Account = {
  id: string
  /** "LIVE" or "DEMO". */
  mode: string
  number: string
  currency: string
  leverage: number
  equity: number
  balance: number
  freeMargin: number
  changePercent: number
  /** Human date printed on the portfolio band. */
  asOf: string
  floatingPnl: number
  openPositions?: number
  monthNetResult?: number
  monthTrades?: number
  monthWinRate?: number
}

export type Position = {
  id: string
  instrumentId: string
  side: 'Buy' | 'Sell'
  lots: number
  entry: number
  current: number
  pnl: number
  state: 'Open' | 'Pending' | 'Closed'
  /** Absent when the order carries none. */
  stopLoss?: number
  takeProfit?: number
  /** Pending orders: the price the order is waiting for. */
  trigger?: number
  /** Server timestamp, `YYYY-MM-DD HH:MM:SS`, zone unstated. */
  time?: string
  /** A market order accepted but not yet filled — shown as "Executing…". */
  executing?: boolean
  /** A close or change of this order is in progress (`transit`). */
  busy?: boolean
}

export type ActivityEntry = {
  id: string
  kind: 'trade' | 'deposit' | 'withdrawal'
  /** Instrument id for trades; undefined for funding entries. */
  instrumentId?: string
  title: string
  subtitle: string
  date: string
  time: string
  amount: number
  group: 'Today' | 'Yesterday' | 'Earlier'
  tab: 'Trades' | 'Funds' | 'Orders'
}

export type Signal = {
  id: string
  instrumentId: string
  headline: string
  body: string
  date: string
  source: string
}

export type Notification = {
  id: string
  kind: 'price' | 'order' | 'funds' | 'news'
  title: string
  body: string
  time: string
}

/** One timeframe's worth of chart data, pre-shaped for `PriceChart`. */
export type ChartSeries = {
  points: readonly number[]
  labels: readonly string[]
  cursorIndex: number
  cursorOpen: number
  cursorClose: number
  min: number
  max: number
  step: number
  /** Per-point opens, so touching the chart can read any bar. */
  opens?: readonly number[]
  /** Per-point bar times (epoch ms), for the scrubbing read-out. */
  times?: readonly number[]
  /** Digits on the price axis; whole numbers when absent. */
  axisDecimals?: number
}

export type Timeframe = '1D' | '5D' | '1W' | '1M' | '3M' | '6M'

/** Funding flows share one screen; this picks which copy and fields to show. */
export type FundingMode = 'deposit' | 'withdraw' | 'transfer'
