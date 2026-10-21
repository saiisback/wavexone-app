import { useColors, useThemeStyles } from '../design-system/theme'
import type { Palette } from '../design-system/colors'
import { FlashList } from '@shopify/flash-list'
import { useState } from 'react'
import { ScrollView, StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  Card,
  CircleButton,
  EmptyState,
  Gutter,
  HomeAtmosphere,
  LiveDot,
  PageBar,
  PageTitle,
  Reveal,
  SCREEN_PADDING,
  SearchField,
  SearchIcon,
  StarIcon,
  TAB_BAR_CLEARANCE,
  Text,
  radius,
  spacing,
  useActionMenu,
  useHeroScroll,
} from '../design-system'
import { useBackendQuery } from '../backend/provider'
import { CategoryChips } from '../features/markets/category-chips'
import { MarketRow } from '../features/markets/market-row'
import { MoverCard } from '../features/markets/mover-card'
import { useSession } from '../data/store'
import type { Instrument } from '../data/types'
import { applySparkSnapshot } from '../data/live-quote'
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

/** How many leading rows stagger in; the rest appear as they are scrolled to. */
const REVEAL_ROWS = 8

/**
 * Markets tab: a large title on the light canvas, search, category pills,
 * a strip of the day's top movers led by one featured card on the brand
 * gradient, then every market as a white row card. A frosted bar takes the
 * title over once the page scrolls.
 */
export function MarketsScreen() {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const { openInstrument, openOrderTicket } = useAppNavigation()
  const showMenu = useActionMenu()
  const { catalogue, setFavorite } = useMarketData()

  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('All')

  const { scrollY, onScrollJS } = useHeroScroll()
  const insets = useSafeAreaInsets()

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
  const instruments = catalogue.status === 'ready'
    ? catalogue.data.map((item) => applySparkSnapshot(item, sparkById?.get(item.id)))
    : []
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

  const renderItem = ({ item, index }: { item: Instrument; index: number }) => {
    const row = (
      <MarketRow
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
    )
    return (
      <View style={styles.cell}>
        {index < REVEAL_ROWS ? <Reveal index={index + 4} distance={12}>{row}</Reveal> : row}
      </View>
    )
  }

  const favoritesOnly = filter === 'Favorites'
  const header = (
    <View style={[styles.header, { paddingTop: insets.top + spacing.sm }]}>
      <HomeAtmosphere />
      <PageTitle
        scrollY={scrollY}
        title="Markets"
        tone="reference"
        style={styles.title}
        subtitle={
          instruments.length > 0 ? (
            <View style={styles.subtitle}>
              <LiveDot color={colors.green} size={7} />
              <Text variant="caption" color={colors.referenceMuted} numberOfLines={1}>
                {`${instruments.length} instruments · live`}
              </Text>
            </View>
          ) : undefined
        }
        trailing={
          <CircleButton
            size={44}
            tone={favoritesOnly ? 'gold' : 'outline'}
            accessibilityLabel={favoritesOnly ? 'Show all markets' : 'Show favourites'}
            onPress={() => setFilter((previous) => (previous === 'Favorites' ? 'All' : 'Favorites'))}
          >
            <StarIcon size={20} color={favoritesOnly ? colors.homePanel : colors.brand} filled={favoritesOnly} />
          </CircleButton>
        }
      />

      {/*
        No entrance animations in a FlashList header: on device, with live
        prices redrawing the screen, they never settle and the header stays
        invisible. The rows below keep theirs.
      */}
      <Gutter>
        {catalogue.status === 'ready' ? <QueryStateView state={catalogue} render={() => null} /> : null}
        <SearchField tone="light" value={query} onChangeText={setQuery} />
      </Gutter>

      <CategoryChips options={FILTERS} value={filter} onChange={setFilter} />

      <View style={styles.contentHeader}>
        {showMovers && rows.length > 0 ? (
        <View style={styles.movers}>
          <Gutter style={styles.sectionRow}>
            <Text variant="section">Top movers</Text>
            <Text variant="caption" color={colors.textMuted}>
              Biggest moves today
            </Text>
          </Gutter>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.moverStrip}>
            {movers.map((item, index) => (
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
                featured={index === 0}
              />
            ))}
          </ScrollView>
        </View>
        ) : null}

        {rows.length > 0 ? (
          <Gutter style={styles.listHead}>
            <Text variant="section">
              {needle ? 'Results' : filter === 'All' ? 'All markets' : filter}
            </Text>
            <View style={styles.count}>
              <Text variant="micro" weight="semibold" color={colors.textMuted}>
                {rows.length}
              </Text>
            </View>
          </Gutter>
        ) : null}
      </View>
    </View>
  )

  return (
    <View style={styles.root}>
      <FlashList
        data={rows}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        extraData={[sparkById, rows.length]}
        ItemSeparatorComponent={Separator}
        onScroll={onScrollJS}
        scrollEventThrottle={16}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={header}
        ListEmptyComponent={
          <View style={styles.emptyCell}>
            {catalogue.status === 'ready' ? (
              <Card padded={false}>{favoritesOnly ? <NoFavorites /> : <Empty />}</Card>
            ) : (
              <QueryStateView state={catalogue} render={() => null} />
            )}
          </View>
        }
        ListFooterComponent={<View style={styles.footer}>{rows.length > 0 ? <Hint /> : null}</View>}
      />
      <PageBar scrollY={scrollY} title="Markets" tone="reference" />
    </View>
  )
}

const keyExtractor = (item: Instrument) => item.id
const Separator = () => { const styles = useThemeStyles(themeStyles); return <View style={styles.separator} /> }

const Empty = () => { const colors = useColors(); return (
  <EmptyState
    icon={<SearchIcon size={22} color={colors.brand} />}
    title="No markets found"
    message="No markets match that search. Try a symbol such as EURUSD or a name such as Gold."
  />
)}

const NoFavorites = () => { const colors = useColors(); return (
  <EmptyState
    icon={<StarIcon size={22} color={colors.gold} filled />}
    title="No favourites yet"
    message="Press and hold a market to add it to your favourites."
  />
)}

const Hint = () => { const colors = useColors(); const styles = useThemeStyles(themeStyles); return (
  <Text variant="caption" color={colors.textSubtle} style={styles.hint}>
    Press and hold a market for quick actions
  </Text>
)}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.surface,
  },
  header: {
    position: 'relative',
    overflow: 'hidden',
    gap: spacing.lg,
    paddingBottom: 0,
  },
  contentHeader: {
    gap: spacing.lg,
    paddingTop: spacing.xl,
    paddingBottom: spacing.md,
    backgroundColor: colors.surface,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
  },
  title: {
    paddingBottom: 0,
  },
  subtitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 7,
    marginTop: 2,
  },
  movers: {
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  moverStrip: {
    paddingHorizontal: SCREEN_PADDING,
    paddingTop: spacing.xs,
    paddingBottom: spacing.lg,
    gap: spacing.md,
  },
  listHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: spacing.xs,
  },
  count: {
    minWidth: 26,
    height: 22,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
    backgroundColor: colors.brandTint,
  },

  cell: {
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: 'transparent',
  },
  separator: {
    height: 10,
    backgroundColor: colors.surface,
  },
  emptyCell: {
    paddingHorizontal: SCREEN_PADDING,
    backgroundColor: colors.surface,
  },
  footer: {
    paddingBottom: TAB_BAR_CLEARANCE,
    backgroundColor: colors.surface,
  },
  hint: {
    textAlign: 'center',
    paddingTop: 18,
  },
}))
