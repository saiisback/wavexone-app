import { z } from 'zod'

import type { InstrumentCategory } from '../../data/types'
import type { OrderCounts } from '../contract'

const finiteNumber = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(Number)
  .refine(Number.isFinite, 'Expected a finite number')
const nonNegativeInteger = finiteNumber.refine(
  (value) => Number.isInteger(value) && value >= 0,
  'Expected a non-negative integer',
)

const successSchema = z.literal('success')

export type CheckedSession = {
  accountToken: string
  secretKey: string
  verified: boolean
  footprint?: string
  userId?: string
  mode?: string
  sessionId?: string
}

const checkedSessionSchema = z.object({
  status: successSchema,
  token: z.string().min(1),
  secret_key: z.string().min(1),
  verify: z.union([z.literal('1'), z.literal(1), z.literal(true)]),
  footprint: z.string().min(1).optional(),
  userID: z.union([z.string(), z.number()]).optional(),
  mode: z.string().min(1).optional(),
  session_id: z.union([z.string(), z.number()]).optional(),
})

export function parseCheckedSession(input: unknown): CheckedSession {
  const parsed = checkedSessionSchema.parse(input)
  return {
    accountToken: parsed.token,
    secretKey: parsed.secret_key,
    verified: true,
    ...(parsed.footprint === undefined ? {} : { footprint: parsed.footprint }),
    ...(parsed.userID === undefined ? {} : { userId: String(parsed.userID) }),
    ...(parsed.mode === undefined ? {} : { mode: parsed.mode }),
    ...(parsed.session_id === undefined ? {} : { sessionId: String(parsed.session_id) }),
  }
}

export type TradingAccountRecord = {
  id: string
  databaseId: string
  uid?: string
  balance: number
  mode: string
  accountType?: string
}

const tradingAccountSchema = z.object({
  token: z.union([z.string(), z.number()]),
  account_id: z.union([z.string(), z.number()]),
  uid: z.union([z.string(), z.number()]).optional(),
  balance: finiteNumber,
  book: z.string().min(1),
  account_type: z.string().min(1).optional(),
})

export function parseTradingAccounts(input: unknown): TradingAccountRecord[] {
  return z.array(tradingAccountSchema).parse(input).map((account) => ({
    id: String(account.token),
    databaseId: String(account.account_id),
    ...(account.uid === undefined ? {} : { uid: String(account.uid) }),
    balance: account.balance,
    mode: account.book,
    ...(account.account_type === undefined ? {} : { accountType: account.account_type }),
  }))
}

const nullableCount = z.union([nonNegativeInteger, z.null()]).transform((value) => value ?? 0)

const orderCountsSchema = z.object({
  status: successSchema,
  open_count: nullableCount,
  pending_count: nullableCount,
  total_count: nonNegativeInteger,
})

export function parseOrderCounts(input: unknown): OrderCounts {
  const parsed = orderCountsSchema.parse(input)
  return { open: parsed.open_count, pending: parsed.pending_count, total: parsed.total_count }
}

export type MarketRecord = {
  ticker: string
  name: string
  market: string
  category: InstrumentCategory
}

const marketEntrySchema = z.object({
  name: z.string().min(1),
  ticker: z.string().min(1),
  market: z.string().min(1),
})

/** Groups are keyed by name (`fx`, `crypto`, …); every array-valued key is one. */
const marketCatalogueSchema = z.record(z.string(), z.unknown())

/**
 * The live labels are mapped exactly. Anything new falls back to a keyword,
 * then to the ticker's prefix (`X:` crypto, `I:` index, `C:` currency/metal),
 * so one unfamiliar label cannot empty the market list.
 */
function marketCategory(market: string, ticker: string): InstrumentCategory {
  const label = market.toLowerCase()
  switch (label) {
    case 'metals':
    case 'metal':
    case 'silver':
      return 'Metals'
    case 'crypto':
      return 'Crypto'
    case 'energy':
    case 'energies':
    case 'crudoil':
    case 'ngas':
      return 'Energy'
    case 'forex':
    case 'fx':
    case 'yen':
      return 'Forex'
    case 'index':
    case 'indices':
      return 'Indices'
    case 'stock':
    case 'stocks':
      return 'Stocks'
  }
  if (label.includes('crypto')) return 'Crypto'
  if (/metal|gold|silver/.test(label)) return 'Metals'
  if (/energ|oil|gas/.test(label)) return 'Energy'
  if (/ind/.test(label)) return 'Indices'
  if (/stock|share|equit/.test(label)) return 'Stocks'
  if (/fx|forex|currenc/.test(label)) return 'Forex'
  if (/^x:/i.test(ticker)) return 'Crypto'
  if (/^i:/i.test(ticker)) return 'Indices'
  if (/^c:/i.test(ticker)) return 'Forex'
  return 'Stocks'
}

