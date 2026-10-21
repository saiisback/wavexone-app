import { useColors, useThemeStyles } from '../../design-system/theme'
import type { Palette } from '../../design-system/colors'
import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Card,
  DeltaPill,
  PressableScale,
  Sparkline,
  StarIcon,
  Text,
  TickFlash,
  radius,
  type AssetIconKind,
} from '../../design-system'
import { directionOf, formatPercent, formatPrice } from '../../data/format'
import { useSession } from '../../data/store'
import { useLiveQuote } from './use-live-quote'

export type MarketRowProps = {
  id: string
  symbol: string
  name: string
  price: number
  precision: number
  changePercent: number
  /**
   * The price the change is measured from (today's open, or the first close
   * of the chosen period); lets the live price recompute it.
   */
  changeBase?: number
  iconKind: AssetIconKind
  iconLabel?: string
  iconTint?: string
  /** "Stocks", "Forex", … — narrows the logo lookup. */
  category?: string
  spark: readonly number[]
  sparkTone?: 'positive' | 'negative'
  onPress: (id: string) => void
  onLongPress?: (id: string) => void
  /** Draws the favourite marker; off on Market Watch, on in the catalogue. */
  showFavorite?: boolean
  /**
   * `card` is a free-standing card; `row` is a flat, compact row that sits
   * on the page between hairline dividers.
   */
  layout?: 'card' | 'row'
  /** Names the press target where a row stands in for a plain button (the picker). */
  accessibilityLabel?: string
}

/**
 * One Market Watch row: badge, symbol, trend line, price and change.
 *
 * Receives primitives so the list can skip rows whose values are unchanged,
 * derives its colours locally rather than taking style objects as props, and
 * reads its own favourite flag from the store so toggling one row re-renders
 * that row alone.
 */
export function MarketRow({
  id,
  symbol,
  name,
  price: snapshotPrice,
  precision,
  changePercent: snapshotChange,
  changeBase,
  iconKind,
  iconLabel,
  iconTint,
  category,
  spark,
  sparkTone,
  onPress,
  onLongPress,
  showFavorite = false,
  layout = 'card',
  accessibilityLabel,
}: MarketRowProps) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  // Streamed inside the row, so a tick re-renders this row alone.
  const quote = useLiveQuote(id)
  const price = quote?.price ?? snapshotPrice
  const changePercent = changeBase ? ((price - changeBase) / changeBase) * 100 : snapshotChange
  const direction = directionOf(changePercent)
  const sparkColor =
    (sparkTone ?? (direction === 'up' ? 'positive' : 'negative')) === 'positive'
      ? colors.green
      : colors.red

  const compact = layout === 'row'
  const body = (
    <>
      <View style={[styles.tile, compact ? styles.tileCompact : null]}>
        <AssetIcon
          kind={iconKind}
          label={iconLabel}
          tint={iconTint}
          symbol={symbol}
          category={category}
          size={compact ? 32 : 34}
        />
        {showFavorite ? <FavoriteMark id={id} /> : null}
      </View>

      <View style={styles.identity}>
        {/* Shrinks a little before it truncates: long FX pairs on large-text phones. */}
        <Text variant="strong" numberOfLines={1} adjustsFontSizeToFit minimumFontScale={0.8}>
          {symbol}
        </Text>
        <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
          {name}
        </Text>
      </View>

      {/* Keyed so a recycled row remounts rather than morphing from another market. */}
      <Sparkline
        key={id}
        points={spark}
        color={sparkColor}
        width={compact ? 40 : 44}
        height={compact ? 24 : 28}
        strokeWidth={1.8}
        fillOpacity={0.16}
      />

      <View style={styles.quote}>
        <TickFlash value={price}>
          <Text variant="strong" numberOfLines={1} style={styles.price}>
            {formatPrice(price, precision)}
          </Text>
        </TickFlash>
        <DeltaPill label={formatPercent(changePercent)} direction={direction} size={12} />
      </View>
    </>
  )

  return (
    <PressableScale
      onPress={() => onPress(id)}
      onLongPress={onLongPress ? () => onLongPress(id) : undefined}
      scaleTo={compact ? 0.99 : 0.975}
      accessibilityLabel={accessibilityLabel}
    >
      {compact ? (
        <View style={[styles.layout, styles.row]}>{body}</View>
      ) : (
        <Card padded={false} style={[styles.layout, styles.card]}>{body}</Card>
      )}
    </PressableScale>
  )
}

/**
 * A star pinned to the badge's corner, so it costs the symbol no width.
 * Subscribes to a single id rather than the whole favourites set.
 */
function FavoriteMark({ id }: { id: string }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const isFavorite = useSession((state) => state.favorites.has(id))
  if (!isFavorite) return null
  return (
    <View style={styles.favorite}>
      <StarIcon size={11} color={colors.gold} filled />
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  layout: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  card: {
    paddingVertical: 14,
    paddingLeft: 12,
    paddingRight: 14,
    borderRadius: radius.xl,
  },
  row: {
    minHeight: 68,
    paddingVertical: 12,
  },
  /** A soft square tile behind the round mark, as on the reference rows. */
  tile: {
    width: 46,
    height: 46,
    borderRadius: 15,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.well,
  },
  tileCompact: {
    width: 42,
    height: 42,
    borderRadius: 14,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  favorite: {
    position: 'absolute',
    right: -5,
    top: -5,
    width: 20,
    height: 20,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.glass,
    boxShadow: '0px 2px 6px rgba(20, 24, 43, 0.16)',
  },
  quote: {
    minWidth: 76,
    flexShrink: 0,
    alignItems: 'flex-end',
    gap: 5,
  },
  price: {
    fontVariant: ['tabular-nums'],
  },
}))
