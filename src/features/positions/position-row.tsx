import { StyleSheet, View } from 'react-native'

import { AssetIcon, Delta, PressableScale, Text, colors } from '../../design-system'
import { formatLots, formatSignedMoney, trendOf } from '../../data/format'
import { markPosition } from '../../data/live-quote'
import type { Instrument, Position } from '../../data/types'
import { useLiveQuote } from '../markets/use-live-quote'

/** Badge (36) plus the row's leading padding and gap. */
export const POSITION_ROW_DIVIDER_INSET = 62

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
          size={36}
        />
        <View style={styles.identity}>
          <Text variant="strong" numberOfLines={1}>
            {symbol}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            <Text variant="caption" weight="semibold" color={marked.side === 'Buy' ? colors.green : colors.red}>
              {marked.side}
            </Text>
            {` · ${formatLots(marked.lots)}`}
          </Text>
        </View>
        <Delta label={pnl} direction={trendOf(marked.pnl)} size={15} />
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 60,
    paddingVertical: 10,
    paddingHorizontal: 14,
  },
  identity: {
    flex: 1,
    gap: 1,
  },
})
