import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Fragment } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  Avatar,
  BellIcon,
  Button,
  ButtonText,
  Card,
  ChevronDownIcon,
  Delta,
  DepositIcon,
  Divider,
  Gutter,
  Pressable,
  PressableScale,
  Screen,
  SwapIcon,
  TAB_BAR_CLEARANCE,
  Text,
  Watermark,
  WithdrawIcon,
  colors,
  fonts,
  radius,
  spacing,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '../data/format'
import { useSession } from '../data/store'
import type { DetailedAccount, FundingMode, Instrument, Position, Profile } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { MARKET_ROW_DIVIDER_INSET } from '../features/markets/market-group'
import { MarketRow } from '../features/markets/market-row'
import { useMarketData } from '../features/markets/use-market-data'
import { PositionRow } from '../features/positions/position-row'
import { QueryStateView, UnavailableState } from '../features/shared/query-state'
import { SectionHeader } from '../features/shared/section-header'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { HomeStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>

/** How many markets the watchlist shows before "See all". */
const WATCHLIST_SIZE = 5
/** How many open positions the summary shows before "See all". */
const POSITIONS_SIZE = 3

/**
 * Home tab, in the order a trader acts: what the account is worth, money in
 * and out, the markets they watch, then what they hold.
 */
export function HomeScreen() {
  const { navigate } = useNavigation<Navigation>()
  const accountData = useAccountData()

  if (accountData.status !== 'ready' || !accountData.data.account) {
    return (
      <Screen>
        <Gutter style={styles.state}>
          <QueryStateView
            state={accountData}
            render={(data) => <AccountSummaryUnavailable account={data.selectedAccount} />}
          />
        </Gutter>
      </Screen>
    )
  }

  const { account, profile } = accountData.data

  return <HomeDashboard account={account} profile={profile} onNotifications={() => navigate('Notifications')} />
}

function HomeDashboard({
  account,
  profile,
  onNotifications,
}: {
  account: DetailedAccount
  profile: Profile
  onNotifications: () => void
}) {
  const { openAccountSwitcher, openFunding, openHomeScreen, openInstrument, openTab } = useAppNavigation()
  const { catalogue } = useMarketData()
  const favorites = useSession((state) => state.favorites)

  const instruments = catalogue.status === 'ready' ? catalogue.data : []
  const pinned = instruments.filter((item) => favorites.has(item.id))
  // Favourites first; until there are any, the leading markets stand in.
  const watchlist = (pinned.length > 0 ? pinned : instruments).slice(0, WATCHLIST_SIZE)
  const watchIds = watchlist.map((item) => item.id)
  const sparks = useBackendQuery(
    `home-sparks:${account.id}:${watchIds.join(',') || 'none'}`,
    (backend) => watchIds.length > 0
      ? backend.markets.sparklines(watchIds, 'Today')
      : Promise.resolve(new Map<string, readonly number[]>()),
  )
  const sparkById = sparks.status === 'ready' ? sparks.data : undefined

  // Same key as the Positions tab, so both screens share one request.
  const positions = useBackendQuery(`positions:${account.id}`, (backend) => backend.orders.list(account.id))

  // Same key as the Notifications screen; a failed read just shows no dot.
  const notifications = useBackendQuery('notifications', (backend) => backend.engagement.notifications())
  const read = useSession((state) => state.readNotifications)
  const unread = notifications.status === 'ready'
    ? notifications.data.filter((item) => !read.has(item.id)).length
    : 0
  const pnlLabel = `${formatSignedMoney(account.floatingPnl)} (${formatPercent(account.changePercent)})`

  return (
    <Screen>
      <ScrollView
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <Gutter style={styles.greetingRow}>
          <View style={styles.greetingText}>
            <Text variant="caption" color={colors.textMuted}>
              Welcome back
            </Text>
            <Text variant="heading" numberOfLines={1}>
              {profile.holder.split(' ')[0]}
            </Text>
          </View>

          <View style={styles.greetingActions}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
              hitSlop={8}
              style={styles.notificationButton}
              onPress={onNotifications}
            >
              <BellIcon size={24} color={colors.text} />
              {unread > 0 ? <View style={styles.bellDot} /> : null}
            </Pressable>

            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Open account"
              onPress={() => openTab('More')}
            >
              <Avatar uri={profile.avatarUrl} size={40} />
            </Pressable>
          </View>
        </Gutter>

        <Gutter style={styles.top}>
          <View style={styles.portfolio}>
            <Watermark size={140} right={-22} bottom={-28} />
            <View style={styles.portfolioBand}>
              <Text variant="caption" weight="medium" color={colors.onInkMuted}>
                Portfolio
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Switch account, ${account.mode} ${account.number}`}
                onPress={openAccountSwitcher}
                hitSlop={6}
                style={styles.accountPill}
              >
                <Text style={styles.accountPillLabel}>
                  {account.mode} · {account.number}
                </Text>
                <ChevronDownIcon size={14} color={colors.onInk} />
              </Pressable>
            </View>

            <PressableScale
              accessibilityLabel={`Open balance. Total equity ${formatMoney(account.equity)}. Open P&L ${pnlLabel}.`}
              onPress={() => openHomeScreen('Balance')}
              scaleTo={0.985}
            >
              <View style={styles.portfolioBody}>
                <Text variant="display" color={colors.onInk} style={styles.equity}>
                  {formatMoney(account.equity)}
                </Text>
                <View style={styles.pnlRow}>
                  <Text variant="caption" color={colors.onInkMuted}>
                    Open P&amp;L
                  </Text>
                  <Delta label={pnlLabel} direction={trendOf(account.floatingPnl)} onInk size={14} />
                </View>
              </View>
            </PressableScale>
          </View>

          <QuickActions onFunding={openFunding} />
        </Gutter>

        <Gutter style={styles.section}>
          <SectionHeader
            title="Watchlist"
            action="See all"
            withChevron="right"
            onPressAction={() => openTab('Markets')}
          />
          {catalogue.status === 'ready' && watchlist.length === 0 ? (
            <UnavailableState
              title="Markets unavailable"
              message="No live markets are available for this account right now."
            />
          ) : catalogue.status !== 'ready' ? (
            <QueryStateView state={catalogue} render={() => null} />
          ) : (
            <>
              <Card padded={false}>
                {watchlist.map((item, index) => (
                  <Fragment key={item.id}>
                    {index > 0 ? <Divider inset={MARKET_ROW_DIVIDER_INSET} /> : null}
                    <MarketRow
                      layout="row"
                      id={item.id}
                      symbol={item.symbol}
                      name={item.name}
                      price={item.price}
                      precision={item.precision}
                      changePercent={item.changePercent}
                      changeBase={item.dayOpen}
                      iconKind={item.icon}
                      iconLabel={item.iconLabel}
                      iconTint={item.iconTint}
                      category={item.category}
                      spark={sparkById?.get(item.id) ?? item.spark}
                      sparkTone={sparkById?.has(item.id) ? undefined : item.sparkTone}
                      onPress={openInstrument}
                    />
                  </Fragment>
                ))}
              </Card>
              {pinned.length === 0 ? (
                <Text variant="caption" color={colors.textSubtle} style={styles.hint}>
                  Star a market on the Markets tab to pin it here.
                </Text>
              ) : null}
            </>
          )}
        </Gutter>

        <Gutter style={styles.section}>
          <SectionHeader
            title="Your positions"
            action="See all"
            withChevron="right"
            onPressAction={() => openTab('Positions')}
          />
          <QueryStateView
            state={positions}
            render={(list) => (
              <OpenPositions
                positions={list.filter((item) => item.state === 'Open')}
                instruments={instruments}
                onOpen={() => openTab('Positions')}
                onExplore={() => openTab('Markets')}
              />
            )}
          />
        </Gutter>
      </ScrollView>
    </Screen>
  )
}

const FUNDING_ACTIONS: readonly { mode: FundingMode; label: string; Icon: typeof DepositIcon }[] = [
  { mode: 'deposit', label: 'Deposit', Icon: DepositIcon },
  { mode: 'withdraw', label: 'Withdraw', Icon: WithdrawIcon },
  { mode: 'transfer', label: 'Transfer', Icon: SwapIcon },
]

/** Money in, out and between accounts — the same funding sheet as Balance. */
function QuickActions({ onFunding }: { onFunding: (mode: FundingMode) => void }) {
  return (
    <Card padded={false} style={styles.quickActions}>
      {FUNDING_ACTIONS.map(({ mode, label, Icon }) => (
        <PressableScale
          key={mode}
          accessibilityLabel={label}
          onPress={() => onFunding(mode)}
          scaleTo={0.94}
          style={styles.quickAction}
        >
          <View style={styles.quickActionInner}>
            <View style={styles.quickActionIcon}>
              <Icon size={20} color={colors.navy} />
            </View>
            <Text variant="caption" weight="medium" color={colors.text}>
              {label}
            </Text>
          </View>
        </PressableScale>
      ))}
    </Card>
  )
}

function OpenPositions({
  positions,
  instruments,
  onOpen,
  onExplore,
}: {
  positions: readonly Position[]
  instruments: readonly Instrument[]
  onOpen: () => void
  onExplore: () => void
}) {
  if (positions.length === 0) {
    return (
      <Card style={styles.emptyPositions}>
        <Text variant="strong">No open positions</Text>
        <Text variant="caption" color={colors.textMuted}>
          Your open trades and their live P&amp;L will appear here.
        </Text>
        <Button tone="track" onPress={onExplore} style={styles.emptyAction}>
          <ButtonText tone="track">Explore markets</ButtonText>
        </Button>
      </Card>
    )
  }

  const byId = new Map(instruments.map((item) => [item.id, item]))
  const hidden = positions.length - POSITIONS_SIZE
  return (
    <Card padded={false}>
      {positions.slice(0, POSITIONS_SIZE).map((position, index) => (
        <Fragment key={position.id}>
          {index > 0 ? <Divider inset={MARKET_ROW_DIVIDER_INSET} /> : null}
          <PositionRow position={position} instrument={byId.get(position.instrumentId)} onPress={onOpen} />
        </Fragment>
      ))}
      {hidden > 0 ? (
        <>
          <Divider />
          <Pressable accessibilityRole="button" onPress={onOpen} style={styles.morePositions}>
            <Text variant="caption" weight="medium" color={colors.textMuted}>
              {`${hidden} more open ${hidden === 1 ? 'position' : 'positions'}`}
            </Text>
          </Pressable>
        </>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  state: { paddingTop: 32 },
  content: {
    paddingTop: 8,
    paddingBottom: TAB_BAR_CLEARANCE,
    gap: spacing.xxl,
  },
  greetingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  greetingText: {
    flex: 1,
  },
  greetingActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  notificationButton: {
    minWidth: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bellDot: {
    position: 'absolute',
    top: 8,
    right: 9,
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: colors.gold,
  },

  top: {
    gap: spacing.md,
  },
  portfolio: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.ink,
    overflow: 'hidden',
  },
  portfolioBand: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingLeft: spacing.xl,
    paddingRight: spacing.md,
    paddingTop: spacing.sm,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: 10,
  },
  accountPillLabel: {
    fontFamily: fonts.semibold,
    color: colors.onInk,
    fontSize: 13,
    lineHeight: 17,
  },
  portfolioBody: {
    paddingHorizontal: spacing.xl,
    paddingBottom: spacing.xl,
    gap: spacing.sm,
  },
  equity: {
    fontVariant: ['tabular-nums'],
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },

  quickActions: {
    flexDirection: 'row',
    paddingVertical: spacing.md,
  },
  quickAction: {
    flex: 1,
  },
  quickActionInner: {
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.navySoft,
  },

  section: {
    gap: spacing.sm,
  },
  hint: {
    paddingHorizontal: spacing.xs,
    paddingTop: spacing.xs,
  },
  emptyPositions: {
    gap: spacing.xs,
  },
  emptyAction: {
    marginTop: spacing.md,
  },
  morePositions: {
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
