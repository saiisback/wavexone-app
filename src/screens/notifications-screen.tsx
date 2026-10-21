import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { FlashList } from '@shopify/flash-list'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  BackButton,
  BellIcon,
  CheckIcon,
  DepositIcon,
  IconChip,
  HomeAtmosphere,
  MarketsIcon,
  PageBar,
  PageTitle,
  PopIn,
  Pressable,
  PressableScale,
  Reveal,
  SCREEN_PADDING,
  TAB_BAR_CLEARANCE,
  Text,
  TrendUpIcon,
  radius,
  shadow,
  spacing,
  useHeroScroll,
} from '../design-system'
import { useNotifications } from '../features/notifications/use-notifications'
import { useSession } from '../data/store'
import type { Notification } from '../data/types'
import { QueryStateView } from '../features/shared/query-state'

/** Rows that stagger in on first mount; the rest appear at rest. */
const REVEAL_ROWS = 8

/** Reached from the bell on the dashboard. */
export function NotificationsScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const { state: notificationsState, items: notifications, unread, markRead } = useNotifications()
  const { scrollY, onScrollJS } = useHeroScroll()
  const insets = useSafeAreaInsets()

  const renderItem = ({ item, index }: { item: Notification; index: number }) => {
    const row = <NotificationRow id={item.id} item={item} onPress={(id) => markRead([id])} />
    return (
      <View style={styles.cell}>
        {index < REVEAL_ROWS ? <Reveal index={index + 1} distance={12}>{row}</Reveal> : row}
      </View>
    )
  }

  const markAll = () => {
    markRead(notifications.map((item) => item.id))
  }

  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <HomeAtmosphere />
      <PageTitle
        scrollY={scrollY}
        title="Notifications"
        tone="reference"
        leading={<BackButton tone="reference" />}
        subtitle={
          notificationsState.status !== 'ready' && notifications.length === 0
            ? undefined
            : unread > 0 ? `${unread} unread` : 'All caught up'
        }
        trailing={
          <Pressable
            accessibilityRole="button"
            hitSlop={8}
            disabled={unread === 0}
            onPress={markAll}
            style={({ pressed }) => [styles.markAll, unread === 0 ? styles.markAllIdle : null, pressed ? styles.pressed : null]}
          >
            <CheckIcon size={14} color={unread === 0 ? colors.referenceMuted : colors.brand} />
            <Text variant="caption" weight="semibold" color={unread === 0 ? colors.referenceMuted : colors.brand}>
              Mark all read
            </Text>
          </Pressable>
        }
      />
      <View style={styles.contentCap} />
      {notifications.length > 0 && notificationsState.status === 'error' ? (
        <View style={styles.cell}>
          <Text variant="caption" color={colors.textMuted}>Earlier notifications could not be loaded.</Text>
          <Pressable accessibilityRole="button" onPress={notificationsState.retry} hitSlop={8}>
            <Text variant="caption" weight="semibold" color={colors.brand}>Try again</Text>
          </Pressable>
        </View>
      ) : null}
    </View>
  )

  return (
    <View style={styles.root}>
      <FlashList
        data={notifications}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        onScroll={onScrollJS}
        scrollEventThrottle={16}
        ListHeaderComponent={header}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={<View style={styles.cell}><QueryStateView state={notificationsState} isEmpty={(items) => items.length === 0} emptyTitle="No notifications" render={() => null} /></View>}
        ListFooterComponent={<View style={styles.footerSurface} />}
      />
      <PageBar scrollY={scrollY} title="Notifications" tone="reference" />
    </View>
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
  const colors = useColors()
  const KIND_STYLE = useThemeStyles(themeKIND_STYLE)
  const styles = useThemeStyles(themeStyles)

  const isRead = useSession((state) => state.readNotifications.has(id))

  const { Icon, tone, ink } = KIND_STYLE[item.kind] ?? KIND_STYLE.news

  return (
    <PressableScale
      onPress={() => onPress(id)}
      scaleTo={0.98}
      accessibilityLabel={`${item.title}. ${item.body}. ${item.time}${isRead ? '' : '. Unread'}`}
    >
      <View style={[styles.card, isRead ? styles.cardRead : null]}>
        <IconChip tone={tone} size={44} shape="square">
          <Icon size={20} color={ink} />
        </IconChip>

        <View style={styles.body}>
          <View style={styles.titleRow}>
            <Text variant="strong" weight={isRead ? 'medium' : 'semibold'} style={styles.title} numberOfLines={2}>
              {item.title}
            </Text>
            <Text variant="micro" color={colors.textSubtle} style={styles.time}>
              {item.time}
            </Text>
          </View>
          <Text variant="caption" color={colors.textMuted}>
            {item.body}
          </Text>
        </View>

        {isRead ? null : (
          <PopIn delay={300} style={styles.dotWrap}>
            <View style={styles.dot} />
          </PopIn>
        )}
      </View>
    </PressableScale>
  )
}

const themeKIND_STYLE = (colors: Palette): Record<
  Notification['kind'],
  { Icon: typeof BellIcon; tone: 'blue' | 'violet' | 'amber' | 'mint'; ink: string }
> => ({
  price: { Icon: TrendUpIcon, tone: 'mint', ink: colors.tintMintInk },
  order: { Icon: OrderGlyph, tone: 'blue', ink: colors.tintBlueInk },
  funds: { Icon: DepositIcon, tone: 'violet', ink: colors.tintVioletInk },
  news: { Icon: BellIcon, tone: 'amber', ink: colors.tintAmberInk },
})

/** The filled market glyph, matching the other icons' signature. */
function OrderGlyph(props: { size?: number; color?: string }) {
  return <MarketsIcon {...props} filled />
}

const keyExtractor = (item: Notification) => item.id
const Separator = () => { const styles = useThemeStyles(themeStyles); return <View style={styles.separator} /> }

const themeStyles = (colors: Palette) => (StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    position: 'relative',
    overflow: 'hidden',
  },
  list: {
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  cell: {
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.surface,
  },
  contentCap: {
    height: spacing.xl,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  markAll: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    height: 34,
    paddingHorizontal: 12,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  markAllIdle: {
    backgroundColor: colors.glassOnInk,
  },
  pressed: {
    opacity: 0.75,
  },
  separator: {
    height: 10,
    backgroundColor: colors.surface,
  },
  footerSurface: {
    minHeight: TAB_BAR_CLEARANCE,
    backgroundColor: colors.surface,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.glass,
    boxShadow: shadow.card,
  },
  cardRead: {
    boxShadow: 'none',
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
  },
  body: {
    flex: 1,
    gap: 3,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  title: {
    flex: 1,
    fontSize: 15,
  },
  time: {
    paddingTop: 2,
  },
  dotWrap: {
    position: 'absolute',
    top: spacing.lg - 3,
    left: spacing.lg + 44 - 7,
  },
  dot: {
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: colors.royal,
    borderWidth: 2,
    borderColor: colors.surface,
  },
}))
