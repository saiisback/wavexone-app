import { accounts, instruments, notifications } from '../../src/data/mock'
import { selectAccount, selectUnreadCount, useSession } from '../../src/data/store'

/**
 * The session store is what every list row subscribes to, so the property
 * that matters as much as the values is *identity*: a toggle must produce a
 * new Set (or React will not re-render the row) while leaving the previous
 * one alone (or a memoised row will render stale).
 */

const INITIAL = useSession.getState()

beforeEach(() => {
  useSession.setState(INITIAL, true)
})

describe('favorites', () => {
  it('starts empty until the backend favorite query resolves', () => {
    expect([...useSession.getState().favorites]).toEqual([])
  })

  it('adds an instrument that was not a favourite', () => {
    const id = instruments.find((item) => !item.favorite)!.id
    useSession.getState().toggleFavorite(id)
    expect(useSession.getState().favorites.has(id)).toBe(true)
  })

  it('removes one that was', () => {
    const id = instruments.find((item) => item.favorite)!.id
    useSession.getState().replaceFavorites([id])
    useSession.getState().toggleFavorite(id)
    expect(useSession.getState().favorites.has(id)).toBe(false)
  })

  it('returns to the starting state when toggled twice', () => {
    const id = instruments[0].id
    const before = useSession.getState().favorites.has(id)
    useSession.getState().toggleFavorite(id)
    useSession.getState().toggleFavorite(id)
    expect(useSession.getState().favorites.has(id)).toBe(before)
  })

  it('replaces the Set rather than mutating it, so subscribed rows re-render', () => {
    const before = useSession.getState().favorites
    useSession.getState().toggleFavorite(instruments[0].id)
    const after = useSession.getState().favorites

    expect(after).not.toBe(before)
    // The old Set must be untouched, or a memoised row comparing against it
    // would conclude nothing changed.
    expect(before.has(instruments[0].id)).toBe(false)
  })

  it('leaves other instruments alone', () => {
    const [first, second] = instruments
    const secondBefore = useSession.getState().favorites.has(second.id)
    useSession.getState().toggleFavorite(first.id)
    expect(useSession.getState().favorites.has(second.id)).toBe(secondBefore)
  })
})

describe('notifications', () => {
  it('starts with everything unread', () => {
    expect(selectUnreadCount(useSession.getState())).toBe(notifications.length)
  })

  it('drops the unread count by one when a single notification is read', () => {
    useSession.getState().markNotificationRead(notifications[0].id)
    expect(selectUnreadCount(useSession.getState())).toBe(notifications.length - 1)
  })

  it('does no work when the same notification is read twice', () => {
    // The guard returns the identical state object, which is what stops the
    // badge from re-rendering on every scroll past an already-read row.
    const store = useSession.getState()
    store.markNotificationRead(notifications[0].id)
    const after = useSession.getState().readNotifications
    store.markNotificationRead(notifications[0].id)

    expect(useSession.getState().readNotifications).toBe(after)
    expect(selectUnreadCount(useSession.getState())).toBe(notifications.length - 1)
  })

  it('clears the badge when everything is marked read', () => {
    useSession.getState().markAllNotificationsRead()
    expect(selectUnreadCount(useSession.getState())).toBe(0)
  })

  it('ignores an id that is not a notification', () => {
    useSession.getState().markNotificationRead('not-a-notification')
    expect(selectUnreadCount(useSession.getState())).toBe(notifications.length)
  })
})

describe('account selection', () => {
  it('starts on the first fixture account', () => {
    expect(selectAccount(useSession.getState()).id).toBe(accounts[0].id)
  })

  it('follows a selection', () => {
    useSession.getState().selectAccount(accounts[1].id)
    expect(selectAccount(useSession.getState()).id).toBe(accounts[1].id)
  })

  it('falls back to the first account rather than returning undefined', () => {
    // Every screen reads this unconditionally; returning undefined would
    // crash the header rather than degrade.
    useSession.setState({ accountId: 'deleted-account' })
    expect(selectAccount(useSession.getState())).toBe(accounts[0])
  })
})

describe('settings', () => {
  it('requires order confirmation by default (guide §6.8)', () => {
    expect(useSession.getState().settings.confirmOrders).toBe(true)
  })

  it('flips one setting without disturbing the others', () => {
    const before = { ...useSession.getState().settings }
    useSession.getState().toggleSetting('marketNews')

    const after = useSession.getState().settings
    expect(after.marketNews).toBe(!before.marketNews)
    expect(after.priceAlerts).toBe(before.priceAlerts)
    expect(after.confirmOrders).toBe(before.confirmOrders)
  })

  it('replaces the settings object so subscribers re-render', () => {
    const before = useSession.getState().settings
    useSession.getState().toggleSetting('priceAlerts')
    expect(useSession.getState().settings).not.toBe(before)
  })
})

describe('market period', () => {
  it('starts on the period the mockups show and follows a change', () => {
    expect(useSession.getState().marketPeriod).toBe('This month')
    useSession.getState().setMarketPeriod('Today')
    expect(useSession.getState().marketPeriod).toBe('Today')
  })
})
