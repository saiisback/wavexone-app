import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Card,
  Delta,
  PressableScale,
  Sparkline,
  StarIcon,
  Text,
  colors,
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
        <AssetIcon kind={iconKind} label={iconLabel ?? symbol} tint={iconTint} size={40} />

        <View style={styles.identity}>
          <View style={styles.symbolRow}>
            <Text variant="strong" numberOfLines={1}>
              {symbol}
            </Text>
            {showFavorite ? <FavoriteMark id={id} /> : null}
          </View>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {name}
          </Text>
        </View>

        <Sparkline
          points={spark}
          color={sparkColor}
          gradientId={`spark-${id}`}
          width={68}
          height={40}
        />

        <View style={styles.quote}>
          <Text variant="strong">{formatPrice(price, precision)}</Text>
          <Delta label={formatPercent(changePercent)} direction={direction} size={15} />
        </View>
      </Card>
    </PressableScale>
  )
}

/** Subscribes to a single id rather than the whole favourites set. */
function FavoriteMark({ id }: { id: string }) {
  const isFavorite = useSession((state) => state.favorites.has(id))
  if (!isFavorite) return null
  return <StarIcon size={13} color={colors.gold} filled />
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.card,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  symbolRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  quote: {
    width: 88,
    alignItems: 'flex-end',
    gap: 5,
  },
})
