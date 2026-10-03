import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { Fragment } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  Amount,
  Avatar,
  BellIcon,
  BoltIcon,
  Card,
  ChevronRightIcon,
  CircleButton,
  DepositIcon,
  Divider,
  EmptyState,
  Delta,
  Gutter,
  Logo,
  HeroScreen,
  IconChip,
  InfoIcon,
  LiquidGlass,
  PillLink,
  PopIn,
  PositionsIcon,
  Pressable,
  PressableScale,
  ProgressBar,
  Reveal,
  SCREEN_PADDING,
  Screen,
  SparkleIcon,
  Sparkline,
  SwapIcon,
  Text,
  TrendUpIcon,
  WalletIcon,
  WithdrawIcon,
  colors,
  radius,
  shadow,
  spacing,
  useCountUp,
  WalletCard,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '../data/format'
import { useSession } from '../data/store'
import type { DetailedAccount, FundingMode, Instrument, Position, Profile } from '../data/types'
import { AccountPill } from '../features/accounts/account-pill'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useAccountData } from '../features/accounts/use-account-data'
import { MoverCard } from '../features/markets/mover-card'
import { useMarketData } from '../features/markets/use-market-data'
import { POSITION_ROW_DIVIDER_INSET, PositionRow } from '../features/positions/position-row'
import { QueryStateView, UnavailableState } from '../features/shared/query-state'
import { SectionHeader } from '../features/shared/section-header'
import { useAppNavigation } from '../navigation/use-app-navigation'
import type { HomeStackParamList } from '../navigation/types'

type Navigation = NativeStackNavigationProp<HomeStackParamList, 'Dashboard'>

