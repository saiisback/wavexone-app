import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { FlashList } from '@shopify/flash-list'
import * as Crypto from 'expo-crypto'
import { useEffect, useRef, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Amount,
  Button,
  ButtonText,
  Card,
  Donut,
  EmptyState,
  HomeAtmosphere,
  LiveDot,
  PageBar,
  PageScreen,
  PageTitle,
  PositionsIcon,
  SCREEN_PADDING,
  Reveal,
  SegmentedControl,
  TAB_BAR_CLEARANCE,
  Text,
  radius,
  spacing,
  useActionMenu,
  useCountUp,
  useHeroScroll,
} from '../design-system'
import { PositionCard } from '../features/positions/position-card'
import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useBackendQuery, useInvalidateQueries } from '../backend/provider'
import { formatLots, formatMoney, formatSignedMoney } from '../data/format'
import { markPosition } from '../data/live-quote'
import { useSession } from '../data/store'
import type { Instrument, Position } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { AccountPill } from '../features/accounts/account-pill'
import { AccountSummaryUnavailable } from '../features/accounts/account-summary-unavailable'
import { useLiveQuote, useLiveQuotesVersion } from '../features/markets/use-live-quote'
import { useMarketData } from '../features/markets/use-market-data'
import { AFTER_TRADE } from '../features/shared/query-keys'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const TABS = ['Open', 'Pending', 'Closed'] as const
type Tab = (typeof TABS)[number]

const ACTION_LABEL: Record<Tab, string> = {
  Open: 'Close position',
  Pending: 'Cancel order',
  Closed: 'View details',
}

/** Shorter copy for the half-width card button; menus keep `ACTION_LABEL`. */
const CARD_ACTION_LABEL: Record<Tab, string> = {
  Open: 'Close',
  Pending: 'Cancel',
  Closed: 'Details',
}

const EMPTY_TITLE: Record<Tab, string> = {
  Open: 'No open positions',
  Pending: 'No pending orders',
  Closed: 'No closed trades yet',
}

const EMPTY_MESSAGE: Record<Tab, string> = {
  Open: 'Positions you open on this account appear here with their live P&L.',
  Pending: 'Limit orders waiting for their price appear here until they fill.',
  Closed: 'Trades you close on this account appear here with their result.',
}

