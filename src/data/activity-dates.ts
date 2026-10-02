import type { MarketPeriod } from './store'
import type { ActivityEntry } from './types'

/**
 * Calendar helpers for Activity. Both APIs date their records with a
 * `YYYY-MM-DD` prefix (`2026-09-29 09:00:00`, `2026-09-29T09:00:00Z`) and say
 * nothing about time zone, so only the calendar day is read — as a local
 * date, which is what the user means by "today".
 */

const DAY = /^(\d{4})-(\d{2})-(\d{2})/

/** The local calendar day at the start of `value`, or undefined if it has none. */
export function calendarDate(value: string): Date | undefined {
  const match = DAY.exec(value)
  if (!match) return undefined
  const date = new Date(Number(match[1]), Number(match[2]) - 1, Number(match[3]))
  return Number.isNaN(date.getTime()) ? undefined : date
}

function startOfDay(value: Date): Date {
  return new Date(value.getFullYear(), value.getMonth(), value.getDate())
}

export function activityGroup(value: string, now: Date = new Date()): ActivityEntry['group'] {
  const day = calendarDate(value)
  if (!day) return 'Earlier'
  const today = startOfDay(now)
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1)
  if (day.getTime() === today.getTime()) return 'Today'
  if (day.getTime() === yesterday.getTime()) return 'Yesterday'
  return 'Earlier'
}

/**
 * Whether `value` falls in the Activity range filter. Weeks start on Monday.
 * An undated record is kept: hiding it would make it look like it never
 * happened.
 */
export function inPeriod(value: string, period: MarketPeriod, now: Date = new Date()): boolean {
  const day = calendarDate(value)
  if (!day) return true
  const today = startOfDay(now)
  switch (period) {
    case 'Today':
      return day.getTime() === today.getTime()
    case 'This week': {
      const sinceMonday = (today.getDay() + 6) % 7
      const monday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - sinceMonday)
      return day >= monday && day <= today
    }
    case 'This month':
      return day.getFullYear() === today.getFullYear() && day.getMonth() === today.getMonth()
    case 'This year':
      return day.getFullYear() === today.getFullYear()
  }
}
