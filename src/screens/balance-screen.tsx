import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  CardPlusIcon,
  CircleAction,
  Gutter,
  Input,
  Logo,
  SCREEN_PADDING,
  Screen,
  SearchIcon,
  TAB_BAR_CLEARANCE,
  Text,
  Watermark,
  colors,
  fonts,
  useActionMenu,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { MarketRow } from '../features/markets/market-row'
import { useMarketData } from '../features/markets/use-market-data'
import { SectionHeader } from '../features/shared/section-header'
import { formatMoney } from '../data/format'
import { useSession, type MarketPeriod } from '../data/store'
import type { Instrument } from '../data/types'
import { useAccountData } from '../features/accounts/use-account-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const PERIODS: readonly MarketPeriod[] = ['Today', 'This week', 'This month', 'This year']

/**
 * "Your Balance": full-bleed dark header with the funding actions, then
 * search and Market Watch.
 */
export function BalanceScreen() {
  const { openInstrument } = useAppNavigation()
  const [query, setQuery] = useState('')
  const { catalogue: markets } = useMarketData()
  const accountId = useSession((state) => state.accountId)
  const period = useSession((state) => state.marketPeriod)
  // Real closes over the chosen period; rows keep the snapshot until they land.
  const sparks = useBackendQuery(
    `sparks:${accountId ?? 'none'}:${period}:${markets.status}`,
    (backend) => markets.status === 'ready'
      ? backend.markets.sparklines(markets.data.map((item) => item.id), period)
      : Promise.resolve(new Map<string, readonly number[]>()),
  )
  const sparkById = sparks.status === 'ready' ? sparks.data : undefined

  const needle = query.trim().toLowerCase()
  const catalogue = markets.status === 'ready' ? markets.data : []
  const rows = needle
    ? catalogue.filter(
        (item) =>
          item.symbol.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle),
      )
    : catalogue

  const renderItem = ({ item }: { item: Instrument }) => {
    const spark = sparkById?.get(item.id)
    // "Today" measures from the day's open; longer periods from their first close.
    const changeBase = period === 'Today' || !spark ? item.dayOpen : spark[0]
    return (
      <MarketRow
        id={item.id}
        symbol={item.symbol}
        name={item.name}
        price={item.price}
        precision={item.precision}
        changePercent={item.changePercent}
        changeBase={changeBase}
        iconKind={item.icon}
        iconLabel={item.iconLabel}
        iconTint={item.iconTint}
        spark={spark ?? item.spark}
        sparkTone={spark ? undefined : item.sparkTone}
        onPress={openInstrument}
      />
    )
  }

  return (
    <Screen edges={[]}>
      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={sparkById}
        ListHeaderComponent={<BalanceHeader query={query} onChangeQuery={setQuery} />}
        ItemSeparatorComponent={Separator}
        ListEmptyComponent={
          markets.status === 'ready' && markets.data.length > 0 ? (
            <Empty />
          ) : (
            <QueryStateView
              state={markets}
              isEmpty={(data) => data.length === 0}
              emptyTitle="No markets available"
              render={() => null}
            />
          )
        }
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />
    </Screen>
  )
}

function BalanceHeader({
  query,
  onChangeQuery,
}: {
  query: string
  onChangeQuery: (value: string) => void
}) {
  const insets = useSafeAreaInsets()
  const showMenu = useActionMenu()
  const { openFunding } = useAppNavigation()

  const accountData = useAccountData()
  const period = useSession((state) => state.marketPeriod)
  const setPeriod = useSession((state) => state.setMarketPeriod)
  const account = accountData.status === 'ready' ? accountData.data.account : null

  const pickPeriod = () =>
    showMenu({
      title: 'Market Watch period',
      options: PERIODS.map((option) => ({
        label: option,
        onSelect: () => setPeriod(option),
      })),
    })

  return (
    <View style={styles.header}>
      <View style={[styles.panel, { paddingTop: insets.top + 14 }]}>
        <Watermark size={168} right={-56} bottom={136} />

        <View style={styles.logoRow}>
          <Logo size={21} tone="dark" />
        </View>

        <Text variant="body" color={colors.onInk} style={styles.balanceLabel}>
          Your Balance
        </Text>
        <Text variant="display" color={colors.onInk} style={styles.balanceValue}>
          {account ? formatMoney(account.equity) : '—'}
        </Text>

        <View style={styles.actions}>
          <CircleAction label="Deposit" onPress={() => openFunding('deposit')}>
            <CardPlusIcon size={24} color={colors.onInk} />
          </CircleAction>
          <CircleAction label="Withdraw" onPress={() => openFunding('withdraw')}>
            <CardPlusIcon size={24} color={colors.onInk} />
          </CircleAction>
          <CircleAction label="Transfer" tone="gold" onPress={() => openFunding('transfer')}>
            <CardPlusIcon size={24} color={colors.ink} />
          </CircleAction>
        </View>
      </View>

      <Gutter style={styles.search}>
        <View style={styles.searchField}>
          <SearchIcon size={22} color={colors.text} />
          <Input
            value={query}
            onChangeText={onChangeQuery}
            placeholder="Search markets"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
      </Gutter>

      <Gutter style={styles.sectionHeader}>
        <SectionHeader
          title="Market Watch"
          action={period}
          withChevron
          onPressAction={pickPeriod}
        />
      </Gutter>
    </View>
  )
}

const keyExtractor = (item: Instrument) => item.id
const Separator = () => <View style={styles.separator} />

const Empty = () => (
  <View style={styles.empty}>
    <Text variant="body" color={colors.textMuted}>
      No markets match that search.
    </Text>
  </View>
)

const styles = StyleSheet.create({
  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  separator: {
    height: 14,
  },
  header: {
    // Cancels the list's gutter so the dark panel can bleed edge to edge.
    marginHorizontal: -SCREEN_PADDING,
  },
  panel: {
    backgroundColor: colors.ink,
    borderBottomLeftRadius: 34,
    borderBottomRightRadius: 34,
    borderCurve: 'continuous',
    paddingHorizontal: 22,
    paddingBottom: 22,
    overflow: 'hidden',
  },
  logoRow: {
    alignItems: 'center',
  },
  balanceLabel: {
    marginTop: 24,
    textAlign: 'center',
    fontSize: 17,
  },
  balanceValue: {
    marginTop: 4,
    textAlign: 'center',
    fontSize: 36,
    lineHeight: 44,
  },
  actions: {
    flexDirection: 'row',
    marginTop: 22,
    backgroundColor: colors.onInkPanel,
    borderRadius: 28,
    borderCurve: 'continuous',
    paddingVertical: 18,
    paddingHorizontal: 8,
  },

  search: {
    marginTop: 22,
  },
  searchField: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 56,
    borderRadius: 28,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    paddingHorizontal: 20,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
    // Keeps the caret on the same baseline across platforms.
    padding: 0,
  },

  sectionHeader: {
    marginTop: 24,
    marginBottom: 14,
  },
  empty: {
    paddingTop: 32,
    alignItems: 'center',
  },
})
