import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'

import {
  Gutter,
  Pressable,
  SCREEN_PADDING,
  Screen,
  SearchField,
  StarIcon,
  TAB_BAR_CLEARANCE,
  Text,
  colors,
  fonts,
  radius,
  useActionMenu,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { MarketGroupCell, MarketGroupSeparator } from '../features/markets/market-group'
import { MarketRow } from '../features/markets/market-row'
import { MoverCard } from '../features/markets/mover-card'
import { useSession } from '../data/store'
import type { Instrument } from '../data/types'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const FILTERS = [
  'Favorites',
  'All',
  'Forex',
  'Metals',
  'Crypto',
  'Energy',
  'Indices',
  'Stocks',
] as const
type Filter = (typeof FILTERS)[number]

/** How many instruments the "Top movers" strip shows. */
const MOVER_COUNT = 6

/**
 * Markets tab. Not in the supplied mockups — built from the same primitives
 * so it sits alongside Market Watch without introducing new visual rules.
 *
 * Search and the category chips stay pinned; the "Top movers" strip and the
 * section heading scroll with the list.
 */
export function MarketsScreen() {
  const { openInstrument, openOrderTicket } = useAppNavigation()
  const showMenu = useActionMenu()
  const { catalogue, setFavorite } = useMarketData()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const accountId = useSession((state) => state.accountId)
  // The day's closes for the row sparklines; rows keep the snapshot until they land.
  const sparks = useBackendQuery(
    `sparks:${accountId ?? 'none'}:Today:${catalogue.status}`,
    (backend) => catalogue.status === 'ready'
      ? backend.markets.sparklines(catalogue.data.map((item) => item.id), 'Today')
      : Promise.resolve(new Map<string, readonly number[]>()),
  )
  const sparkById = sparks.status === 'ready' ? sparks.data : undefined

  const favorites = useSession((state) => state.favorites)
  const toggleFavorite = useSession((state) => state.toggleFavorite)

  const needle = query.trim().toLowerCase()
  const instruments = catalogue.status === 'ready' ? catalogue.data : []
  const rows = instruments.filter((item) => {
    const matchesFilter =
      filter === 'All' || (filter === 'Favorites' ? favorites.has(item.id) : item.category === filter)
    if (!matchesFilter) return false
    if (!needle) return true
    return item.symbol.toLowerCase().includes(needle) || item.name.toLowerCase().includes(needle)
  })

  // Biggest moves either way, from the catalogue snapshot.
  const movers = [...instruments]
    .sort((left, right) => Math.abs(right.changePercent) - Math.abs(left.changePercent))
    .slice(0, MOVER_COUNT)
  const showMovers = filter === 'All' && !needle && movers.length > 1

  const openRowMenu = (instrumentId: string) => {
    const instrument = instruments.find((item) => item.id === instrumentId)
    if (!instrument) return

    showMenu({
      title: instrument.symbol,
      message: instrument.description,
      options: [
        { label: 'View chart', onSelect: () => openInstrument(instrumentId) },
        { label: 'Buy', onSelect: () => openOrderTicket(instrumentId, 'Buy') },
        { label: 'Sell', onSelect: () => openOrderTicket(instrumentId, 'Sell') },
        {
          label: favorites.has(instrumentId) ? 'Remove from favourites' : 'Add to favourites',
          onSelect: () => {
            const next = !favorites.has(instrumentId)
            toggleFavorite(instrumentId)
            void setFavorite(instrumentId, next).catch(() => {
              toggleFavorite(instrumentId)
              showMenu({
                title: 'Favourite not updated',
                message: 'The server did not save that change. Try again.',
                options: [{ label: 'Got it' }],
              })
            })
          },
        },
      ],
    })
  }

  const renderItem = ({ item, index }: { item: Instrument; index: number }) => (
    <MarketGroupCell index={index} count={rows.length}>
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
        onLongPress={openRowMenu}
        showFavorite
      />
    </MarketGroupCell>
  )

  return (
    <Screen>
      <Gutter style={styles.titleRow}>
        <View>
          <Text variant="title">Markets</Text>
          {instruments.length > 0 ? (
            <View style={styles.subtitle}>
              <View style={styles.liveDot} />
              <Text variant="caption" color={colors.textMuted}>
                {instruments.length} instruments · live prices
              </Text>
            </View>
          ) : null}
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={filter === 'Favorites' ? 'Show all markets' : 'Show favourites'}
          hitSlop={8}
          onPress={() => setFilter((previous) => (previous === 'Favorites' ? 'All' : 'Favorites'))}
        >
          <StarIcon
            size={24}
            color={filter === 'Favorites' ? colors.gold : colors.text}
            filled={filter === 'Favorites'}
          />
        </Pressable>
      </Gutter>

      <Gutter style={styles.search}>
        <SearchField value={query} onChangeText={setQuery} />
      </Gutter>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.chips}
        style={styles.chipStrip}
      >
        {FILTERS.map((item) => {
          const selected = item === filter
          return (
            <Pressable
              key={item}
              accessibilityRole="tab"
              accessibilityLabel={item}
              accessibilityState={{ selected }}
              onPress={() => setFilter(item)}
              style={[styles.chip, selected ? styles.chipSelected : null]}
            >
              <Text style={[styles.chipLabel, selected ? styles.chipLabelSelected : null]}>
                {item}
              </Text>
            </Pressable>
          )
        })}
      </ScrollView>

      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={[sparkById, rows.length]}
        ItemSeparatorComponent={MarketGroupSeparator}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          catalogue.status === 'ready' ? (
            filter === 'Favorites' ? <NoFavorites /> : <Empty />
          ) : (
            <QueryStateView state={catalogue} render={() => null} />
          )
        }
        ListHeaderComponent={
          rows.length > 0 ? (
            <View>
              {showMovers ? (
                <View style={styles.movers}>
                  <Text variant="strong" style={styles.sectionTitle}>
                    Top movers
                  </Text>
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    contentContainerStyle={styles.moverStrip}
                    style={styles.moverScroller}
                  >
                    {movers.map((item) => (
                      <MoverCard
                        key={item.id}
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
                    ))}
                  </ScrollView>
                </View>
              ) : null}
              <View style={styles.sectionRow}>
                <Text variant="strong" style={styles.sectionTitle}>
                  {needle ? 'Results' : filter === 'All' ? 'All markets' : filter}
                </Text>
                <Text variant="caption" color={colors.textMuted}>
                  {rows.length}
                </Text>
              </View>
            </View>
          ) : null
        }
        ListFooterComponent={rows.length > 0 ? Hint : null}
      />
    </Screen>
  )
}

