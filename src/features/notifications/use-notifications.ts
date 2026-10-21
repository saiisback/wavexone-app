import { useRef } from 'react'
import * as Crypto from 'expo-crypto'

import { useBackend, useBackendQuery, useInvalidateQueries } from '../../backend/provider'
import { useSession } from '../../data/store'
import { useActionMenu } from '../../design-system'

/** One inbox and unread calculation for the dashboard bell and the inbox. */
export function useNotifications() {
  const backend = useBackend()
  const invalidate = useInvalidateQueries()
  const showMenu = useActionMenu()
  const local = useSession((state) => state.localNotifications)
  const read = useSession((state) => state.readNotifications)
  const pending = useRef(new Set<string>())
  const state = useBackendQuery('notifications', (client) => client.engagement.notifications())
  const remote = state.status === 'ready' ? state.data : []
  const localIds = new Set(local.map((item) => item.id))
  const items = [...local, ...remote.filter((item) => !localIds.has(item.id))]
  const unread = items.filter((item) => !read.has(item.id)).length

  const markRead = (ids: readonly string[]) => {
    const unreadIds = ids.filter((id) => !read.has(id) && !pending.current.has(id))
    const localRead = unreadIds.filter((id) => localIds.has(id))
    const remoteRead = unreadIds.filter((id) => !localIds.has(id))
    useSession.getState().markAllNotificationsRead(localRead)
    if (remoteRead.length === 0) return
    remoteRead.forEach((id) => pending.current.add(id))
    void backend.engagement.markNotificationsRead({ ids: remoteRead, idempotencyKey: Crypto.randomUUID() })
      .then(() => {
        useSession.getState().markAllNotificationsRead(remoteRead)
        invalidate('notifications')
      })
      .catch(() => showMenu({
        title: 'Could not mark notifications read',
        message: 'Your notifications are still unread. Please try again when your connection is available.',
        options: [{ label: 'Got it' }],
      }))
      .finally(() => remoteRead.forEach((id) => pending.current.delete(id)))
  }

  return { state, items, unread, markRead }
}