/** How many markets the watchlist shows before "See all". */
const WATCHLIST_SIZE = 6
/** How many open positions the summary shows before "See all". */
const POSITIONS_SIZE = 3
/** How many recent closed trades the hero's realised P&L line covers. */
const TREND_TRADES = 30

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

  // Same keys as the Positions tab, so both screens share one request each.
  const positions = useBackendQuery(`positions:${account.id}`, (backend) => backend.orders.list(account.id))
  const history = useBackendQuery(`history:${account.id}`, (backend) => backend.orders.history(account.id))
  const trend = history.status === 'ready' ? realisedTrend(history.data) : null

  // Same key as the Notifications screen; a failed read just shows no dot.
  const notifications = useBackendQuery('notifications', (backend) => backend.engagement.notifications())
  const read = useSession((state) => state.readNotifications)
  const unread = notifications.status === 'ready'
    ? notifications.data.filter((item) => !read.has(item.id)).length
    : 0
  const pnlLabel = `${formatSignedMoney(account.floatingPnl)} (${formatPercent(account.changePercent)})`

  return (
    <HeroScreen
      compact={{ title: 'Total equity', value: formatMoney(account.equity) }}
      bar={
        <>
          <Pressable accessibilityRole="button" accessibilityLabel="Open account" onPress={() => openTab('More')}>
            <LiquidGlass style={styles.avatarRing}>
              <Avatar uri={profile.avatarUrl} size={42} />
            </LiquidGlass>
          </Pressable>
          <AccountPill mode={account.mode} number={account.number} onPress={openAccountSwitcher} />
          <View>
            <CircleButton
              tone="glass"
              size={44}
              onPress={onNotifications}
              accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              <BellIcon size={20} color={colors.text} />
            </CircleButton>
            {unread > 0 ? (
              <PopIn delay={700} style={styles.bellDot}>
                <View style={styles.bellDotFill} />
              </PopIn>
            ) : null}
          </View>
        </>
      }
      hero={
        <>
          <PressableScale
            accessibilityLabel={`Open balance. Total equity ${formatMoney(account.equity)}. Open P&L ${pnlLabel}.`}
            onPress={() => openHomeScreen('Balance')}
            scaleTo={0.98}
          >
            <View style={styles.figure}>
              <Text variant="caption" color={colors.textMuted} style={styles.figureLabel}>
                {`Hi ${profile.holder.split(' ')[0]}`}
              </Text>
              <WalletCard>
                <View style={styles.cardTop}>
                  <Logo size={17} />
                  <Text variant="micro" color={colors.textMuted}>
                    {`${account.mode} · ${account.number}`}
                  </Text>
                </View>
                <View style={styles.cardBottom}>
                  <Text variant="caption" color={colors.textMuted}>
                    Total equity
                  </Text>
                  <EquityFigure value={account.equity} />
                  <View style={styles.cardPnl}>
                    <Delta label={pnlLabel} direction={trendOf(account.floatingPnl)} size={13} />
                    <Text variant="caption" color={colors.textMuted}>
                      open P&amp;L
                    </Text>
                  </View>
                </View>
              </WalletCard>
            </View>
          </PressableScale>

          <View style={styles.actions}>
            {FUNDING_ACTIONS.map(({ mode, label, Icon }, index) => (
              <Reveal key={mode} index={index + 2} distance={10} style={styles.action}>
                <HeroAction label={label} primary={mode === 'deposit'} onPress={() => openFunding(mode)}>
                  <Icon size={21} color={mode === 'deposit' ? colors.white : colors.text} />
                </HeroAction>
              </Reveal>
            ))}
          </View>
        </>
      }
    >
      <Reveal index={1}>
        <Gutter style={styles.section}>
          <View style={styles.sectionRow}>
            <View style={styles.sectionTitle}>
              <Text variant="section">Your money</Text>
              <InfoIcon size={16} color={colors.textSubtle} />
            </View>
            <PillLink label="Details" onPress={() => openHomeScreen('Balance')} />
          </View>
          <View style={styles.tiles}>
            <StatTile label="Balance" value={account.balance} Icon={WalletIcon} tone="blue" ink={colors.tintBlueInk} />
            <StatTile label="Free margin" value={account.freeMargin} Icon={BoltIcon} tone="amber" ink={colors.tintAmberInk} />
          </View>
          <MarginInsight equity={account.equity} freeMargin={account.freeMargin} onPress={() => openTab('Positions')} />
        </Gutter>
      </Reveal>

      {trend ? (
        <Reveal index={2}>
          <Gutter>
            <RealisedTrend {...trend} />
          </Gutter>
        </Reveal>
      ) : null}

      <Reveal index={3} style={styles.section}>
        <Gutter>
          <SectionHeader
            title="Watchlist"
            action="See all"
            withChevron="right"
            onPressAction={() => openTab('Markets')}
          />
        </Gutter>
        {catalogue.status === 'ready' && watchlist.length === 0 ? (
          <Gutter>
            <UnavailableState
              title="Markets unavailable"
              message="No live markets are available for this account right now."
            />
          </Gutter>
        ) : catalogue.status !== 'ready' ? (
          <Gutter>
            <QueryStateView state={catalogue} render={() => null} />
          </Gutter>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.watchStrip}>
              {watchlist.map((item, index) => (
                <Reveal key={item.id} index={index + 3} distance={12}>
                  <MoverCard
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
                    onPress={openInstrument}
                  />
                </Reveal>
              ))}
            </ScrollView>
            {pinned.length === 0 ? (
              <Gutter>
                <Text variant="caption" color={colors.textSubtle} style={styles.hint}>
                  Star a market on the Markets tab to pin it here.
                </Text>
              </Gutter>
            ) : null}
          </>
        )}
      </Reveal>

      <Reveal index={4}>
        <Gutter style={styles.section}>
          <SectionHeader
            title="Open positions"
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
      </Reveal>
    </HeroScreen>
  )
}

