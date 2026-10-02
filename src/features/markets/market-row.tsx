import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Card,
  DeltaPill,
  PressableScale,
  Sparkline,
  StarIcon,
  Text,
  colors,
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
}: MarketRowProps) {
  // Streamed inside the row, so a tick re-renders this row alone.
  const quote = useLiveQuote(id)
  const price = quote?.price ?? snapshotPrice
  const changePercent = changeBase ? ((price - changeBase) / changeBase) * 100 : snapshotChange
  const direction = directionOf(changePercent)
  const sparkColor =
    (sparkTone ?? (direction === 'up' ? 'positive' : 'negative')) === 'positive'
      ? colors.green
      : colors.red

  return (
    <PressableScale
      onPress={() => onPress(id)}
      onLongPress={onLongPress ? () => onLongPress(id) : undefined}
      scaleTo={0.985}
    >
      <Card style={styles.card}>
        <View>
          <AssetIcon
            kind={iconKind}
            label={iconLabel}
            tint={iconTint}
            symbol={symbol}
            category={category}
            size={42}
          />
          {showFavorite ? <FavoriteMark id={id} /> : null}
        </View>

        <View style={styles.identity}>
          <Text variant="strong" numberOfLines={1}>
            {symbol}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {name}
          </Text>
        </View>

        {/* Keyed so a recycled row remounts rather than morphing from another market. */}
        <Sparkline key={id} points={spark} color={sparkColor} width={56} height={32} />

        <View style={styles.quote}>
          <Text variant="strong" numberOfLines={1} style={styles.price}>
            {formatPrice(price, precision)}
          </Text>
          <DeltaPill label={formatPercent(changePercent)} direction={direction} size={12} />
        </View>
      </Card>
    </PressableScale>
  )
}

/**
 * A star pinned to the badge's corner, so it costs the symbol no width.
 * Subscribes to a single id rather than the whole favourites set.
 */
function FavoriteMark({ id }: { id: string }) {
  const isFavorite = useSession((state) => state.favorites.has(id))
  if (!isFavorite) return null
  return (
    <View style={styles.favorite}>
      <StarIcon size={10} color={colors.gold} filled />
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 20,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  favorite: {
    position: 'absolute',
    right: -3,
    bottom: -3,
    width: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    boxShadow: '0px 1px 3px rgba(16, 24, 40, 0.18)',
  },
  quote: {
    minWidth: 84,
    alignItems: 'flex-end',
    gap: 6,
  },
  price: {
    fontVariant: ['tabular-nums'],
  },
})