const keyExtractor = (item: Instrument) => item.id

const Empty = () => (
  <View style={styles.empty}>
    <Text variant="body" color={colors.textMuted}>
      No markets match that search.
    </Text>
  </View>
)

const NoFavorites = () => (
  <View style={styles.empty}>
    <Text variant="body" color={colors.textMuted}>
      No favourites yet — press and hold a market to add one.
    </Text>
  </View>
)

const Hint = () => (
  <Text variant="caption" color={colors.textSubtle} style={styles.hint}>
    Press and hold a market for quick actions
  </Text>
)

const styles = StyleSheet.create({
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 12,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 2,
  },
  liveDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
    backgroundColor: colors.green,
  },
  search: {
    marginTop: 16,
  },

  chipStrip: {
    flexGrow: 0,
    marginTop: 12,
  },
  chips: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 8,
  },
  chip: {
    height: 36,
    justifyContent: 'center',
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  chipSelected: {
    backgroundColor: colors.ink,
    borderColor: colors.ink,
  },
  chipLabel: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.text,
  },
  chipLabelSelected: {
    fontFamily: fonts.bold,
    color: colors.onInk,
  },

  movers: {
    gap: 12,
    paddingBottom: 18,
  },
  moverScroller: {
    // Bleeds to the screen edges; the list itself sits inside the gutter.
    marginHorizontal: -SCREEN_PADDING,
  },
  moverStrip: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: 4,
    gap: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 8,
    paddingBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
  },

  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  empty: {
    paddingTop: 48,
    paddingHorizontal: 24,
    alignItems: 'center',
  },
  hint: {
    textAlign: 'center',
    paddingTop: 18,
  },
})