/** Positions tab: floating P&L, state filter, and the position cards. */
export function PositionsScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const [tab, setTab] = useState<Tab>('Open')
  const active = useRef(true)
  const locks = useRef(new Set<string>())
  const [pendingActions, setPendingActions] = useState<ReadonlySet<string>>(new Set())
  useEffect(() => { active.current = true; return () => { active.current = false } }, [])
  const showMenu = useActionMenu()
  const backend = useBackend()
  const invalidate = useInvalidateQueries()
  const { openInstrument, openAccountSwitcher, openModifyOrder, openTab } = useAppNavigation()
  const insets = useSafeAreaInsets()
  const { scrollY, onScrollJS } = useHeroScroll()

  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const accountId = accountData.status === 'ready' ? accountData.data.account?.id : null
  const [historyCursor, setHistoryCursor] = useState<{ accountId: string | null | undefined; page: number }>({ accountId: null, page: 1 })
  const historyPage = historyCursor.accountId === accountId ? historyCursor.page : 1
  const openPositions = useBackendQuery(`positions:${accountId ?? 'none'}`, (backend) =>
    accountId ? backend.orders.list(accountId) : Promise.resolve([]),
  )
  const closedPage = useBackendQuery(`history:${accountId ?? 'none'}:page:${historyPage}`, (backend) =>
    accountId ? backend.orders.historyPage(accountId, { page: historyPage }) : Promise.resolve({ positions: [], page: 1, hasMore: false }),
  )
  const closedPositions = closedPage.status === 'ready' ? { ...closedPage, data: closedPage.data.positions } : closedPage

  if (accountData.status !== 'ready' || !accountData.data.account) {
    if (accountData.status === 'ready' && !accountData.data.account) {
      return (
        <PageScreen title="Positions" tone="reference" contentStyle={styles.gutter}>
          <AccountSummaryUnavailable account={accountData.data.selectedAccount} />
        </PageScreen>
      )
    }
    const state = accountData
    return (
      <PageScreen title="Positions" tone="reference" contentStyle={styles.gutter}>
        <QueryStateView state={state} render={() => null} />
      </PageScreen>
    )
  }

  const account = accountData.data.account
  const positionState = tab === 'Closed' ? closedPositions : openPositions
  const positions = positionState.status === 'ready' ? positionState.data : []
  const instrumentsById = new Map((catalogue.status === 'ready' ? catalogue.data : []).map((item) => [item.id, item]))
  const positionsById = new Map(positions.map((item) => [item.id, item]))

  // A market the price feed does not carry still lists its positions.
  const instrumentOf = (position: Position) =>
    instrumentsById.get(position.instrumentId) ?? unlistedInstrument(position)

  const rows = positions.filter((item) => item.state === tab)
  const openCount = positions.filter((item) => item.state === 'Open').length

  /**
   * Closing and cancelling need a confirmation step, and run only in a build
   * whose phase allows trading — see the integration guide §6.8 and §8.
   */
  const confirmAction = (id: string) => {
    const position = positionsById.get(id)
    const instrument = position ? instrumentOf(position) : undefined
    if (!position || !instrument) return
    const scope = `${accountId}:${id}`
    if (locks.current.has(scope)) return

    if (tab === 'Closed') {
      openInstrument(position.instrumentId)
      return
    }

    // Reference, "Order states": nothing can be done to an order until the
    // fill or close the server is executing has finished.
    if (position.executing || position.busy) {
      showMenu({
        title: position.executing ? 'Order executing' : 'Order closing',
        message: position.executing
          ? 'This market order has been accepted and is being filled. It moves to Open as soon as it does.'
          : 'A close or change of this order is being executed. It updates as soon as it finishes.',
        options: [{ label: 'Got it' }],
      })
      return
    }

    let consumed = false
    showMenu({
      title: `${ACTION_LABEL[tab]} — ${instrument.symbol}`,
      message: `${position.side} ${formatLots(position.lots)} · ${formatSignedMoney(position.pnl)}. Sent once and not automatically retried.`,
      options: [
        {
          label: ACTION_LABEL[tab],
          destructive: true,
          onSelect: () => {
            if (consumed || !active.current || useSession.getState().accountId !== accountId || locks.current.has(scope)) return
            consumed = true
            locks.current.add(scope)
            setPendingActions(new Set(locks.current))
            const request = { positionId: id, idempotencyKey: Crypto.randomUUID() }
            const mutation = (async () => {
              if (tab === 'Pending') await backend.orders.cancel(request)
              else await backend.orders.close(request)
            })()
            void mutation.then(() => invalidate(...AFTER_TRADE)).catch((error: unknown) => {
              if (!active.current || useSession.getState().accountId !== accountId) return
              showMenu({
                title: 'Action not confirmed',
                message: mutationFailureMessage(error),
                options: [{ label: 'Got it' }],
              })
            }).finally(() => {
              locks.current.delete(scope)
              if (active.current) setPendingActions(new Set(locks.current))
            })
          },
        },
        { label: 'View chart', onSelect: () => openInstrument(position.instrumentId) },
      ],
    })
  }

  const openRowMenu = (id: string) => {
    const position = positionsById.get(id)
    const instrument = position ? instrumentOf(position) : undefined
    if (!position || !instrument) return

    showMenu({
      title: instrument.symbol,
      message: `${position.side} ${formatLots(position.lots)}`,
      options: [
        { label: 'View chart', onSelect: () => openInstrument(position.instrumentId) },
        // A closed trade has nothing left to modify, nor does one in flight.
        ...(tab === 'Closed' || position.executing || position.busy ? [] : [{
          label: 'Modify stop loss / take profit',
          onSelect: () => openModifyOrder(id),
        }]),
        {
          label: ACTION_LABEL[tab],
          destructive: tab !== 'Closed',
          onSelect: () => confirmAction(id),
        },
      ],
    })
  }

  const renderItem = ({ item, index }: { item: Position; index: number }) => {
    const instrument = instrumentOf(item)

    const card = (
      <LivePositionCard
        position={item}
        instrument={instrument}
        streamed={instrumentsById.has(item.instrumentId)}
        actionLabel={
          pendingActions.has(`${accountId}:${item.id}`) ? (tab === 'Pending' ? 'Cancelling…' : 'Closing…') : item.executing ? 'Executing…' : item.busy ? 'Closing…' : CARD_ACTION_LABEL[tab]
        }
        actionLoading={pendingActions.has(`${accountId}:${item.id}`)}
        variant={tab === 'Open' ? 'open' : tab === 'Pending' ? 'pending' : 'closed'}
        entryLabel={tab === 'Pending' ? 'Order price' : 'Open'}
        currentLabel={tab === 'Closed' ? 'Closed at' : 'Current'}
        onAction={confirmAction}
        // A closed trade has nothing left to modify, nor does one in flight.
        onModify={tab === 'Closed' || item.executing || item.busy || pendingActions.has(`${accountId}:${item.id}`) ? undefined : openModifyOrder}
        onMenu={openRowMenu}
        onPress={() => openInstrument(item.instrumentId)}
      />
    )
    // Only the first screenful settles in; later cells appear as they scroll.
    return index < 8
      ? <Reveal index={index + 2} style={[styles.gutter, styles.rowSurface]}>{card}</Reveal>
      : <View style={[styles.gutter, styles.rowSurface]}>{card}</View>
  }

  const liveOpen = openPositions.status === 'ready'
    ? openPositions.data.filter((item) => item.state === 'Open')
    : null
  const pendingCount = openPositions.status === 'ready'
    ? openPositions.data.filter((item) => item.state === 'Pending').length
    : 0

  const openList = liveOpen ?? positions.filter((item) => item.state === 'Open')
  const shownOpen = liveOpen ? liveOpen.length : openCount

  const header = (
    <View style={styles.header}>
      <HomeAtmosphere />
      <PageTitle
        scrollY={scrollY}
        title="Positions"
        tone="reference"
        trailing={
          <AccountPill tone="light" mode={account.mode} number={account.number} onPress={openAccountSwitcher} />
        }
        style={styles.title}
      />

      {/* No entrance animations in a FlashList header: they never settle on device. */}
      <View style={styles.gutter}>
        <Card tone="ink" style={styles.hero}>
          <View style={styles.heroLabel}>
            <LiveDot color={colors.greenOnInk} size={7} />
            <Text variant="caption" color={colors.onInkMuted}>
              Floating P&amp;L
            </Text>
          </View>
          <FloatingPnl positions={liveOpen} instrumentsById={instrumentsById} fallback={account.floatingPnl} />
          <View style={styles.chips}>
            <View style={styles.chip}>
              <Text variant="caption" weight="semibold" color={colors.onInk}>
                {`${shownOpen} open ${shownOpen === 1 ? 'position' : 'positions'}`}
              </Text>
            </View>
            {pendingCount > 0 ? (
              <View style={styles.chip}>
                <Text variant="caption" weight="semibold" color={colors.onInk}>
                  {`${pendingCount} pending`}
                </Text>
              </View>
            ) : null}
          </View>
          <Exposure positions={openList} />
        </Card>
      </View>

      <View style={[styles.gutter, styles.tabs]}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
        {tab === 'Closed' && <Text variant="caption" color={colors.textMuted}>{`Last 24 hours · Page ${historyPage}`}</Text>}
        {positionState.status === 'ready' && <QueryStateView state={positionState} render={() => null} />}
      </View>
    </View>
  )

  return (
    <View style={styles.root}>
      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        ListHeaderComponent={header}
        onScroll={onScrollJS}
        scrollEventThrottle={16}
        contentContainerStyle={{ ...styles.list, paddingTop: insets.top + spacing.sm }}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={[styles.gutter, styles.rowSurface]}>
            {positionState.status !== 'ready' ? (
              <QueryStateView state={positionState} render={() => null} />
            ) : (
              <Card padded={false}>
                <EmptyState
                  icon={<PositionsIcon size={24} color={colors.navy} />}
                  title={EMPTY_TITLE[tab]}
                  message={EMPTY_MESSAGE[tab]}
                  action={tab === 'Closed' ? undefined : 'Explore markets'}
                  onAction={() => openTab('Markets')}
                />
              </Card>
            )}
          </View>
        }
        ListFooterComponent={
          <View style={styles.footerSurface}>
            {tab === 'Closed' && <View style={[styles.gutter, { gap: spacing.sm }]}>
              {historyPage > 1 && <Button tone="surface" accessibilityLabel="Previous page of closed trades" onPress={() => setHistoryCursor({ accountId, page: historyPage - 1 })}>
                <ButtonText tone="surface">Previous page</ButtonText>
              </Button>}
              {closedPage.status === 'ready' && closedPage.data.hasMore && <Button tone="ink" accessibilityLabel="Next page of closed trades" onPress={() => setHistoryCursor({ accountId, page: historyPage + 1 })}>
                <ButtonText tone="ink">Next page</ButtonText>
              </Button>}
            </View>}
          </View>
        }
      />
      <PageBar scrollY={scrollY} title="Positions" tone="reference" />
    </View>
  )
}

