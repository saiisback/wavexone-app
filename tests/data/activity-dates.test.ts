import { activityGroup, calendarDate, inPeriod } from '../../src/data/activity-dates'

/** Wednesday 1 October 2026, mid-morning local time. */
const NOW = new Date(2026, 9, 1, 10, 30)

describe('calendarDate', () => {
  it('reads the day from both API timestamp shapes', () => {
    expect(calendarDate('2026-09-29 09:00:00')).toEqual(new Date(2026, 8, 29))
    expect(calendarDate('2026-09-29T23:59:00Z')).toEqual(new Date(2026, 8, 29))
  })

  it('returns undefined for anything without a leading date', () => {
    expect(calendarDate('')).toBeUndefined()
    expect(calendarDate('Dec 19, 2022')).toBeUndefined()
  })
})

describe('activityGroup', () => {
  it('groups by local calendar day', () => {
    expect(activityGroup('2026-10-01 00:01:00', NOW)).toBe('Today')
    expect(activityGroup('2026-09-30 23:59:00', NOW)).toBe('Yesterday')
    expect(activityGroup('2026-09-29', NOW)).toBe('Earlier')
  })

  it('handles yesterday across a month boundary', () => {
    expect(activityGroup('2026-09-30', new Date(2026, 9, 1))).toBe('Yesterday')
  })

  it('puts an undated record under Earlier', () => {
    expect(activityGroup('', NOW)).toBe('Earlier')
  })
})

describe('inPeriod', () => {
  it('filters today, this week (from Monday), this month and this year', () => {
    expect(inPeriod('2026-10-01', 'Today', NOW)).toBe(true)
    expect(inPeriod('2026-09-30', 'Today', NOW)).toBe(false)

    // Monday 28 September starts the week containing 1 October.
    expect(inPeriod('2026-09-28', 'This week', NOW)).toBe(true)
    expect(inPeriod('2026-09-27', 'This week', NOW)).toBe(false)

    expect(inPeriod('2026-10-01', 'This month', NOW)).toBe(true)
    expect(inPeriod('2026-09-30', 'This month', NOW)).toBe(false)

    expect(inPeriod('2026-01-01', 'This year', NOW)).toBe(true)
    expect(inPeriod('2025-12-31', 'This year', NOW)).toBe(false)
  })

  it('keeps an undated record rather than hiding it', () => {
    expect(inPeriod('', 'Today', NOW)).toBe(true)
    expect(inPeriod('Dec 19, 2022', 'Today', NOW)).toBe(true)
  })
})
