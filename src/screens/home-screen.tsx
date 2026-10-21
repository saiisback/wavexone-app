import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { useNavigation } from '@react-navigation/native'
import type { NativeStackNavigationProp } from '@react-navigation/native-stack'
import { StatusBar } from 'expo-status-bar'
import { Fragment } from 'react'
import { useNotifications } from '../features/notifications/use-notifications'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  Amount,
  Avatar,
  BellIcon,
  BoltIcon,
  CandlesIcon,
  Card,
  ChevronRightIcon,
  CircleButton,
  ClockIcon,
  DepositIcon,
  Divider,
  EmptyState,
  Delta,
  Gutter,
  HomeAtmosphere,
  Logo,
  IconChip,
  MarketsIcon,
  MoreIcon,
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
  Text,
  TrendUpIcon,
  WalletIcon,
  WithdrawIcon,
  radius,
  shadow,
  spacing,
  useCountUp,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { formatMoney, formatPercent, formatSignedMoney, trendOf } from '../data/format'
import { applySparkSnapshot } from '../data/live-quote'
import { useSession } from '../data/store'
import type { DetailedAccount, Instrument, Position, Profile } from '../data/types'
import { AccountPill } from '../features/accounts/account-pill'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useAccountData } from '../features/accounts/use-account-data'
import { MoverCard } from '../features/markets/mover-card'
import { MarketPulse } from '../features/markets/market-pulse'
import { useMarketData } from '../features/markets/use-market-data'
import { POSITION_ROW_DIVIDER_INSET, PositionRow } from '../features/positions/position-row'
import { QueryStateView, UnavailableState } from '../features/shared/query-state'
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
  const styles = useThemeStyles(themeStyles)

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

  return <HomeDashboard account={account} profile={profile} feedback={<QueryStateView state={accountData} render={() => null} />} onNotifications={() => navigate('Notifications')} />
}

