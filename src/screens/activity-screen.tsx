import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Aurora,
  Amount,
  BackButton,
  Card,
  CircleButton,
  Donut,
  EmptyState,
  FilterIcon,
  PageBar,
  PageScreen,
  PageTitle,
  SCREEN_PADDING,
  SegmentedControl,
  TAB_BAR_CLEARANCE,
  Text,
  colors,
  radius,
  spacing,
  useActionMenu,
  useCountUp,
  useHeroScroll,
} from '../design-system'
import { ActivityDayHeader, ActivityGroupCell } from '../features/activity/activity-group'
import { ActivityRow } from '../features/activity/activity-row'
import { useBackendQuery } from '../backend/provider'
import { activityGroup, inPeriod } from '../data/activity-dates'
import { formatLots, formatSignedMoney } from '../data/format'
import { type MarketPeriod } from '../data/store'
import type { ActivityEntry, Position } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const TABS = ['Trades', 'Funds', 'Orders'] as const
const RANGES: readonly MarketPeriod[] = ['Today', 'This week', 'This month', 'This year']

type ListItem =
  | { type: 'header'; id: string; title: string; count: number; total?: number }
  | { type: 'entry'; id: string; entry: ActivityEntry; first: boolean; last: boolean }

/** Activity: month summary, a Trades / Funds / Orders filter, grouped history. */
export function ActivityScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Trades')
  const [range, setRange] = useState<MarketPeriod>('This month')

  const showMenu = useActionMenu()
  const { openInstrument, openFunding } = useAppNavigation()
  const insets = useSafeAreaInsets()
  const { scrollY, onScrollJS } = useHeroScroll()
  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const accountId = accountData.status === 'ready' ? accountData.data.account?.id : null
  const funds = useBackendQuery(`funds-history:${accountId ?? 'none'}`, (backend) =>
    accountId ? backend.funds.history(accountId) : Promise.resolve([]),
  )
  const trades = useBackendQuery(`trade-history:${accountId ?? 'none'}`, (backend) =>
    accountId ? backend.orders.history(accountId) : Promise.resolve([]),
  )
  // Same key as the Positions tab, so the Orders filter shares its read.
  const orders = useBackendQuery(`positions:${accountId ?? 'none'}`, (backend) =>
    accountId ? backend.orders.list(accountId) : Promise.resolve([]),
  )

  if (accountData.status !== 'ready' || !accountData.data.account || catalogue.status !== 'ready') {
    if (accountData.status === 'ready' && !accountData.data.account) {
      return (
        <PageScreen back title="Activity" contentStyle={styles.gutter}>
          <AccountSummaryUnavailable account={accountData.data.selectedAccount} />
        </PageScreen>
      )
    }
    const state = accountData.status !== 'ready' ? accountData : catalogue
    return (
      <PageScreen back title="Activity" contentStyle={styles.gutter}>
        <QueryStateView state={state} render={() => null} />
      </PageScreen>
    )
  }
  const account = accountData.data.account
  const instrumentsById = new Map(catalogue.data.map((item) => [item.id, item]))

  const toEntry = (position: Position, entryTab: ActivityEntry['tab'], subtitle: string): ActivityEntry => ({
    id: position.id,
    kind: 'trade',
    instrumentId: position.instrumentId,
    title: instrumentsById.get(position.instrumentId)?.symbol ?? position.instrumentId,
    subtitle,
    date: position.time?.slice(0, 10) ?? '',
    time: position.time?.slice(11, 16) ?? '',
    // A pending order has not traded, so it has no result yet.
    amount: entryTab === 'Orders' ? 0 : position.pnl,
    group: position.time ? activityGroup(position.time) : 'Earlier',
    tab: entryTab,
  })

  const source = tab === 'Funds' ? funds : tab === 'Orders' ? orders : trades
  const activity: readonly ActivityEntry[] =
    tab === 'Funds'
      ? funds.status === 'ready' ? funds.data : []
      : tab === 'Orders'
        ? orders.status === 'ready'
          ? orders.data
              .filter((position) => position.state === 'Pending')
              .map((position) =>
                toEntry(position, 'Orders', `Pending • ${position.side} ${formatLots(position.lots)}`),
              )
          : []
        : trades.status === 'ready'
          ? trades.data.map((position) =>
              toEntry(position, 'Trades', `${position.side} ${formatLots(position.lots)}`),
            )
          : []
  const activityById = new Map(activity.map((entry) => [entry.id, entry]))
  const items = buildItems(
    activity.filter((entry) => entry.tab === tab && inPeriod(entry.date, range)),
    // A pending order has no result yet, so its day carries no net.
    tab !== 'Orders',
  )

  const openFilter = () =>
    showMenu({
      title: 'Show activity from',
      options: RANGES.map((option) => ({
        label: option === range ? `${option} ✓` : option,
        onSelect: () => setRange(option),
      })),
    })

  const openRowMenu = (id: string) => {
    const entry = activityById.get(id)
    if (!entry) return

    const options = entry.instrumentId
      ? [
          {
            label: 'View chart',
            onSelect: () => openInstrument(entry.instrumentId as string),
          },
        ]
      : [{ label: 'Make a deposit', onSelect: () => openFunding('deposit') }]

    showMenu({
      title: entry.title,
      message: `${entry.subtitle} · ${entry.date} ${entry.time}`,
      options: [
        ...options,
        {
          label: 'Download receipt',
          onSelect: () =>
            showMenu({
              title: 'Receipts unavailable',
              message: 'WaveXOne has not provided a receipt endpoint yet.',
              options: [{ label: 'Got it' }],
            }),
        },
      ],
    })
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <View style={styles.gutter}>
          <ActivityDayHeader title={item.title} count={item.count} total={item.total} />
        </View>
      )
    }

    const instrument = item.entry.instrumentId
      ? instrumentsById.get(item.entry.instrumentId)
      : undefined

    return (
      <View style={styles.gutter}>
        <ActivityGroupCell first={item.first} last={item.last}>
          <ActivityRow
            id={item.entry.id}
            kind={item.entry.kind}
            title={item.entry.title}
            subtitle={item.entry.subtitle}
            date={item.entry.date}
            time={item.entry.time}
            amount={item.entry.amount}
            showDate={item.entry.group === 'Earlier'}
            iconKind={instrument?.icon}
            iconLabel={instrument?.iconLabel}
            iconTint={instrument?.iconTint}
            iconSymbol={instrument?.symbol}
            iconCategory={instrument?.category}
            onMenu={openRowMenu}
          />
        </ActivityGroupCell>
      </View>
    )
  }

  const filterButton = (
    <CircleButton size={42} accessibilityLabel="Filter activity" onPress={openFilter}>
      <FilterIcon size={19} color={colors.text} />
    </CircleButton>
  )

  const header = (
    <View style={styles.header}>
      <PageTitle
        scrollY={scrollY}
        title="Activity"
        subtitle={`${account.mode} · ${account.number} · ${range}`}
        leading={<BackButton />}
        trailing={filterButton}
        style={styles.title}
      />

      {/* No entrance animations in a FlashList header: they never settle on device. */}
      <View style={styles.gutter}>
        <MonthReport
          net={account.monthNetResult}
          trades={account.monthTrades}
          winRate={account.monthWinRate}
        />
      </View>

      <View style={[styles.gutter, styles.tabs]}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </View>
    </View>
  )

  return (
    <View style={styles.root}>
      <Aurora />
      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        ListHeaderComponent={header}
        onScroll={onScrollJS}
        scrollEventThrottle={16}
        contentContainerStyle={{ ...styles.list, paddingTop: insets.top + spacing.sm }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[styles.gutter, styles.empty]}>
            {source.status !== 'ready' ? (
              <QueryStateView state={source} render={() => null} />
            ) : (
              <Card padded={false}>
                <EmptyState
                  icon={<FilterIcon size={22} color={colors.navy} />}
                  title={`No ${tab.toLowerCase()} in this period`}
                  message="Change the period with the filter above to see more."
                />
              </Card>
            )}
          </View>
        }
      />
      <PageBar scrollY={scrollY} title="Activity" />
    </View>
  )
}