/** The hero figure, rolling up to the account's equity and gliding with it. */
function EquityFigure({ value }: { value: number }) {
  const shown = useCountUp(value)
  return (
    <Amount
      variant="hero"
      color={colors.text}
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLabel={formatMoney(value)}
    >
      {formatMoney(shown)}
    </Amount>
  )
}

const FUNDING_ACTIONS: readonly { mode: FundingMode; label: string; Icon: typeof DepositIcon }[] = [
  { mode: 'deposit', label: 'Deposit', Icon: DepositIcon },
  { mode: 'withdraw', label: 'Withdraw', Icon: WithdrawIcon },
  { mode: 'transfer', label: 'Transfer', Icon: SwapIcon },
]

/**
 * Money in, out and between accounts: a Liquid Glass disc over a label.
 * Deposit is the blue-tinted glass; the others are clear.
 */
function HeroAction({
  label,
  primary,
  onPress,
  children,
}: {
  label: string
  primary: boolean
  onPress: () => void
  children: React.ReactNode
}) {
  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} scaleTo={0.92}>
      <View style={styles.actionInner}>
        <LiquidGlass tint={primary ? 'accent' : 'clear'} style={styles.actionDisc}>{children}</LiquidGlass>
        <Text variant="caption" weight="medium" color={colors.text}>
          {label}
        </Text>
      </View>
    </PressableScale>
  )
}

/** A secondary account figure on a white tile, its icon on a soft tint. */
function StatTile({
  label,
  value,
  Icon,
  tone,
  ink,
}: {
  label: string
  value: number
  Icon: typeof WalletIcon
  tone: 'blue' | 'amber'
  ink: string
}) {
  const shown = useCountUp(value)
  return (
    <Card style={styles.tile}>
      <IconChip size={42} tone={tone}>
        <Icon size={20} color={ink} />
      </IconChip>
      <View style={styles.tileText}>
        <Text variant="caption" color={colors.textMuted}>
          {label}
        </Text>
        <Amount
          variant="displaySm"
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`${label} ${formatMoney(value)}`}
        >
          {formatMoney(shown)}
        </Amount>
      </View>
    </Card>
  )
}

/**
 * How much of the account's equity is tied up as margin — equity less free
 * margin — on an inverted near-black bar, so the one number that can go
 * wrong stands apart from the white cards around it.
 */
function MarginInsight({ equity, freeMargin, onPress }: { equity: number; freeMargin: number; onPress: () => void }) {
  if (equity <= 0) return null
  const used = Math.max(equity - freeMargin, 0)
  const share = used / equity
  const percent = formatPercent(share * 100).replace('+', '')
  return (
    <PressableScale onPress={onPress} scaleTo={0.98} accessibilityLabel={`Margin in use ${percent}. Open positions`}>
      <View style={styles.insight}>
        <View style={styles.insightRow}>
          <SparkleIcon size={20} color={colors.ice} />
          <View style={styles.insightText}>
            <Text variant="strong" color={colors.onInk}>
              {`Margin in use · ${percent}`}
            </Text>
            <Text variant="caption" color={colors.onInkMuted} numberOfLines={1}>
              {`${formatMoney(used)} of ${formatMoney(equity)}`}
            </Text>
          </View>
          <View style={styles.insightLink}>
            <Text variant="caption" weight="medium" color={colors.onInkMuted}>
              Positions
            </Text>
            <ChevronRightIcon size={14} color={colors.onInkMuted} />
          </View>
        </View>
        <ProgressBar value={share} tone="ice" track="onInk" height={4} />
      </View>
    </PressableScale>
  )
}

/**
 * Cumulative realised P&L across the most recent closed trades, oldest
 * first. `null` until there are enough trades to draw a line.
 */
function realisedTrend(history: readonly Position[]) {
  const closed = history
    .filter((item) => item.state === 'Closed')
    .sort((left, right) => (left.time ?? '').localeCompare(right.time ?? ''))
    .slice(-TREND_TRADES)
  if (closed.length < 2) return null
  const points = [0]
  for (const trade of closed) points.push(points[points.length - 1] + trade.pnl)
  return { points, trades: closed.length, total: points[points.length - 1] }
}

