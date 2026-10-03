import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Card,
  Delta,
  DeltaPill,
  PressableScale,
  Sparkline,
  Text,
  TickFlash,
  colors,
  radius,
  spacing,
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
  /**
   * Draws the card on the luminous brand gradient: the one featured mover
   * at the head of a strip.
   */
  featured?: boolean
}

export const MOVER_CARD_WIDTH = 168
const SPARK_HEIGHT = 54

/**
 * One tile in a "Top movers" or watchlist strip: the mark and the change on
 * top, symbol and live price, then the day's line running edge to edge
 * along the foot of the card.
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
  featured = false,
}: MoverCardProps) {
  const quote = useLiveQuote(id)
  const price = quote?.price ?? snapshotPrice
  const changePercent = changeBase ? ((price - changeBase) / changeBase) * 100 : snapshotChange
  const direction = directionOf(changePercent)
  const change = formatPercent(changePercent)
  const line = direction === 'up' ? colors.green : colors.red

  return (
    <PressableScale onPress={() => onPress(id)} scaleTo={0.96} accessibilityLabel={`${symbol}, ${name}`}>
      <Card tone={featured ? 'ink' : 'surface'} padded={false} watermark={false} style={styles.card}>
        <View style={styles.body}>
          <View style={styles.top}>
            <View style={[styles.mark, featured ? styles.markOnInk : null]}>
              <AssetIcon
                kind={iconKind}
                label={iconLabel}
                tint={iconTint}
                symbol={symbol}
                category={category}
                size={30}
              />
            </View>
            {featured ? (
              <View style={styles.pillOnInk}>
                <Delta label={change} direction={direction} onInk size={11} />
              </View>
            ) : (
              <DeltaPill label={change} direction={direction} size={11} />
            )}
          </View>

          <View style={styles.identity}>
            <Text
              variant="caption"
              weight="medium"
              color={featured ? colors.onInkMuted : colors.textMuted}
              numberOfLines={1}
            >
              {symbol}
            </Text>
            <TickFlash value={price}>
              <Text
                variant="strong"
                color={featured ? colors.onInk : colors.text}
                numberOfLines={1}
                adjustsFontSizeToFit
                style={styles.price}
              >
                {formatPrice(price, precision)}
              </Text>
            </TickFlash>
          </View>
        </View>

        <Sparkline
          points={spark}
          color={line}
          width={MOVER_CARD_WIDTH}
          height={SPARK_HEIGHT}
          strokeWidth={2}
          fillOpacity={featured ? 0.34 : 0.2}
        />
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    width: MOVER_CARD_WIDTH,
    borderRadius: radius.card,
  },
  body: {
    paddingTop: spacing.lg,
    paddingHorizontal: spacing.lg,
    gap: spacing.md,
  },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 13,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.well,
  },
  markOnInk: {
    backgroundColor: colors.onInkPanel,
  },
  pillOnInk: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.glassOnInk,
  },
  identity: {
    gap: 1,
  },
  price: {
    fontSize: 19,
    lineHeight: 24,
    letterSpacing: -0.4,
    fontVariant: ['tabular-nums'],
  },
})
