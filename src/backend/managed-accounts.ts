import { z } from 'zod'

import { BackendError } from './errors'

export type ManagedKind = 'MAM' | 'PAMM'
export type ManagedView = 'Investor' | 'Manager'

export type ManagedPerson = {
  id: string
  name: string
  growth?: number
  drawdown?: number
  fund?: number
  followers?: number
  rank?: number
  risk?: number
  age?: number
  following?: boolean
}

export type ManagedDirectory = {
  managerEnabled: boolean
  managers: ManagedPerson[]
}

export type ManagedRelationship = { managerId: string; userId: string }
export type ManagedFollower = ManagedRelationship & {
  id: string
  kind: ManagedKind
  name: string
  share: number
  investment?: number
  sharedPnl?: number
}
export type ManagedReport =
  | {
      kind: 'MAM'
      rows: (ManagedRelationship & { id: string; orderId: string; userPnl: number; managerPnl: number; updatedAt: string })[]
      totals: { managerPnl: number }
    }
  | {
      kind: 'PAMM'
      rows: { id: string; orderId: string; managerPnl: number; userPnl: number; totalPnl: number }[]
      totals: { managerPnl: number; userPnl: number; totalPnl: number }
      share: number
    }

const finiteNumber = z.union([
  z.number(),
  z.string().trim().regex(/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/),
]).transform(Number).refine(Number.isFinite)
const count = finiteNumber.refine((value) => Number.isInteger(value) && value >= 0)
const flag = z.union([z.literal('0'), z.literal('1'), z.literal(0), z.literal(1)])
  .transform((value) => value === '1' || value === 1)
const identifier = z.union([z.string().trim().min(1), z.number().int().nonnegative()])
  .transform(String)
const managerSchema = z.object({
  user: identifier,
  name: z.string().trim().min(1),
  growth: finiteNumber.optional(),
  drawdown: finiteNumber.optional(),
  fund: finiteNumber.optional(),
  followers: count.optional(),
  rank: count.optional(),
  risklevel: count.optional(),
  age: count.optional(),
  follow: flag.optional(),
})
const envelopeSchema = z.object({
  status: z.literal('success'),
  data: z.object({
    user: z.string(),
    mamList: z.string().optional(),
    pamList: z.string().optional(),
  }),
})

/** Decode only the documented JSON-string lists; a broken response is not an empty list. */
export function parseManagedDirectory(input: unknown, kind: ManagedKind): ManagedDirectory {
  try {
    const { data } = envelopeSchema.parse(input)
    const capability = kind === 'MAM' ? 'mam' : 'pamm'
    const users = z.array(z.object({ [capability]: flag })).max(1).parse(JSON.parse(data.user))
    const encodedManagers = kind === 'MAM' ? data.mamList : data.pamList
    const managers = z.array(managerSchema).parse(JSON.parse(z.string().parse(encodedManagers)))

    return {
      managerEnabled: users[0]?.[capability] ?? false,
      managers: managers.map((manager) => ({
        id: manager.user,
        name: manager.name,
        ...(manager.growth === undefined ? {} : { growth: manager.growth }),
        ...(manager.drawdown === undefined ? {} : { drawdown: manager.drawdown }),
        ...(manager.fund === undefined ? {} : { fund: manager.fund }),
        ...(manager.followers === undefined ? {} : { followers: manager.followers }),
        ...(manager.rank === undefined ? {} : { rank: manager.rank }),
        ...(manager.risklevel === undefined ? {} : { risk: manager.risklevel }),
        ...(manager.age === undefined ? {} : { age: manager.age }),
        ...(manager.follow === undefined ? {} : { following: manager.follow }),
      })),
    }
  } catch {
    // Validation errors can contain raw user data; do not retain them as a cause.
    throw new BackendError('malformed', 'The managed account directory response was invalid.')
  }
}