/**
 * The month at a glance, in the reference "Report" style: the net result as
 * the big figure, trades and win rate beside it, and a ring of wins against
 * losses with its legend.
 */
function MonthReport({ net, trades, winRate }: { net?: number; trades?: number; winRate?: number }) {
  const shown = useCountUp(net ?? 0)
  const wins = trades !== undefined && winRate !== undefined ? Math.round((trades * winRate) / 100) : undefined
  const losses = wins !== undefined && trades !== undefined ? Math.max(trades - wins, 0) : undefined

  return (
    <Card tone="ink" style={styles.report}>
      <View style={styles.reportHead}>
        <Text variant="caption" color={colors.onInkMuted}>
          Net result · this month
        </Text>
        <View style={styles.reportChip}>
          <Text variant="micro" color={colors.onInk}>
            {trades === undefined ? '— trades' : `${trades} ${trades === 1 ? 'trade' : 'trades'}`}
          </Text>
        </View>
      </View>

      {net === undefined ? (
        <Text variant="display" color={colors.onInkMuted}>
          Unavailable
        </Text>
      ) : (
        <Amount
          variant="hero"
          numberOfLines={1}
          adjustsFontSizeToFit
          accessibilityLabel={`Net result ${formatSignedMoney(net)}`}
          color={net >= 0 ? colors.greenOnInk : colors.redOnInk}
        >
          {formatSignedMoney(shown)}
        </Amount>
      )}

      <View style={styles.reportBody}>
        <Donut
          size={96}
          thickness={11}
          segments={wins !== undefined && losses !== undefined ? [
            { key: 'wins', value: wins, color: colors.greenOnInk },
            { key: 'losses', value: losses, color: colors.redOnInk },
          ] : []}
        >
          <Text variant="strong" color={colors.onInk}>
            {winRate === undefined ? '—' : `${winRate}%`}
          </Text>
          <Text variant="micro" color={colors.onInkMuted}>
            win rate
          </Text>
        </Donut>
        <View style={styles.legend}>
          <LegendLine color={colors.greenOnInk} label="Winning trades" value={wins} />
          <LegendLine color={colors.redOnInk} label="Losing trades" value={losses} />
        </View>
      </View>
    </Card>
  )
}

