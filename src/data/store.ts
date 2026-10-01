import { create } from 'zustand'

import { accounts, notifications } from './mock'

/**
 * Client-side session state.
 *
 * Deliberately a store rather than context: list rows subscribe with a
 * selector, so toggling one favourite re-renders one row instead of the whole
 * list. Nothing here is persisted — it is the UI's own state, not the
 * server's.
 */

export type MarketPeriod = 'Today' | 'This week' | 'This month' | 'This year'

type SessionState = {
  accountId: string | null
  favorites: ReadonlySet<string>
  readNotifications: ReadonlySet<string>
  marketPeriod: MarketPeriod
  settings: Readonly<Record<SettingKey, boolean>>

  selectAccount: (accountId: string) => void
  toggleFavorite: (instrumentId: string) => void
  replaceFavorites: (instrumentIds: readonly string[]) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (ids?: readonly string[]) => void
  replaceReadNotifications: (ids: readonly string[]) => void
  setMarketPeriod: (period: MarketPeriod) => void
  toggleSetting: (key: SettingKey) => void
}

export type SettingKey =
  | 'priceAlerts'
  | 'orderFills'
  | 'marketNews'
  | 'biometricUnlock'
  | 'confirmOrders'

export const useSession = create<SessionState>((set) => ({
  accountId: null,
  favorites: new Set<string>(),
  readNotifications: new Set<string>(),
  marketPeriod: 'This month',
  settings: {
    priceAlerts: true,
    orderFills: true,
    marketNews: false,
    biometricUnlock: true,
    // Required before any order reaches the trading API — see the
    // integration guide §6.8. Not user-disableable in this build.
    confirmOrders: true,
  },

  selectAccount: (accountId) => set({ accountId }),

  toggleFavorite: (instrumentId) =>
    set((state) => {
      const next = new Set(state.favorites)
      if (next.has(instrumentId)) next.delete(instrumentId)
      else next.add(instrumentId)
      return { favorites: next }
    }),
  replaceFavorites: (instrumentIds) => set({ favorites: new Set(instrumentIds) }),

  markNotificationRead: (id) =>
    set((state) => {
      if (state.readNotifications.has(id)) return state
      return { readNotifications: new Set(state.readNotifications).add(id) }
    }),

  markAllNotificationsRead: (ids) =>
    set({ readNotifications: new Set(ids ?? notifications.map((item) => item.id)) }),
  replaceReadNotifications: (ids) => set({ readNotifications: new Set(ids) }),

  setMarketPeriod: (period) => set({ marketPeriod: period }),

  toggleSetting: (key) =>
    set((state) => ({ settings: { ...state.settings, [key]: !state.settings[key] } })),
}))

/** Unread badge on the dashboard bell. */
export const selectUnreadCount = (state: SessionState) =>
  notifications.reduce((total, item) => total + (state.readNotifications.has(item.id) ? 0 : 1), 0)

/** The account currently being traded. */
export const selectAccount = (state: SessionState) =>
  accounts.find((item) => item.id === state.accountId) ?? accounts[0]
