import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { ScrollView, StyleSheet, TextInput, View } from 'react-native'

import {
  Gutter,
  Pressable,
  SCREEN_PADDING,
  Screen,
  SearchIcon,
  StarIcon,
  TAB_BAR_CLEARANCE,
  Text,
  colors,
  fonts,
  radius,
  useActionMenu,
} from '../design-system'
import { MarketRow } from '../features/markets/market-row'
import { useSession } from '../data/store'
import type { Instrument } from '../data/types'
import { useMarketData } from '../features/markets/use-market-data'
import { QueryStateView } from '../features/shared/query-state'
import { useAppNavigation } from '../navigation/use-app-navigation'

const FILTERS = ['Favorites', 'All', 'Forex', 'Metals', 'Crypto', 'Energy'] as const
type Filter = (typeof FILTERS)[number]

/**
 * Markets tab. Not in the supplied mockups — built from the same primitives
 * so it sits alongside Market Watch without introducing new visual rules.
 */
export function MarketsScreen() {
  const { openInstrument, openOrderTicket } = useAppNavigation()
  const showMenu = useActionMenu()
  const { catalogue, setFavorite } = useMarketData()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

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

  const renderItem = ({ item }: { item: Instrument }) => (
    <MarketRow
      id={item.id}
      symbol={item.symbol}
      name={item.name}
      price={item.price}
      precision={item.precision}
      changePercent={item.changePercent}
      iconKind={item.icon}
      iconLabel={item.iconLabel}
      iconTint={item.iconTint}
      spark={item.spark}
      sparkTone={item.sparkTone}
      onPress={openInstrument}
      onLongPress={openRowMenu}
      showFavorite
    />
  )

  return (
    <Screen>
      <Gutter style={styles.titleRow}>
        <Text variant="title">Markets</Text>
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
        <View style={styles.searchField}>
          <SearchIcon size={22} color={colors.text} />
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search markets"
            placeholderTextColor={colors.textMuted}
            style={styles.searchInput}
            returnKeyType="search"
            autoCorrect={false}
          />
        </View>
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
        ItemSeparatorComponent={Separator}
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
        ListFooterComponent={rows.length > 0 ? Hint : null}
      />
    </Screen>
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
  search: {
    marginTop: 18,
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
    padding: 0,
  },

  chipStrip: {
    flexGrow: 0,
    marginTop: 16,
  },
  chips: {
    paddingHorizontal: SCREEN_PADDING,
    gap: 8,
  },
  chip: {
    height: 40,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.track,
  },
  chipSelected: {
    backgroundColor: colors.gold,
  },
  chipLabel: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  chipLabelSelected: {
    fontFamily: fonts.bold,
  },

  list: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: 16,
    paddingBottom: TAB_BAR_CLEARANCE,
  },
  separator: {
    height: 14,
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