/**
 * Which way the book leans: lots held long against lots held short, as a
 * small ring with a legend. Hidden until something is open.
 */
function Exposure({ positions }: { positions: readonly Position[] }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const long = positions.filter((item) => item.side === 'Buy').reduce((sum, item) => sum + item.lots, 0)
  const short = positions.filter((item) => item.side === 'Sell').reduce((sum, item) => sum + item.lots, 0)
  const total = long + short
  if (total <= 0) return null
  return (
    <View style={styles.exposure}>
      <Donut
        size={68}
        thickness={9}
        segments={[
          { key: 'long', value: long, color: colors.ice },
          { key: 'short', value: short, color: colors.brandSky },
        ]}
      >
        <Text variant="micro" color={colors.onInk}>
          {`${Math.round((long / total) * 100)}%`}
        </Text>
      </Donut>
      <View style={styles.legend}>
        <Text variant="overline" color={colors.onInkMuted}>
          Exposure
        </Text>
        <LegendLine color={colors.ice} label="Long" value={formatLots(long)} />
        <LegendLine color={colors.brandSky} label="Short" value={formatLots(short)} />
      </View>
    </View>
  )
}

function LegendLine({ color, label, value }: { color: string; label: string; value: string }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.legendLine}>
      <View style={[styles.legendDot, { backgroundColor: color }]} />
      <Text variant="caption" color={colors.onInkMuted} style={styles.legendLabel}>
        {label}
      </Text>
      <Text variant="caption" weight="semibold" color={colors.onInk}>
        {value}
      </Text>
    </View>
  )
}

