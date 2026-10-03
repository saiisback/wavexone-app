import { FlashList } from '@shopify/flash-list'
import * as Crypto from 'expo-crypto'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  Button,
  ButtonText,
  Card,
  ChevronDownIcon,
  Gutter,
  Pressable,
  SCREEN_PADDING,
  Screen,
  SegmentedControl,
  TAB_BAR_CLEARANCE,
  Text,
  Watermark,
  colors,
  radius,
  useActionMenu,
} from '../design-system'
import { PositionCard } from '../features/positions/position-card'
import { mutationFailureMessage } from '../backend/errors'
import { useBackend, useBackendQuery, useInvalidateQueries } from '../backend/provider'
import { formatLots, formatSignedMoney } from '../data/format'
import { markPosition } from '../data/live-quote'
import type { Instrument, Position } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
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
  const [tab, setTab] = useState<Tab>('Open')
  const showMenu = useActionMenu()
  const backend = useBackend()
  const invalidate = useInvalidateQueries()
  const { openInstrument, openAccountSwitcher, openModifyOrder, openTab } = useAppNavigation()

  const accountData = useAccountData()
  const { catalogue } = useMarketData()
  const accountId = accountData.status === 'ready' ? accountData.data.account?.id : null
  const openPositions = useBackendQuery(`positions:${accountId ?? 'none'}`, (backend) =>
    accountId ? backend.orders.list(accountId) : Promise.resolve([]),
  )
  const closedPositions = useBackendQuery(`history:${accountId ?? 'none'}`, (backend) =>
    accountId ? backend.orders.history(accountId) : Promise.resolve([]),
  )

  if (accountData.status !== 'ready' || !accountData.data.account || catalogue.status !== 'ready') {
    if (accountData.status === 'ready' && !accountData.data.account) {
      return <Screen><Gutter style={styles.loading}><AccountSummaryUnavailable account={accountData.data.selectedAccount} /></Gutter></Screen>
    }
    const state = accountData.status !== 'ready' ? accountData : catalogue
    return <Screen><Gutter style={styles.loading}><QueryStateView state={state} render={() => null} /></Gutter></Screen>
  }

  const account = accountData.data.account
  const positionState = tab === 'Closed' ? closedPositions : openPositions
  const positions = positionState.status === 'ready' ? positionState.data : []
  const instrumentsById = new Map(catalogue.data.map((item) => [item.id, item]))
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

    showMenu({
      title: `${ACTION_LABEL[tab]} — ${instrument.symbol}`,
      message: `${position.side} ${formatLots(position.lots)} · ${formatSignedMoney(position.pnl)}. Sent once and not automatically retried.`,
      options: [
        {
          label: ACTION_LABEL[tab],
          destructive: true,
          onSelect: () => {
            const request = { positionId: id, idempotencyKey: Crypto.randomUUID() }
            const mutation = tab === 'Pending'
              ? backend.orders.cancel(request)
              : backend.orders.close(request)
            void mutation.then(() => invalidate(...AFTER_TRADE)).catch((error: unknown) => showMenu({
              title: 'Action not confirmed',
              message: mutationFailureMessage(error),
              options: [{ label: 'Got it' }],
            }))
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

  const renderItem = ({ item }: { item: Position }) => {
    const instrument = instrumentOf(item)

    return (
      <LivePositionCard
        position={item}
        instrument={instrument}
        streamed={instrumentsById.has(item.instrumentId)}
        actionLabel={
          item.executing ? 'Executing…' : item.busy ? 'Closing…' : CARD_ACTION_LABEL[tab]
        }
        entryLabel={tab === 'Pending' ? 'Order price' : 'Open'}
        currentLabel={tab === 'Closed' ? 'Closed at' : 'Current'}
        onAction={confirmAction}
        // A closed trade has nothing left to modify, nor does one in flight.
        onModify={tab === 'Closed' || item.executing || item.busy ? undefined : openModifyOrder}
        onMenu={openRowMenu}
        onPress={() => openInstrument(item.instrumentId)}
      />
    )
  }

  const liveOpen = openPositions.status === 'ready'
    ? openPositions.data.filter((item) => item.state === 'Open')
    : null

  return (
    <Screen>
      <Gutter style={styles.titleRow}>
        <Text variant="title">Positions</Text>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Switch account"
          onPress={openAccountSwitcher}
          style={styles.accountPill}
        >
          <Text variant="caption" weight="semibold">
            {account.mode} · {account.number}
          </Text>
          <ChevronDownIcon size={16} color={colors.text} />
        </Pressable>
      </Gutter>

      <Gutter>
        <View style={styles.summary}>
          <Watermark size={150} right={-26} bottom={-26} />
          <Text variant="caption" weight="medium" color={colors.onInkMuted}>
            Floating P&amp;L
          </Text>
          <FloatingPnl
            positions={liveOpen}
            instrumentsById={instrumentsById}
            fallback={account.floatingPnl}
          />
          <Text variant="caption" color={colors.onInkMuted}>
            {liveOpen ? liveOpen.length : openCount} open{' '}
            {(liveOpen ? liveOpen.length : openCount) === 1 ? 'position' : 'positions'}
          </Text>
        </View>
      </Gutter>

      <Gutter style={styles.tabs}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </Gutter>

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={positionState.status !== 'ready' ? (
          <QueryStateView state={positionState} render={() => null} />
        ) : (
          <Card style={styles.empty}>
            <Text variant="strong">{EMPTY_TITLE[tab]}</Text>
            <Text variant="caption" color={colors.textMuted} style={styles.emptyMessage}>
              {EMPTY_MESSAGE[tab]}
            </Text>
            {tab === 'Closed' ? null : (
              <Button tone="track" onPress={() => openTab('Markets')} style={styles.emptyAction}>
                <ButtonText tone="track">Explore markets</ButtonText>
              </Button>
            )}
          </Card>
        )}
      />
    </Screen>
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
  actionLabel,
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
  actionLabel: string
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
      entryLabel={entryLabel}
      currentLabel={currentLabel}
      actionLabel={actionLabel}
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
  const backend = useBackend()
  useLiveQuotesVersion(positions?.map((item) => item.instrumentId) ?? [])
  const total = positions
    ? positions.reduce((sum, item) => {
        const quote = backend.prices.latest(item.instrumentId)
        return sum + markPosition(item, instrumentsById.get(item.instrumentId), quote).pnl
      }, 0)
    : fallback
  return (
    <Text
      variant="display"
      color={Math.abs(total) < 0.005 ? colors.onInk : total < 0 ? colors.redOnInk : colors.greenOnInk}
      style={styles.summaryValue}
    >
      {formatSignedMoney(total)}
    </Text>
  )
}

const keyExtractor = (item: Position) => item.id
const Separator = () => <View style={styles.separator} />

const styles = StyleSheet.create({
  loading: { paddingTop: 32 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
    paddingBottom: 16,
  },
  accountPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 44,
    paddingLeft: 14,
    paddingRight: 10,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  summary: {
    backgroundColor: colors.ink,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 18,
    overflow: 'hidden',
  },
  summaryValue: {
    marginTop: 4,
    marginBottom: 2,
    fontVariant: ['tabular-nums'],
  },

  tabs: {
    paddingTop: 16,
    paddingBottom: 16,
  },
  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  separator: {
    height: 12,
  },
  empty: {
    alignItems: 'center',
    gap: 4,
  },
  emptyMessage: {
    textAlign: 'center',
  },
  emptyAction: {
    marginTop: 12,
    alignSelf: 'stretch',
  },
})