export function parseMarketCatalogue(input: unknown): MarketRecord[] {
  const groups = marketCatalogueSchema.parse(input)
  const records: MarketRecord[] = []
  // `fx` then `crypto` first, as the watch screen lists them; then any other group.
  const order = ['fx', 'crypto', ...Object.keys(groups).filter((key) => key !== 'fx' && key !== 'crypto')]
  for (const key of order) {
    const group = groups[key]
    if (!Array.isArray(group)) continue
    for (const candidate of group) {
      // One malformed entry is skipped, not allowed to fail the whole list.
      const entry = marketEntrySchema.safeParse(candidate)
      if (!entry.success) continue
      records.push({
        ticker: entry.data.ticker,
        name: entry.data.name,
        market: entry.data.market,
        category: marketCategory(entry.data.market, entry.data.ticker),
      })
    }
  }
  return records
}

export type SymbolMetadata = {
  spread: number
  precision: number
  lot: number
}

const symbolMetadataEntrySchema = z.object({
  spread: finiteNumber,
  decimal: nonNegativeInteger.refine((value) => value <= 20, 'Expected at most 20 decimal places'),
  lot: finiteNumber.refine((value) => value > 0, 'Expected lot size to be positive'),
})

/** A symbol with unusable settings is left out; the rest still load. */
export function parseSymbolMetadata(input: unknown): Map<string, SymbolMetadata> {
  const parsed = z.record(z.string(), z.unknown()).parse(input)
  const result = new Map<string, SymbolMetadata>()
  for (const [symbol, candidate] of Object.entries(parsed)) {
    const metadata = symbolMetadataEntrySchema.safeParse(candidate)
    if (!metadata.success) continue
    result.set(symbol, {
      spread: metadata.data.spread,
      precision: metadata.data.decimal,
      lot: metadata.data.lot,
    })
  }
  return result
}

const dailySnapshotSchema = z.record(
  z.string(),
  z.object({
    broker: finiteNumber,
    feed: finiteNumber,
    open: finiteNumber,
    high: finiteNumber,
    low: finiteNumber,
    volume: finiteNumber,
  }),
)

export type DailySnapshot = {
  bid: number
  ask: number
  open: number
  high: number
  low: number
  volume: number
}

export function parseDailySnapshots(input: unknown): Map<string, DailySnapshot> {
  const parsed = dailySnapshotSchema.parse(input)
  return new Map(
    Object.entries(parsed).map(([symbol, value]) => [
      symbol,
      { bid: value.broker, ask: value.feed, open: value.open, high: value.high, low: value.low, volume: value.volume },
    ]),
  )
}

const chartHistorySchema = z.object({
  s: z.literal('ok'),
  t: z.array(finiteNumber),
  o: z.array(finiteNumber),
  h: z.array(finiteNumber),
  l: z.array(finiteNumber),
  c: z.array(finiteNumber),
  v: z.array(finiteNumber).optional(),
})

export type ChartHistoryRecord = {
  timestamps: number[]
  opens: number[]
  highs: number[]
  lows: number[]
  closes: number[]
}

export function parseChartHistory(input: unknown): ChartHistoryRecord {
  const parsed = chartHistorySchema.parse(input)
  const length = parsed.t.length
  if ([parsed.o, parsed.h, parsed.l, parsed.c].some((values) => values.length !== length)) {
    throw new Error('Chart history arrays have different lengths')
  }
  return { timestamps: parsed.t, opens: parsed.o, highs: parsed.h, lows: parsed.l, closes: parsed.c }
}

const favoritesEnvelopeSchema = z.object({
  status: successSchema,
  data: z.string(),
})

export function parseFavoriteIds(input: unknown): string[] {
  const envelope = favoritesEnvelopeSchema.parse(input)
  const decoded: unknown = JSON.parse(envelope.data)
  return collectFavoriteSymbols(decoded).map((symbol) => symbol.toLowerCase())
}

function collectFavoriteSymbols(input: unknown): string[] {
  if (typeof input === 'string') return input.length > 0 ? [input] : []
  if (Array.isArray(input)) return input.flatMap(collectFavoriteSymbols)
  if (!input || typeof input !== 'object') throw new Error('Unsupported favorites payload')

  const record = input as Record<string, unknown>
  if (typeof record.symbol === 'string') return [record.symbol]
  if (typeof record.ticker === 'string') return [record.ticker]
  return Object.values(record).flatMap(collectFavoriteSymbols)
}