/**
 * Stand-in for a position whose market is not in the catalogue: named after
 * its ticker, showing the server's own figures (no quote ever marks it).
 */
function unlistedInstrument(position: Position): Instrument {
  const ticker = position.instrumentId.replace(/^[^:]+:/, '').toUpperCase()
  const decimals = String(position.entry).split('.')[1]?.length ?? 2
  return {
    id: position.instrumentId,
    symbol: ticker,
    name: ticker,
    description: ticker,
    icon: 'generic',
    iconLabel: ticker.slice(0, 1),
    price: position.current,
    precision: Math.min(Math.max(decimals, 2), 5),
    changePercent: 0,
    bid: position.current,
    ask: position.current,
    spark: [],
    category: 'Stocks',
    favorite: false,
    contractSize: 1,
  }
}

/** One card, marked to its own instrument's stream. */
function LivePositionCard({
  position,
  instrument,
  streamed,
  variant,
  actionLabel,
  actionLoading,
  entryLabel,
  currentLabel,
  onAction,
  onModify,
  onMenu,
  onPress,
}: {
  position: Position
  instrument: Instrument
  /** False for a stand-in instrument, whose lot size is unknown. */
  streamed: boolean
  variant: 'open' | 'pending' | 'closed'
  actionLabel: string
  actionLoading?: boolean
  entryLabel: string
  currentLabel: string
  onAction: (id: string) => void
  onModify?: (id: string) => void
  onMenu: (id: string) => void
  onPress: () => void
}) {
  const quote = useLiveQuote(streamed && position.state === 'Open' ? position.instrumentId : undefined)
  const marked = markPosition(position, instrument, quote)
  return (
    <PositionCard
      id={marked.id}
      symbol={instrument.symbol}
      description={instrument.description}
      iconKind={instrument.icon}
      iconLabel={instrument.iconLabel}
      iconTint={instrument.iconTint}
      category={instrument.category}
      side={marked.side}
      lots={marked.lots}
      entry={marked.entry}
      current={marked.current}
      precision={instrument.precision}
      pnl={marked.pnl}
      variant={variant}
      entryLabel={entryLabel}
      currentLabel={currentLabel}
      actionLabel={actionLabel}
      actionLoading={actionLoading}
      onAction={onAction}
      onModify={onModify}
      onMenu={onMenu}
      onPress={onPress}
    />
  )
}