function LegendLine({ color, label, value }: { color: string; label: string; value?: number }) {
  return (
    <View style={styles.legendLine}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="caption" color={colors.onInkMuted} style={styles.legendLabel} numberOfLines={1}>
        {label}
      </Text>
      <Text variant="strong" color={colors.onInk}>
        {value ?? '—'}
      </Text>
    </View>
  )
}

const GROUP_ORDER: readonly ActivityEntry['group'][] = ['Today', 'Yesterday', 'Earlier']

/** Flattens the grouped history into header / entry rows for the virtualizer. */
function buildItems(entries: readonly ActivityEntry[], withTotals: boolean): ListItem[] {
  // Grouped in display order (stable within a group), so a header is never
  // repeated when the server's order interleaves days.
  const ordered = [...entries].sort(
    (a, b) => GROUP_ORDER.indexOf(a.group) - GROUP_ORDER.indexOf(b.group),
  )

  const items: ListItem[] = []
  for (let start = 0; start < ordered.length;) {
    const group = ordered[start].group
    let end = start
    while (end < ordered.length && ordered[end].group === group) end += 1
    const run = ordered.slice(start, end)
    items.push({
      type: 'header',
      id: `header-${group}`,
      title: group,
      count: run.length,
      total: withTotals ? run.reduce((sum, entry) => sum + entry.amount, 0) : undefined,
    })
    run.forEach((entry, index) => {
      items.push({ type: 'entry', id: entry.id, entry, first: index === 0, last: index === run.length - 1 })
    })
    start = end
  }

  return items
}

const keyExtractor = (item: ListItem) => item.id
/** Separate recycling pools so a header never recycles into a row. */
const getItemType = (item: ListItem) => item.type

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  gutter: {
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    paddingBottom: spacing.xs,
  },
  title: {
    paddingBottom: spacing.lg,
  },

  report: {
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  reportHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  reportChip: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.glassOnInk,
    borderWidth: 1,
    borderColor: colors.glassOnInkEdge,
  },
  reportBody: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xl,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.onInkPanel,
  },
  legend: {
    flex: 1,
    gap: spacing.sm,
  },
  legendLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  legendDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  legendLabel: {
    flex: 1,
  },

  tabs: {
    paddingTop: spacing.xl,
  },
  empty: {
    paddingTop: spacing.xl,
  },
  list: {
    paddingBottom: TAB_BAR_CLEARANCE,
  },
})
