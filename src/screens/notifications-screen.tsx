import { FlashList } from '@shopify/flash-list'
import * as Crypto from 'expo-crypto'
import { StyleSheet, View } from 'react-native'

import {
  BellIcon,
  Card,
  DepositIcon,
  MarketsIcon,
  Pressable,
  SCREEN_PADDING,
  Screen,
  TAB_BAR_CLEARANCE,
  Text,
  TrendUpIcon,
  colors,
  radius,
} from '../design-system'
import { ScreenHeader } from '../features/shared/screen-header'
import { useBackend, useBackendQuery } from '../backend/provider'
import { useSession } from '../data/store'
import type { Notification } from '../data/types'
import { QueryStateView } from '../features/shared/query-state'

/** Reached from the bell on the dashboard. */
export function NotificationsScreen() {
  const read = useSession((state) => state.readNotifications)
  const markRead = useSession((state) => state.markNotificationRead)
  const markAllRead = useSession((state) => state.markAllNotificationsRead)
  const replaceRead = useSession((state) => state.replaceReadNotifications)
  const backend = useBackend()
  const notificationsState = useBackendQuery('notifications', (client) =>
    client.engagement.notifications(),
  )
  const notifications = notificationsState.status === 'ready' ? notificationsState.data : []

  const unread = notifications.length - read.size

  const reconcileRead = (ids: readonly string[]) => {
    const before = [...read]
    ids.forEach(markRead)
    void backend.engagement
      .markNotificationsRead({ ids, idempotencyKey: Crypto.randomUUID() })
      .catch(() => replaceRead(before))
  }

  const renderItem = ({ item }: { item: Notification }) => (
    <NotificationRow id={item.id} item={item} onPress={(id) => reconcileRead([id])} />
  )

  return (
    <Screen>
      <ScreenHeader
        title="Notifications"
        subtitle={unread > 0 ? `${unread} unread` : 'All caught up'}
        action={
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            disabled={unread === 0}
            onPress={() => {
              const ids = notifications.map((item) => item.id)
              markAllRead(ids)
              void backend.engagement
                .markNotificationsRead({ ids, idempotencyKey: Crypto.randomUUID() })
                .catch(() => replaceRead([...read]))
            }}
          >
            <Text variant="caption" color={unread === 0 ? colors.textSubtle : colors.text}>
              Mark all read
            </Text>
          </Pressable>
        }
      />

      <FlashList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<QueryStateView state={notificationsState} isEmpty={(items) => items.length === 0} emptyTitle="No notifications" render={() => null} />}
      />
    </Screen>
  )
}

/**
 * Reads its own unread flag from the store, so marking one notification read
 * re-renders that row alone rather than the list.
 */
function NotificationRow({
  id,
  item,
  onPress,
}: {
  id: string
  item: Notification
  onPress: (id: string) => void
}) {
  const isRead = useSession((state) => state.readNotifications.has(id))

  return (
    <Pressable accessibilityRole="button" onPress={() => onPress(id)}>
      <Card style={styles.card}>
        <View style={styles.icon}>
          <NotificationGlyph kind={item.kind} />
        </View>

        <View style={styles.body}>
          <Text variant="strong" style={styles.title}>
            {item.title}
          </Text>
          <Text variant="caption" color={colors.textMuted}>
            {item.body}
          </Text>
        </View>

        <View style={styles.meta}>
          <Text variant="caption" color={colors.textMuted}>
            {item.time}
          </Text>
          {isRead ? null : <View style={styles.dot} />}
        </View>
      </Card>
    </Pressable>
  )
}

function NotificationGlyph({ kind }: { kind: Notification['kind'] }) {
  switch (kind) {
    case 'price':
      return <TrendUpIcon size={22} color={colors.green} />
    case 'order':
      return <MarketsIcon size={22} color={colors.text} filled />
    case 'funds':
      return <DepositIcon size={22} color={colors.text} />
    default:
      return <BellIcon size={22} color={colors.text} />
  }
}

const keyExtractor = (item: Notification) => item.id
const Separator = () => <View style={styles.separator} />

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  separator: {
    height: 10,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    padding: 14,
    borderRadius: radius.card,
  },
  icon: {
    width: 26,
    paddingTop: 2,
    alignItems: 'center',
  },
  body: {
    flex: 1,
    gap: 4,
  },
  title: {
    fontSize: 16,
  },
  meta: {
    alignItems: 'flex-end',
    gap: 8,
  },
  dot: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },
})