/**
 * Sum of the open positions marked to live prices. Its own component, so a
 * tick re-renders the headline rather than the whole list.
 */
function FloatingPnl({
  positions,
  instrumentsById,
  fallback,
}: {
  positions: readonly Position[] | null
  instrumentsById: ReadonlyMap<string, Instrument>
  fallback: number
}) {
  const colors = useColors()

  const backend = useBackend()
  useLiveQuotesVersion(positions?.map((item) => item.instrumentId) ?? [])
  const total = positions
    ? positions.reduce((sum, item) => {
        const quote = backend.prices.latest(item.instrumentId)
        return sum + markPosition(item, instrumentsById.get(item.instrumentId), quote).pnl
      }, 0)
    : fallback
  const shown = useCountUp(total)
  return (
    <Amount
      variant="hero"
      numberOfLines={1}
      adjustsFontSizeToFit
      accessibilityLabel={`Floating P&L ${formatSignedMoney(total)}`}
      color={Math.abs(total) < 0.005 ? colors.onInk : total < 0 ? colors.redOnInk : colors.greenOnInk}
    >
      {Math.abs(shown) < 0.005 ? formatMoney(0) : formatSignedMoney(shown)}
    </Amount>
  )
}

const keyExtractor = (item: Position) => item.id
const Separator = () => { const styles = useThemeStyles(themeStyles); return <View style={styles.separator} /> }

const themeStyles = (colors: Palette) => (StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  gutter: {
    paddingHorizontal: SCREEN_PADDING,
  },
  header: {
    position: 'relative',
    overflow: 'hidden',
    paddingBottom: 0,
  },
  title: {
    paddingBottom: spacing.lg,
  },

  hero: {
    paddingVertical: spacing.xl,
    gap: spacing.xs,
  },
  heroLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.glassOnInk,
    borderWidth: 1,
    borderColor: colors.glassOnInkEdge,
  },
  exposure: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderCurve: 'continuous',
    backgroundColor: colors.onInkPanel,
  },
  legend: {
    flex: 1,
    gap: 3,
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
    paddingBottom: spacing.lg,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  list: {
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  separator: {
    height: 12,
    backgroundColor: colors.surface,
  },
  rowSurface: {
    backgroundColor: colors.surface,
  },
  footerSurface: {
    minHeight: TAB_BAR_CLEARANCE,
    backgroundColor: colors.surface,
  },
}))
