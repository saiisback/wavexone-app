import { z } from 'zod'

import type { InstrumentCategory } from '../../data/types'
import type { OrderCounts } from '../contract'

const finiteNumber = z.coerce.number().refine(Number.isFinite, 'Expected a finite number')
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
  uid?: string
  balance: number
  mode: string
  accountType?: string
}

const tradingAccountSchema = z.object({
  account_id: z.union([z.string(), z.number()]),
  uid: z.union([z.string(), z.number()]).optional(),
  balance: finiteNumber,
  book: z.string().min(1),
  account_type: z.string().min(1).optional(),
})

export function parseTradingAccounts(input: unknown): TradingAccountRecord[] {
  return z.array(tradingAccountSchema).parse(input).map((account) => ({
    id: String(account.account_id),
    ...(account.uid === undefined ? {} : { uid: String(account.uid) }),
    balance: account.balance,
    mode: account.book,
    ...(account.account_type === undefined ? {} : { accountType: account.account_type }),
  }))
}

const orderCountsSchema = z.object({
  status: successSchema,
  open_count: nonNegativeInteger,
  pending_count: nonNegativeInteger,
  total_count: nonNegativeInteger,
})

export function parseOrderCounts(input: unknown): OrderCounts {
  const parsed = orderCountsSchema.parse(input)
  return { open: parsed.open_count, pending: parsed.pending_count, total: parsed.total_count }
}

export type MarketRecord = {
  ticker: string
  market: string
  category: InstrumentCategory
}

const marketEntrySchema = z.object({
  ticker: z.string().min(1),
  market: z.string().min(1),
})

const marketCatalogueSchema = z.object({
  fx: z.array(marketEntrySchema).default([]),
  crypto: z.array(marketEntrySchema).default([]),
})

function marketCategory(market: string): InstrumentCategory {
  switch (market.toLowerCase()) {
    case 'metals':
      return 'Metals'
    case 'crypto':
      return 'Crypto'
    case 'energy':
    case 'energies':
      return 'Energy'
    case 'forex':
    case 'fx':
      return 'Forex'
    default:
      throw new Error(`Unsupported market category: ${market}`)
  }
}

export function parseMarketCatalogue(input: unknown): MarketRecord[] {
  const parsed = marketCatalogueSchema.parse(input)
  return [...parsed.fx, ...parsed.crypto].map((entry) => ({
    ticker: entry.ticker,
    market: entry.market,
    category: marketCategory(entry.market),
  }))
}

export type SymbolMetadata = {
  spread: number
  precision: number
  lot: number
}

const symbolMetadataSchema = z.record(
  z.string(),
  z.object({
    spread: finiteNumber,
    decimal: nonNegativeInteger,
    lot: finiteNumber.refine((value) => value > 0, 'Expected lot size to be positive'),
  }),
)

export function parseSymbolMetadata(input: unknown): Map<string, SymbolMetadata> {
  const parsed = symbolMetadataSchema.parse(input)
  return new Map(
    Object.entries(parsed).map(([symbol, metadata]) => [
      symbol,
      { spread: metadata.spread, precision: metadata.decimal, lot: metadata.lot },
    ]),
  )
}

const favoritesEnvelopeSchema = z.object({
  status: successSchema,
  data: z.string(),
})

export function parseFavoriteIds(input: unknown): string[] {
  const envelope = favoritesEnvelopeSchema.parse(input)
  const decoded: unknown = JSON.parse(envelope.data)
  return z.array(z.string().min(1)).parse(decoded).map((symbol) => symbol.toLowerCase())
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
})

function orderSide(value: string): TradingOrderRecord['side'] {
  if (value.toLowerCase() === 'buy') return 'Buy'
  if (value.toLowerCase() === 'sell') return 'Sell'
  throw new Error(`Unsupported order side: ${value}`)
}

function orderState(value: string): TradingOrderRecord['state'] {
  switch (value.toLowerCase()) {
    case 'open':
      return 'Open'
    case 'pending':
      return 'Pending'
    case 'closed':
      return 'Closed'
    default:
      throw new Error(`Unsupported order state: ${value}`)
  }
}

function mapOrder(input: z.infer<typeof orderSchema>): TradingOrderRecord {
  return {
    id: String(input.id),
    instrumentId: input.symbol.toLowerCase(),
    side: orderSide(input.bs),
    lots: input.lot,
    entry: input.avg,
    state: orderState(input.status),
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

const openPositionsSchema = z.object({
  status: successSchema,
  data: z.array(orderSchema),
})

export function parseOpenPositions(input: unknown): TradingOrderRecord[] {
  return openPositionsSchema.parse(input).data.map(mapOrder)
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
  const orders = parsed.data.map(mapOrder)
  if (orders.some((order) => order.state !== 'Closed')) {
    throw new Error('Closed history contained a non-closed order')
  }
  return { orders, info: parsed.info }
}
