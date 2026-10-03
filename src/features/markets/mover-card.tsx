import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Card,
  DeltaPill,
  PressableScale,
  Sparkline,
  Text,
  colors,
  type AssetIconKind,
} from '../../design-system'
import { directionOf, formatPercent, formatPrice } from '../../data/format'
import { useLiveQuote } from './use-live-quote'

export type MoverCardProps = {
  id: string
  symbol: string
  name: string
  price: number
  precision: number
  changePercent: number
  /** The price the change is measured from; lets the live price recompute it. */
  changeBase?: number
  iconKind: AssetIconKind
  iconLabel?: string
  iconTint?: string
  category?: string
  spark: readonly number[]
  onPress: (id: string) => void
}

export const MOVER_CARD_WIDTH = 156

/**
 * One tile in the Markets "Top movers" strip: badge and change on top,
 * symbol and price, then the day's line across the full width.
 *
 * Takes primitives and streams its own price, like `MarketRow`.
 */
export function MoverCard({
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
  onPress,
}: MoverCardProps) {
  const quote = useLiveQuote(id)
  const price = quote?.price ?? snapshotPrice
  const changePercent = changeBase ? ((price - changeBase) / changeBase) * 100 : snapshotChange
  const direction = directionOf(changePercent)

  return (
    <PressableScale onPress={() => onPress(id)} scaleTo={0.97} accessibilityLabel={`${symbol}, ${name}`}>
      <Card style={styles.card}>
        <View style={styles.top}>
          <AssetIcon
            kind={iconKind}
            label={iconLabel}
            tint={iconTint}
            symbol={symbol}
            category={category}
            size={34}
          />
          <DeltaPill label={formatPercent(changePercent)} direction={direction} size={11} />
        </View>

        <View style={styles.identity}>
          <Text variant="strong" numberOfLines={1} style={styles.symbol}>
            {symbol}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.price}>
            {formatPrice(price, precision)}
          </Text>
        </View>

        <Sparkline
          points={spark}
          color={direction === 'up' ? colors.green : colors.red}
          width={MOVER_CARD_WIDTH - 28}
          height={38}
        />
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    width: MOVER_CARD_WIDTH,
    padding: 14,
    gap: 10,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identity: {
    gap: 1,
  },
  symbol: {
    fontSize: 16,
  },
  price: {
    fontVariant: ['tabular-nums'],
  },
})
