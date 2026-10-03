import { StyleSheet, View } from 'react-native'

import { Amount, AssetIcon, Badge, PressableScale, Text, colors } from '../../design-system'
import { formatLots, formatPrice, formatSignedMoney } from '../../data/format'
import { markPosition } from '../../data/live-quote'
import type { Instrument, Position } from '../../data/types'
import { useLiveQuote } from '../markets/use-live-quote'

/** Icon (40) plus the row's leading padding and gap. */
export const POSITION_ROW_DIVIDER_INSET = 68

/**
 * Compact open position for a list group: badge, side and size, live P&L.
 * Marks itself to its instrument's stream, so a tick re-renders this row alone.
 */
export function PositionRow({
  position,
  instrument,
  onPress,
}: {
  position: Position
  /** Absent when the price feed does not carry the market. */
  instrument?: Instrument
  onPress: () => void
}) {
  const quote = useLiveQuote(instrument && position.state === 'Open' ? position.instrumentId : undefined)
  const marked = markPosition(position, instrument, quote)
  const symbol = instrument?.symbol ?? position.instrumentId.replace(/^[^:]+:/, '').toUpperCase()
  const pnl = formatSignedMoney(marked.pnl)
  const tint = marked.pnl > 0.005 ? colors.green : marked.pnl < -0.005 ? colors.red : colors.textMuted

  return (
    <PressableScale
      onPress={onPress}
      scaleTo={0.99}
      accessibilityLabel={`${symbol}, ${marked.side} ${formatLots(marked.lots)}, P&L ${pnl}`}
    >
      <View style={styles.row}>
        <AssetIcon
          kind={instrument?.icon ?? 'generic'}
          label={instrument?.iconLabel}
          tint={instrument?.iconTint}
          symbol={symbol}
          category={instrument?.category}
          size={40}
        />
        <View style={styles.identity}>
          <View style={styles.titleRow}>
            <Text variant="strong" numberOfLines={1} style={styles.symbol}>
              {symbol}
            </Text>
            <Badge tone={marked.side === 'Buy' ? 'buy' : 'sell'}>{marked.side}</Badge>
          </View>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {formatLots(marked.lots)}
          </Text>
        </View>
        <View style={styles.trailing}>
          <Amount variant="strong" color={tint} numberOfLines={1} style={styles.tabular}>
            {pnl}
          </Amount>
          {instrument ? (
            <Text variant="caption" color={colors.textSubtle} numberOfLines={1} style={styles.tabular}>
              {formatPrice(marked.current, instrument.precision)}
            </Text>
          ) : null}
        </View>
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 68,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  symbol: {
    flexShrink: 1,
  },
  trailing: {
    alignItems: 'flex-end',
    gap: 2,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
})
