import { create } from 'zustand'
import type { Notification } from './types'

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
  localNotifications: readonly Notification[]
  marketPeriod: MarketPeriod
  settings: Readonly<Record<SettingKey, boolean>>

  selectAccount: (accountId: string) => void
  toggleFavorite: (instrumentId: string) => void
  replaceFavorites: (instrumentIds: readonly string[]) => void
  markNotificationRead: (id: string) => void
  markAllNotificationsRead: (ids: readonly string[]) => void
  replaceReadNotifications: (ids: readonly string[]) => void
  addLocalNotification: (notification: Notification) => void
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
  localNotifications: [],
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

  markAllNotificationsRead: (ids) => set((state) => ({ readNotifications: new Set([...state.readNotifications, ...ids]) })),
  replaceReadNotifications: (ids) => set({ readNotifications: new Set(ids) }),
  addLocalNotification: (notification) => set((state) => ({
    localNotifications: [notification, ...state.localNotifications.filter((item) => item.id !== notification.id)].slice(0, 100),
  })),

  setMarketPeriod: (period) => set({ marketPeriod: period }),

  toggleSetting: (key) =>
    set((state) => ({ settings: { ...state.settings, [key]: !state.settings[key] } })),
}))
