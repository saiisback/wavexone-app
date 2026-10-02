import { z } from 'zod'

import type { Notification } from '../../data/types'

const finiteNumber = z
  .union([z.number(), z.string().trim().min(1)])
  .transform(Number)
  .refine(Number.isFinite, 'Expected a finite number')
const successSchema = z.literal('success')

const portalUserSchema = z.object({
  uid: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  email: z.string().optional(),
  mobile: z.string().optional(),
  accountId: z.union([z.string(), z.number()]),
  verified: z.union([z.boolean(), z.number(), z.string()]),
})

const portalAccountSchema = z.object({
  id: z.union([z.string(), z.number()]),
  token: z.union([z.string(), z.number()]).optional(),
  code: z.union([z.string(), z.number()]),
  balance: finiteNumber,
  fund: finiteNumber,
  equity: finiteNumber,
  currency: z.string().min(1),
  isDemo: z.boolean(),
  leverage: z.union([
    finiteNumber.refine((value) => value >= 0, 'Expected non-negative leverage'),
    z.literal('custom'),
  ]),
  leverageLabel: z.string().optional(),
})

const portalSummarySchema = z.object({
  totalFund: finiteNumber,
  totalBalance: finiteNumber,
  totalEquity: finiteNumber,
  accountCount: finiteNumber,
  referralCount: finiteNumber,
  referralBonus: finiteNumber,
  growthPercent30d: finiteNumber,
})

const portalTransactionSchema = z.object({
  id: z.union([z.string(), z.number()]),
  createdAt: z.string().min(1),
  method: z.string().optional(),
  amount: finiteNumber,
  status: z.string().optional(),
  reason: z.string().optional(),
  type: z.string().min(1),
  flowType: z.string().optional(),
  date: z.string().optional(),
  time: z.string().optional(),
  currency: z.string().optional(),
  accountId: z.union([z.string(), z.number()]).optional(),
  reference: z.string().optional(),
})

const portalTransactionsSchema = z
  .union([
    z.array(portalTransactionSchema),
    z.object({ items: z.array(portalTransactionSchema) }),
  ])
  .transform((transactions) =>
    Array.isArray(transactions) ? transactions : transactions.items,
  )

const portalBootstrapSchema = z.object({
  status: successSchema,
  data: z.object({
    user: portalUserSchema,
    accounts: z.array(portalAccountSchema),
    summary: portalSummarySchema,
    transactions: portalTransactionsSchema,
  }),
})

export type PortalBootstrap = {
  user: {
    id: string
    holder?: string
    email?: string
    phone?: string
    accountId: string
    verified: boolean
  }
  accounts: {
    /** Token, database id, and display code used by the two APIs. */
    identifiers: string[]
    id: string
    number: string
    balance: number
    fund: number
    equity: number
    currency: string
    isDemo: boolean
    leverage: number
  }[]
  summary: z.infer<typeof portalSummarySchema>
  transactions: {
    id: string
    createdAt: string
    amount: number
    type: string
    method?: string
    status?: string
    reason?: string
    flowType?: string
    date?: string
    time?: string
    currency?: string
    accountId?: string
    reference?: string
  }[]
}

function truthyFlag(value: boolean | number | string): boolean {
  return value === true || value === 1 || value === '1' || value === 'true'
}

export function parsePortalBootstrap(input: unknown): PortalBootstrap {
  const { data } = portalBootstrapSchema.parse(input)
  return {
    user: {
      id: String(data.user.uid),
      ...(data.user.name === undefined ? {} : { holder: data.user.name }),
      ...(data.user.email === undefined ? {} : { email: data.user.email }),
      ...(data.user.mobile === undefined ? {} : { phone: data.user.mobile }),
      accountId: String(data.user.accountId),
      verified: truthyFlag(data.user.verified),
    },
    accounts: data.accounts.map((account) => {
      const id = String(account.token ?? account.id)
      const number = String(account.code)
      return {
        identifiers: [...new Set([id, String(account.id), number])],
        id,
        number,
        balance: account.balance,
        fund: account.fund,
        equity: account.equity,
        currency: account.currency,
        isDemo: account.isDemo,
        leverage: parseLeverage(account.leverage, account.leverageLabel),
      }
    }),
    summary: data.summary,
    transactions: data.transactions.map((transaction) => ({
      id: String(transaction.id),
      createdAt: transaction.createdAt,
      amount: transaction.amount,
      type: transaction.type,
      ...(transaction.method === undefined ? {} : { method: transaction.method }),
      ...(transaction.status === undefined ? {} : { status: transaction.status }),
      ...(transaction.reason === undefined ? {} : { reason: transaction.reason }),
      ...(transaction.flowType === undefined ? {} : { flowType: transaction.flowType }),
      ...(transaction.date === undefined ? {} : { date: transaction.date }),
      ...(transaction.time === undefined ? {} : { time: transaction.time }),
      ...(transaction.currency === undefined ? {} : { currency: transaction.currency }),
      ...(transaction.accountId === undefined ? {} : { accountId: String(transaction.accountId) }),
      ...(transaction.reference === undefined ? {} : { reference: transaction.reference }),
    })),
  }
}