function HomeDashboard({
  account,
  profile,
  feedback,
  onNotifications,
}: {
  account: DetailedAccount
  profile: Profile
  feedback: React.ReactNode
  onNotifications: () => void
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const { openAccountSwitcher, openFunding, openHomeScreen, openInstrument, openMoreScreen, openTab } = useAppNavigation()
  const { catalogue } = useMarketData()
  const favorites = useSession((state) => state.favorites)

  const catalogueInstruments = catalogue.status === 'ready' ? catalogue.data : []
  const pinned = catalogueInstruments.filter((item) => favorites.has(item.id))
  // Favourites first; until there are any, the leading markets stand in.
  const watchlistSnapshot = (pinned.length > 0 ? pinned : catalogueInstruments).slice(0, WATCHLIST_SIZE)
  const watchIds = watchlistSnapshot.map((item) => item.id)
  const sparks = useBackendQuery(
    `home-sparks:${account.id}:${watchIds.join(',') || 'none'}`,
    (backend) => watchIds.length > 0
      ? backend.markets.sparklines(watchIds, 'Today')
      : Promise.resolve(new Map<string, readonly number[]>()),
  )
  const sparkById = sparks.status === 'ready' ? sparks.data : undefined
  const instruments = catalogueInstruments.map((item) => applySparkSnapshot(item, sparkById?.get(item.id)))
  const watchlist = watchlistSnapshot.map((item) => applySparkSnapshot(item, sparkById?.get(item.id)))

  // Same keys as the Positions tab, so both screens share one request each.
  const positions = useBackendQuery(`positions:${account.id}`, (backend) => backend.orders.list(account.id))
  const history = useBackendQuery(`history:${account.id}`, (backend) => backend.orders.history(account.id))
  const trend = history.status === 'ready' ? realisedTrend(history.data) : null

  const { unread } = useNotifications()
  const pnlLabel = `${formatSignedMoney(account.floatingPnl)} (${formatPercent(account.changePercent)})`

  const quickActions = [
    { label: 'Deposit', Icon: DepositIcon, onPress: () => openFunding('deposit' as const), primary: true },
    { label: 'Withdraw', Icon: WithdrawIcon, onPress: () => openFunding('withdraw' as const), primary: false },
    { label: 'Trade', Icon: CandlesIcon, onPress: () => openTab('Trade'), primary: false },
    { label: 'Markets', Icon: MarketsIcon, onPress: () => openTab('Markets'), primary: false },
    { label: 'Positions', Icon: PositionsIcon, onPress: () => openTab('Positions'), primary: false },
    { label: 'Activity', Icon: ClockIcon, onPress: () => openMoreScreen('Activity'), primary: false },
    { label: 'Balance', Icon: WalletIcon, onPress: () => openHomeScreen('Balance'), primary: false },
    { label: 'More', Icon: MoreIcon, onPress: () => openTab('More'), primary: false },
  ] as const

  return (
    <Screen edges={['top']} aurora={false} style={styles.homeScreen}>
      <StatusBar style="dark" />
      <HomeAtmosphere />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.homeContent}
        contentInsetAdjustmentBehavior="never"
      >
        <Gutter style={styles.homeHeader}>
          <Pressable accessibilityRole="button" accessibilityLabel="Open account" onPress={() => openTab('More')}>
            <View style={styles.identity}>
              <View style={styles.avatarRing}>
                <Avatar uri={profile.avatarUrl} size={42} />
              </View>
              <View style={styles.greeting}>
                <Text variant="caption" color={colors.referenceMuted}>Welcome back</Text>
                <Text variant="strong" color={colors.brand}>{profile.holder.split(' ')[0]}</Text>
              </View>
            </View>
          </Pressable>
          <View>
            <CircleButton
              tone="outline"
              size={44}
              onPress={onNotifications}
              accessibilityLabel={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
            >
              <BellIcon size={20} color={colors.brand} />
            </CircleButton>
            {unread > 0 ? (
              <PopIn delay={700} style={styles.bellDot}>
                <View style={styles.bellDotFill} />
              </PopIn>
            ) : null}
          </View>
        </Gutter>

        {feedback}
        {history.status === 'ready' ? <QueryStateView state={history} render={() => null} /> : null}

        <Gutter style={styles.equitySection}>
          <View style={styles.brandRow}>
            <Logo size={17} tone="light" />
            <AccountPill mode={account.mode} number={account.number} tone="light" onPress={openAccountSwitcher} />
          </View>
          <PressableScale
            accessibilityLabel={`Open balance. Total equity ${formatMoney(account.equity)}. Open P&L ${pnlLabel}.`}
            onPress={() => openHomeScreen('Balance')}
            scaleTo={0.985}
          >
            <View style={styles.equityBlock}>
              <Text variant="caption" color={colors.referenceMuted}>Total equity</Text>
              <EquityFigure value={account.equity} />
              <View style={styles.cardPnl}>
                <Delta label={pnlLabel} direction={trendOf(account.floatingPnl)} size={13} />
                <Text variant="caption" color={colors.referenceMuted}>open P&amp;L</Text>
              </View>
            </View>
          </PressableScale>
        </Gutter>

        <View style={styles.overviewSection}>
          <Gutter style={styles.sectionRowOnInk}>
            <Text variant="section" color={colors.brand}>Account overview</Text>
            <Pressable accessibilityRole="button" onPress={() => openHomeScreen('Balance')} hitSlop={8}>
              <Text variant="caption" weight="semibold" color={colors.brand}>Details +</Text>
            </Pressable>
          </Gutter>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.accountStrip}
          >
            <StatTile label="Balance" value={account.balance} Icon={WalletIcon} tone="blue" ink={colors.brand} />
            <StatTile label="Free margin" value={account.freeMargin} Icon={BoltIcon} tone="amber" ink={colors.tintAmberInk} />
            <StatTile label="Open P&L" value={account.floatingPnl} Icon={TrendUpIcon} tone="mint" ink={colors.tintMintInk} />
          </ScrollView>
        </View>

        <Gutter>
          <Reveal index={1}>
            <View style={styles.quickPanel}>
              <Text variant="section" color={colors.white}>Quick actions</Text>
              <View style={styles.quickGrid}>
                {quickActions.map(({ label, Icon, onPress, primary }) => (
                  <QuickAction key={label} label={label} primary={primary} onPress={onPress}>
                    <Icon size={21} color={primary ? colors.homeBlack : colors.white} />
                  </QuickAction>
                ))}
              </View>
            </View>
          </Reveal>
        </Gutter>

        <Reveal index={2}>
          <Gutter>
            <MarketPulse instruments={instruments} onPress={() => openTab('Markets')} />
          </Gutter>
        </Reveal>

        <Reveal index={3}>
          <Gutter>
            <MarginInsight equity={account.equity} freeMargin={account.freeMargin} onPress={() => openTab('Positions')} />
          </Gutter>
        </Reveal>

      {trend ? (
        <Reveal index={4}>
          <Gutter>
            <RealisedTrend {...trend} />
          </Gutter>
        </Reveal>
      ) : null}

      <Reveal index={5} style={styles.section}>
        <Gutter>
          <DarkSectionHeader title="Watchlist" onPress={() => openTab('Markets')} />
          {catalogue.status === 'ready' ? <QueryStateView state={catalogue} render={() => null} /> : null}
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
                <Text variant="caption" color={colors.referenceMuted} style={styles.hint}>
                  Star a market on the Markets tab to pin it here.
                </Text>
              </Gutter>
            ) : null}
          </>
        )}
      </Reveal>

      <Reveal index={6}>
        <Gutter style={styles.section}>
          <DarkSectionHeader title="Open positions" onPress={() => openTab('Positions')} />
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
      </ScrollView>
    </Screen>
  )
}