export type TradingOrderRecord = {
  id: string
  instrumentId: string
  side: 'Buy' | 'Sell'
  lots: number
  entry: number
  state: 'Open' | 'Pending' | 'Closed'
  current?: number
  pnl?: number
  time?: string
  trigger?: number
  stopLoss?: number
  takeProfit?: number
  swap?: number
  commission?: number
  /** `market`, `limit`, … as placed. */
  type?: string
  /** `transit`: a close or change is being executed. */
  busy?: boolean
}

const orderSchema = z.object({
  id: z.union([z.string(), z.number()]),
  symbol: z.string().min(1),
  bs: z.string().min(1),
  lot: finiteNumber,
  avg: finiteNumber,
  status: z.string().min(1),
  time: z.string().optional(),
  trigger: finiteNumber.optional(),
  sl: finiteNumber.optional(),
  tp: finiteNumber.optional(),
  close: finiteNumber.optional(),
  pnl: finiteNumber.optional(),
  t_swap: finiteNumber.optional(),
  commission: finiteNumber.optional(),
  type: z.string().optional(),
})

function orderSide(value: string): TradingOrderRecord['side'] {
  if (value.toLowerCase() === 'buy') return 'Buy'
  if (value.toLowerCase() === 'sell') return 'Sell'
  throw new Error(`Unsupported order side: ${value}`)
}

/**
 * Reference, "Order states": `transit` is an open order being closed or
 * changed; orders that never executed reach history as `rejected` or
 * `cancelled`. Anything else is skipped rather than failing the whole list.
 */
function orderState(value: string): TradingOrderRecord['state'] | null {
  switch (value.toLowerCase()) {
    case 'open':
    case 'transit':
      return 'Open'
    case 'pending':
      return 'Pending'
    case 'closed':
    case 'rejected':
    case 'cancelled':
    case 'canceled':
      return 'Closed'
    default:
      return null
  }
}

function mapOrders(inputs: readonly z.infer<typeof orderSchema>[]): TradingOrderRecord[] {
  return inputs.flatMap((input) => {
    const state = orderState(input.status)
    return state ? [mapOrder(input, state)] : []
  })
}

function mapOrder(
  input: z.infer<typeof orderSchema>,
  state: TradingOrderRecord['state'],
): TradingOrderRecord {
  return {
    id: String(input.id),
    instrumentId: input.symbol.toLowerCase(),
    side: orderSide(input.bs),
    lots: input.lot,
    entry: input.avg,
    state,
    ...(input.status.toLowerCase() === 'transit' ? { busy: true } : {}),
    ...(input.type === undefined ? {} : { type: input.type.toLowerCase() }),
    ...(input.close === undefined ? {} : { current: input.close }),
    ...(input.pnl === undefined ? {} : { pnl: input.pnl }),
    ...(input.time === undefined ? {} : { time: input.time }),
    ...(input.trigger === undefined ? {} : { trigger: input.trigger }),
    ...(input.sl === undefined ? {} : { stopLoss: input.sl }),
    ...(input.tp === undefined ? {} : { takeProfit: input.tp }),
    ...(input.t_swap === undefined ? {} : { swap: input.t_swap }),
    ...(input.commission === undefined ? {} : { commission: input.commission }),
  }
}

const openPositionsSchema = z.union([
  z.object({ status: successSchema, data: z.array(orderSchema) }),
  z.object({
    status: z.literal('fail'),
    message: z.enum(['Orders Not available!', 'No Results']),
    data: z.array(z.never()).length(0),
  }),
])

export function parseOpenPositions(input: unknown): TradingOrderRecord[] {
  return mapOrders(openPositionsSchema.parse(input).data)
}

const historyInfoSchema = z.object({
  page: nonNegativeInteger,
  total: nonNegativeInteger,
  count: nonNegativeInteger,
}).passthrough()

const closedHistorySchema = z.object({
  info: historyInfoSchema,
  data: z.array(orderSchema),
})

export type ClosedHistory = {
  orders: TradingOrderRecord[]
  info: z.infer<typeof historyInfoSchema>
}

export function parseClosedHistory(input: unknown): ClosedHistory {
  const parsed = closedHistorySchema.parse(input)
  const orders = mapOrders(parsed.data)
  if (orders.some((order) => order.state !== 'Closed')) {
    throw new Error('Closed history contained a non-closed order')
  }
  return { orders, info: parsed.info }
}
