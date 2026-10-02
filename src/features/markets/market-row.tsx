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
  type AssetIconKind,
} from '../../design-system'
import { directionOf, formatPercent, formatPrice } from '../../data/format'
import { useSession } from '../../data/store'

export type MarketRowProps = {
  id: string
  symbol: string
  name: string
  price: number
  precision: number
  changePercent: number
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
  price,
  precision,
  changePercent,
  iconKind,
  iconLabel,
  iconTint,
  spark,
  sparkTone,
  onPress,
  onLongPress,
  showFavorite = false,
}: MarketRowProps) {
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
        <AssetIcon kind={iconKind} label={iconLabel} tint={iconTint} size={40} />

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
    borderRadius: 20,
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
