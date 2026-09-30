import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'

import {
  FilterIcon,
  Gutter,
  Pressable,
  SCREEN_PADDING,
  Screen,
  SegmentedControl,
  TAB_BAR_CLEARANCE,
  Text,
  VerticalDivider,
  Watermark,
  colors,
  useActionMenu,
} from '../design-system'
import { ActivityRow } from '../features/activity/activity-row'
import { ScreenHeader } from '../features/shared/screen-header'
import { activity, activityById, instrumentsById } from '../data/mock'
import { formatSignedMoney } from '../data/format'
import { selectAccount, useSession, type MarketPeriod } from '../data/store'
import type { ActivityEntry } from '../data/types'
import { useAppNavigation } from '../navigation/use-app-navigation'

const TABS = ['Trades', 'Funds', 'Orders'] as const
const RANGES: readonly MarketPeriod[] = ['Today', 'This week', 'This month', 'This year']

type ListItem =
  | { type: 'header'; id: string; title: string }
  | { type: 'entry'; id: string; entry: ActivityEntry }

/** Activity: month summary, a Trades / Funds / Orders filter, grouped history. */
export function ActivityScreen() {
  const [tab, setTab] = useState<(typeof TABS)[number]>('Trades')
  const [range, setRange] = useState<MarketPeriod>('This month')

  const showMenu = useActionMenu()
  const { openInstrument, openFunding } = useAppNavigation()
  const account = useSession(selectAccount)

  const items = buildItems(activity.filter((entry) => entry.tab === tab))

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
      : [{ label: 'Repeat this transfer', onSelect: () => openFunding('deposit') }]

    showMenu({
      title: entry.title,
      message: `${entry.subtitle} · ${entry.date} ${entry.time}`,
      options: [...options, { label: 'Download receipt' }],
    })
  }

  const renderItem = ({ item }: { item: ListItem }) => {
    if (item.type === 'header') {
      return (
        <Text variant="heading" style={styles.groupHeader}>
          {item.title}
        </Text>
      )
    }

    const instrument = item.entry.instrumentId
      ? instrumentsById.get(item.entry.instrumentId)
      : undefined

    return (
      <ActivityRow
        id={item.entry.id}
        kind={item.entry.kind}
        title={item.entry.title}
        subtitle={item.entry.subtitle}
        date={item.entry.date}
        time={item.entry.time}
        amount={item.entry.amount}
        iconKind={instrument?.icon}
        iconLabel={instrument?.iconLabel}
        iconTint={instrument?.iconTint}
        onMenu={openRowMenu}
      />
    )
  }

  return (
    <Screen>
      <ScreenHeader
        title="Activity"
        subtitle={`${account.mode} · ${account.number} · ${range}`}
        action={
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Filter activity"
            hitSlop={8}
            onPress={openFilter}
          >
            <FilterIcon size={24} color={colors.text} />
          </Pressable>
        }
      />

      <Gutter>
        <View style={styles.summary}>
          <Watermark size={140} right={-22} top={-24} />
          <Text variant="strong" color={colors.onInk} style={styles.summaryTitle}>
            {range}
          </Text>

          <View style={styles.summaryBody}>
            <View style={styles.summaryLeft}>
              <Text variant="body" color={colors.onInkMuted}>
                Net result
              </Text>
              <Text
                variant="display"
                color={
                  account.monthNetResult === undefined || account.monthNetResult >= 0
                    ? colors.greenOnInk
                    : colors.red
                }
                style={styles.summaryValue}
              >
                {account.monthNetResult === undefined
                  ? 'Unavailable'
                  : formatSignedMoney(account.monthNetResult)}
              </Text>
            </View>

            <VerticalDivider />

            <View style={styles.summaryRight}>
              <Text variant="body" color={colors.onInkMuted}>
                <Text variant="strong" color={colors.onInk}>
                  {account.monthTrades ?? '—'}
                </Text>
                {' trades'}
              </Text>
              <Text variant="body" color={colors.onInkMuted}>
                <Text variant="strong" color={colors.onInk}>
                  {account.monthWinRate === undefined ? '—' : `${account.monthWinRate}%`}
                </Text>
                {' win rate'}
              </Text>
            </View>
          </View>
        </View>
      </Gutter>

      <Gutter style={styles.tabs}>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </Gutter>

      <FlashList
        data={items}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        getItemType={getItemType}
        ItemSeparatorComponent={Separator}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text variant="body" color={colors.textMuted}>
              No {tab.toLowerCase()} in this period.
            </Text>
          </View>
        }
      />
    </Screen>
  )
}

/** Flattens the grouped history into header / entry rows for the virtualizer. */
function buildItems(entries: readonly ActivityEntry[]): ListItem[] {
  const items: ListItem[] = []
  let currentGroup: string | undefined

  for (const entry of entries) {
    if (entry.group !== currentGroup) {
      currentGroup = entry.group
      items.push({ type: 'header', id: `header-${entry.group}`, title: entry.group })
    }
    items.push({ type: 'entry', id: entry.id, entry })
  }

  return items
}

const keyExtractor = (item: ListItem) => item.id
/** Separate recycling pools so a header never recycles into a row. */
const getItemType = (item: ListItem) => item.type
const Separator = () => <View style={styles.separator} />

const styles = StyleSheet.create({
  summary: {
    backgroundColor: colors.ink,
    borderRadius: 24,
    borderCurve: 'continuous',
    padding: 20,
    overflow: 'hidden',
  },
  summaryTitle: {
    fontSize: 18,
  },
  summaryBody: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 14,
    gap: 14,
  },
  summaryLeft: {
    flex: 1,
    gap: 4,
  },
  summaryValue: {
    fontSize: 30,
    lineHeight: 38,
  },
  summaryRight: {
    width: 108,
    gap: 10,
  },

  tabs: {
    paddingTop: 16,
    paddingBottom: 18,
  },
  groupHeader: {
    fontSize: 19,
    paddingBottom: 12,
    paddingTop: 6,
  },
  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  separator: {
    height: 8,
  },
  empty: {
    paddingTop: 40,
    alignItems: 'center',
  },
})