/** The hero figure, rolling up to the account's equity and gliding with it. */
function EquityFigure({ value }: { value: number }) {
  const colors = useColors()

  const shown = useCountUp(value)
  return (
    <Amount
      variant="hero"
      color={colors.brand}
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLabel={formatMoney(value)}
    >
      {formatMoney(shown)}
    </Amount>
  )
}

/** One of the eight real trading destinations in the reference-shaped action grid. */
function QuickAction({
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
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <PressableScale accessibilityLabel={label} onPress={onPress} scaleTo={0.92} style={styles.quickAction}>
      <View style={styles.quickActionInner}>
        <View style={[styles.quickActionIcon, primary ? styles.quickActionIconPrimary : null]}>{children}</View>
        <Text variant="micro" weight="medium" color={primary ? colors.gold : colors.onInkMuted}>
          {label}
        </Text>
      </View>
    </PressableScale>
  )
}

function DarkSectionHeader({ title, onPress }: { title: string; onPress: () => void }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.darkSectionHeader}>
      <Text variant="section" color={colors.brand}>{title}</Text>
      <Pressable accessibilityRole="button" accessibilityLabel={`See all, ${title}`} onPress={onPress} hitSlop={8}>
        <View style={styles.darkSectionAction}>
          <Text variant="caption" weight="semibold" color={colors.goldDeep}>See all</Text>
          <ChevronRightIcon size={14} color={colors.goldDeep} />
        </View>
      </Pressable>
    </View>
  )
}

/** A secondary account figure on navy, with a contrasting icon on a soft tint. */
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
  tone: 'blue' | 'amber' | 'mint'
  ink: string
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const shown = useCountUp(value)
  return (
    <Card lifted={false} style={styles.tile}>
      <IconChip size={42} tone={tone}>
        <Icon size={22} color={ink} />
      </IconChip>
      <View style={styles.tileText}>
        <Text variant="caption" color={colors.onInkMuted}>
          {label}
        </Text>
        <Amount
          variant="displaySm"
          color={colors.white}
          style={styles.tileAmount}
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
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

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
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

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
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

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

const themeStyles = (colors: Palette) => (StyleSheet.create({
  state: { paddingTop: 32 },
  homeScreen: {
    backgroundColor: colors.referenceCanvas,
  },
  homeContent: {
    paddingTop: spacing.md,
    paddingBottom: 152,
    gap: spacing.xl,
  },
  homeHeader: {
    minHeight: 54,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  avatarRing: {
    padding: 2,
    borderRadius: 24,
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: colors.referenceLine,
  },
  greeting: {
    gap: 1,
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
    borderColor: colors.surface,
  },
  equitySection: {
    gap: spacing.xl,
    paddingTop: spacing.sm,
  },
  brandRow: {
    minHeight: 38,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  equityBlock: {
    gap: spacing.xs,
    paddingBottom: spacing.md,
  },
  cardPnl: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  overviewSection: {
    gap: spacing.md,
  },
  sectionRowOnInk: {
    minHeight: 36,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountStrip: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.xs,
    gap: spacing.md,
  },
  quickPanel: {
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
    paddingHorizontal: spacing.md,
    gap: spacing.xl,
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.homePanel,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeLine,
    boxShadow: '0px 18px 34px rgba(8, 11, 19, 0.24)',
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: spacing.xl,
  },
  quickAction: {
    width: '25%',
  },
  quickActionInner: {
    alignItems: 'center',
    gap: spacing.sm,
  },
  quickActionIcon: {
    width: 46,
    height: 46,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.075)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  quickActionIconPrimary: {
    backgroundColor: colors.gold,
    borderColor: colors.goldSoft,
    boxShadow: '0px 8px 20px rgba(230, 190, 63, 0.22)',
  },

  section: {
    gap: spacing.md,
  },
  darkSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 40,
  },
  darkSectionAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  tile: {
    width: 158,
    flexShrink: 0,
    minHeight: 136,
    padding: spacing.lg,
    gap: spacing.lg,
    backgroundColor: colors.homePanelRaised,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.homeLine,
  },
  tileText: {
    gap: 2,
  },
  tileAmount: {
    fontSize: 20,
    lineHeight: 25,
    letterSpacing: -0.45,
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
}))