function parseLeverage(value: number | 'custom', label?: string): number {
  if (value !== 'custom') return value
  const parsed = Number(label?.match(/(?:^|:)\s*(\d+(?:\.\d+)?)\s*$/)?.[1])
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error('Custom leverage has no numeric leverage label')
  }
  return parsed
}

const depositMethodSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1).optional(),
  displayName: z.string().min(1).optional(),
  code: z.string().min(1),
  minimumAmount: finiteNumber,
  isBank: z.boolean().optional(),
  imageUrl: z.string().optional(),
  disclaimer: z.string().optional(),
  headerImage: z.string().optional(),
})

const withdrawModeSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
})

const withdrawFieldSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().min(1),
  label: z.string().min(1).optional(),
})

const fundingConfigurationSchema = z.object({
  status: successSchema,
  data: z.object({
    depositMethods: z.array(depositMethodSchema),
    withdrawModes: z.array(withdrawModeSchema),
    withdrawFields: z.array(withdrawFieldSchema),
    kycVerified: z.union([z.boolean(), z.number(), z.string()]),
    availableFund: finiteNumber,
  }),
})

export type PortalFundingConfiguration = {
  depositMethods: (z.infer<typeof depositMethodSchema> & { id: string; name: string })[]
  withdrawModes: (z.infer<typeof withdrawModeSchema> & { id: string })[]
  withdrawFields: (z.infer<typeof withdrawFieldSchema> & { id: string; label: string })[]
  kycVerified: boolean
  availableFund: number
  minimumDeposit: number
}

export function parseFundingConfiguration(input: unknown): PortalFundingConfiguration {
  const { data } = fundingConfigurationSchema.parse(input)
  if (data.depositMethods.length === 0) {
    throw new Error('Funding configuration has no deposit methods')
  }
  return {
    depositMethods: data.depositMethods.map((method) => {
      const name = method.displayName ?? method.name
      if (!name) throw new Error('Deposit method has no display name')
      return { ...method, id: String(method.id), name }
    }),
    withdrawModes: data.withdrawModes.map((method) => ({ ...method, id: String(method.id) })),
    withdrawFields: data.withdrawFields.map((field) => ({
      ...field,
      id: String(field.id),
      label: field.label ?? field.name,
    })),
    kycVerified: truthyFlag(data.kycVerified),
    availableFund: data.availableFund,
    minimumDeposit: Math.min(...data.depositMethods.map((method) => method.minimumAmount)),
  }
}

const notificationSchema = z.object({
  id: z.union([z.string(), z.number()]),
  type: z.string().min(1),
  title: z.string().min(1),
  desc: z.string(),
  createdAt: z.string().min(1),
})

const notificationsSchema = z.object({
  status: successSchema,
  data: z.object({
    items: z.array(notificationSchema),
    unreadCount: finiteNumber.refine(
      (value) => Number.isInteger(value) && value >= 0,
      'Expected unread count to be a non-negative integer',
    ),
  }),
})

function notificationKind(value: string): Notification['kind'] {
  switch (value.toLowerCase()) {
    case 'price':
      return 'price'
    case 'order':
    case 'trade':
      return 'order'
    case 'funds':
    case 'withdraw':
    case 'withdrawal':
    case 'deposit':
    case 'wallet':
    case 'payment':
      return 'funds'
    case 'news':
    case 'kyc':
    case 'referral':
    case 'account':
      return 'news'
    default:
      return 'news'
  }
}

export type ParsedNotifications = {
  items: Notification[]
  unreadCount: number
}

export function parseNotifications(input: unknown): ParsedNotifications {
  const { data } = notificationsSchema.parse(input)
  return {
    items: data.items.map((item) => ({
      id: String(item.id),
      kind: notificationKind(item.type),
      title: item.title,
      body: item.desc,
      time: item.createdAt,
    })),
    unreadCount: data.unreadCount,
  }
}