export function parseManagedFollowing(input: unknown, kind: ManagedKind): ManagedDirectory {
  const directory = parseManagedDirectory(input, kind)
  return { ...directory, managers: directory.managers.filter((manager) => manager.following === true) }
}

const mamFollowerSchema = z.object({ name: z.string().trim().min(1), mam_share: finiteNumber, user_id: identifier, mam_id: identifier })
const pammFollowerSchema = z.object({ name: z.string().trim().min(1), investment: finiteNumber, shared_pnl: finiteNumber, pamm_share: finiteNumber, user_id: identifier, pamm_id: identifier })

export function parseManagedFollowers(input: unknown, kind: ManagedKind): ManagedFollower[] {
  try {
    const { data } = envelopeSchema.parse(input)
    const capability = kind === 'MAM' ? 'mam' : 'pamm'
    z.array(z.object({ [capability]: flag })).max(1).parse(JSON.parse(data.user))
    if (kind === 'MAM') {
      return z.array(mamFollowerSchema).parse(JSON.parse(z.string().parse(data.mamList))).map((row) => ({
        id: JSON.stringify([row.mam_id, row.user_id]), kind, name: row.name,
        managerId: row.mam_id, userId: row.user_id, share: row.mam_share,
      }))
    }
    return z.array(pammFollowerSchema).parse(JSON.parse(z.string().parse(data.pamList))).map((row) => ({
      id: JSON.stringify([row.pamm_id, row.user_id]), kind, name: row.name,
      managerId: row.pamm_id, userId: row.user_id, share: row.pamm_share,
      investment: row.investment, sharedPnl: row.shared_pnl,
    }))
  } catch {
    throw new BackendError('malformed', 'The managed account followers response was invalid.')
  }
}

const mamReportSchema = z.object({
  status: z.literal('success'), data: z.object({ mamShareValueList: z.string(), totalMamShare: finiteNumber }),
})
const mamReportRowSchema = z.object({
  order_pnl_log_id: identifier, order_id: identifier, user_pnl: finiteNumber, mam_user_pnl: finiteNumber,
  user_uid: identifier, mam_uid: identifier, updatedtime: z.string().trim().min(1),
})
const pammReportSchema = z.object({
  status: z.literal('success'), data: z.object({
    pammOrderReport: z.string(), pammSharePnl: finiteNumber, userSharePnl: finiteNumber,
    totalSharePnl: finiteNumber, pamm_share: finiteNumber,
  }),
})
const pammReportRowSchema = z.object({
  order_id: identifier, pamm_share_amount: finiteNumber, user_share_amount: finiteNumber, total_shared_pnl: finiteNumber,
})

export function parseManagedReport(input: unknown, kind: ManagedKind): ManagedReport {
  try {
    if (kind === 'MAM') {
      const { data } = mamReportSchema.parse(input)
      const rows = z.array(mamReportRowSchema).parse(JSON.parse(data.mamShareValueList))
      return {
        kind, totals: { managerPnl: data.totalMamShare },
        rows: rows.map((row) => ({ id: row.order_pnl_log_id, orderId: row.order_id,
          userPnl: row.user_pnl, managerPnl: row.mam_user_pnl, userId: row.user_uid,
          managerId: row.mam_uid, updatedAt: row.updatedtime })),
      }
    }
    const { data } = pammReportSchema.parse(input)
    const rows = z.array(pammReportRowSchema).parse(JSON.parse(data.pammOrderReport))
    return {
      kind, share: data.pamm_share,
      totals: { managerPnl: data.pammSharePnl, userPnl: data.userSharePnl, totalPnl: data.totalSharePnl },
      rows: rows.map((row) => ({ id: row.order_id, orderId: row.order_id,
        managerPnl: row.pamm_share_amount, userPnl: row.user_share_amount, totalPnl: row.total_shared_pnl })),
    }
  } catch {
    throw new BackendError('malformed', 'The managed account report response was invalid.')
  }
}