/** Realised P&L across recent trades, as a soft area chart on a white card. */
function RealisedTrend({ points, trades, total }: { points: number[]; trades: number; total: number }) {
  const negative = total < 0
  return (
    <Card padded={false} style={styles.trendCard}>
      <View style={styles.trendHead}>
        <View style={styles.trendTitle}>
          <Text variant="caption" color={colors.textMuted}>
            {`Realised P&L · last ${trades} trades`}
          </Text>
          <Text variant="displaySm" color={negative ? colors.red : colors.text}>
            {formatSignedMoney(total)}
          </Text>
        </View>
        <View style={[styles.trendBadge, negative ? styles.trendBadgeDown : null]}>
          <TrendUpIcon size={16} color={negative ? colors.red : colors.green} />
        </View>
      </View>
      <Sparkline
        points={points}
        width="fill"
        height={72}
        color={negative ? colors.red : colors.green}
        fillOpacity={0.18}
        showEndpoint
      />
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
      <Card padded={false}>
        <EmptyState
          icon={<PositionsIcon size={24} color={colors.navy} />}
          title="No open positions"
          message="Your open trades and their live P&L will appear here."
          action="Explore markets"
          onAction={onExplore}
        />
      </Card>
    )
  }

  const byId = new Map(instruments.map((item) => [item.id, item]))
  const hidden = positions.length - POSITIONS_SIZE
  return (
    <Card padded={false}>
      {positions.slice(0, POSITIONS_SIZE).map((position, index) => (
        <Fragment key={position.id}>
          {index > 0 ? <Divider inset={POSITION_ROW_DIVIDER_INSET} /> : null}
          <PositionRow position={position} instrument={byId.get(position.instrumentId)} onPress={onOpen} />
        </Fragment>
      ))}
      {hidden > 0 ? (
        <>
          <Divider />
          <Pressable accessibilityRole="button" onPress={onOpen} style={styles.morePositions}>
            <Text variant="caption" weight="semibold" color={colors.navy}>
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

  avatarRing: {
    padding: 2,
    borderRadius: 24,
  },
  bellDot: {
    position: 'absolute',
    top: 9,
    right: 10,
  },
  bellDotFill: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: '#FF8A7A',
    borderWidth: 1.5,
    borderColor: colors.ink,
  },
  figure: {
    gap: spacing.sm,
    paddingTop: spacing.sm,
  },
  cardTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardBottom: {
    gap: 2,
  },
  cardPnl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  figureLabel: {
    fontSize: 15,
    paddingHorizontal: 2,
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.xxl,
    paddingTop: spacing.lg,
  },
  action: {
    alignItems: 'center',
  },
  actionInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  actionDisc: {
    width: 58,
    height: 58,
    borderRadius: 29,
    alignItems: 'center',
    justifyContent: 'center',
  },

  section: {
    gap: spacing.md,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  sectionTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tiles: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tile: {
    flex: 1,
    padding: spacing.lg,
    gap: spacing.xl,
  },
  tileText: {
    gap: 2,
  },
  insight: {
    padding: spacing.lg,
    paddingBottom: spacing.lg - 2,
    gap: spacing.md,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.night,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.12)',
    boxShadow: shadow.hero,
  },
  insightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  insightText: {
    flex: 1,
    gap: 1,
  },
  insightLink: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  trendCard: {
    paddingTop: spacing.lg,
    gap: spacing.sm,
  },
  trendHead: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  trendTitle: {
    gap: 2,
  },
  trendBadge: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.greenSoft,
  },
  trendBadgeDown: {
    backgroundColor: colors.redSoft,
  },
  watchStrip: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  hint: {
    paddingHorizontal: spacing.xs,
  },
  morePositions: {
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
