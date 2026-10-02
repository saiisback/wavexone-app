import { FlashList } from '@shopify/flash-list'
import * as Crypto from 'expo-crypto'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
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
import type { Position } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
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

/** Positions tab: floating P&L, state filter, and the position cards. */
export function PositionsScreen() {
  const [tab, setTab] = useState<Tab>('Open')
  const showMenu = useActionMenu()
  const backend = useBackend()
  const invalidate = useInvalidateQueries()
  const { openInstrument, openAccountSwitcher, openModifyOrder } = useAppNavigation()

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
    const state = accountData.status !== 'ready' ? accountData : catalogue
    return <Screen><Gutter style={styles.loading}><QueryStateView state={state} render={() => null} /></Gutter></Screen>
  }

  const account = accountData.data.account
  const positionState = tab === 'Closed' ? closedPositions : openPositions
  const positions = positionState.status === 'ready' ? positionState.data : []
  const instrumentsById = new Map(catalogue.data.map((item) => [item.id, item]))
  const positionsById = new Map(positions.map((item) => [item.id, item]))

  const rows = positions.filter((item) => item.state === tab)
  const openCount = positions.filter((item) => item.state === 'Open').length

  /**
   * Closing and cancelling need a confirmation step, and run only in a build
   * whose phase allows trading — see the integration guide §6.8 and §8.
   */
  const confirmAction = (id: string) => {
    const position = positionsById.get(id)
    const instrument = position ? instrumentsById.get(position.instrumentId) : undefined
    if (!position || !instrument) return

    if (tab === 'Closed') {
      openInstrument(position.instrumentId)
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
    const instrument = position ? instrumentsById.get(position.instrumentId) : undefined
    if (!position || !instrument) return

    showMenu({
      title: instrument.symbol,
      message: `${position.side} ${formatLots(position.lots)}`,
      options: [
        { label: 'View chart', onSelect: () => openInstrument(position.instrumentId) },
        // A closed trade has nothing left to modify.
        ...(tab === 'Closed' ? [] : [{
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
    const instrument = instrumentsById.get(item.instrumentId)
    if (!instrument) return null

    return (
      <PositionCard
        id={item.id}
        symbol={instrument.symbol}
        description={instrument.description}
        iconKind={instrument.icon}
        iconLabel={instrument.iconLabel}
        iconTint={instrument.iconTint}
        side={item.side}
        lots={item.lots}
        entry={item.entry}
        current={item.current}
        precision={instrument.precision}
        pnl={item.pnl}
        actionLabel={ACTION_LABEL[tab]}
        onAction={confirmAction}
        onMenu={openRowMenu}
        onPress={() => openInstrument(item.instrumentId)}
      />
    )
  }

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
          <Text variant="body">
            {account.mode} · {account.number}
          </Text>
          <ChevronDownIcon size={20} color={colors.text} />
        </Pressable>
      </Gutter>

      <Gutter>
        <View style={styles.summary}>
          <Watermark size={150} right={-26} bottom={-26} />
          <Text variant="body" color={colors.onInk} style={styles.summaryLabel}>
            Floating P&amp;L
          </Text>
          <Text
            variant="display"
            color={account.floatingPnl < 0 ? colors.red : colors.greenOnInk}
            style={styles.summaryValue}
          >
            {formatSignedMoney(account.floatingPnl)}
          </Text>
          <Text variant="body" color={colors.onInkMuted}>
            {openCount} open {openCount === 1 ? 'position' : 'positions'}
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
          <View style={styles.empty}>
            <Text variant="body" color={colors.textMuted}>
              No {tab.toLowerCase()} positions on this account.
            </Text>
          </View>
        )}
      />
    </Screen>
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
    gap: 10,
    height: 46,
    paddingLeft: 18,
    paddingRight: 14,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },

  summary: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    borderCurve: 'continuous',
    paddingHorizontal: 20,
    paddingVertical: 20,
    overflow: 'hidden',
  },
  summaryLabel: {
    fontSize: 17,
  },
  summaryValue: {
    marginTop: 6,
    marginBottom: 6,
    fontSize: 38,
    lineHeight: 46,
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
    height: 14,
  },
  empty: {
    paddingTop: 40,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
})
