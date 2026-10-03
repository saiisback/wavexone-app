import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Badge,
  Button,
  ButtonText,
  Card,
  Delta,
  Divider,
  MoreVerticalIcon,
  Pressable,
  PressableScale,
  Text,
  colors,
  spacing,
  type AssetIconKind,
} from '../../design-system'
import { directionOf, formatLots, formatPrice, formatSignedMoney } from '../../data/format'

export type PositionCardProps = {
  id: string
  symbol: string
  description: string
  iconKind: AssetIconKind
  iconLabel?: string
  iconTint?: string
  /** "Stocks", "Forex", … — narrows the logo lookup. */
  category?: string
  side: 'Buy' | 'Sell'
  lots: number
  entry: number
  current: number
  precision: number
  pnl: number
  /** "Open" for a filled position, "Order price" for a pending one. */
  entryLabel?: string
  /** "Current" while open, "Closed at" once closed. */
  currentLabel?: string
  /** Copy on the footer button — "Close position", "Cancel order", … */
  actionLabel: string
  onAction: (id: string) => void
  /** Shown beside the action when the order can still be changed. */
  onModify?: (id: string) => void
  onMenu: (id: string) => void
  /** Opens the instrument. */
  onPress?: () => void
}

/** A single open / pending / closed position. */
export function PositionCard({
  id,
  symbol,
  description,
  iconKind,
  iconLabel,
  iconTint,
  category,
  side,
  lots,
  entry,
  current,
  precision,
  pnl,
  entryLabel = 'Open',
  currentLabel = 'Current',
  actionLabel,
  onAction,
  onModify,
  onMenu,
  onPress,
}: PositionCardProps) {
  return (
    <Card style={styles.card}>
      <PressableScale onPress={onPress} onLongPress={() => onMenu(id)} scaleTo={0.995}>
        <View style={styles.header}>
          <AssetIcon
            kind={iconKind}
            label={iconLabel}
            tint={iconTint}
            symbol={symbol}
            category={category}
            size={40}
          />
          <View style={styles.identity}>
            <View style={styles.titleRow}>
              <Text variant="strong" numberOfLines={1} style={styles.symbol}>
                {symbol}
              </Text>
              <Badge tone={side === 'Buy' ? 'buy' : 'sell'}>{side}</Badge>
            </View>
            <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
              {description}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${symbol}`}
            hitSlop={10}
            onPress={() => onMenu(id)}
            style={styles.more}
          >
            <MoreVerticalIcon size={20} color={colors.textMuted} />
          </Pressable>
        </View>
      </PressableScale>

      <View style={styles.pnlRow}>
        <View>
          <Text variant="caption" color={colors.textMuted}>
            P&amp;L
          </Text>
          <Delta label={formatSignedMoney(pnl)} direction={directionOf(pnl)} size={20} />
        </View>
        <Text variant="strong" style={styles.lots}>
          {formatLots(lots)}
        </Text>
      </View>

      <Divider />

      <View style={styles.metrics}>
        <Metric value={formatPrice(entry, precision)} label={entryLabel} />
        <Metric value={formatPrice(current, precision)} label={currentLabel} />
      </View>

      <View style={styles.actions}>
        <Button tone="track" onPress={() => onAction(id)} style={styles.action}>
          <ButtonText tone="track">{actionLabel}</ButtonText>
        </Button>
        {onModify ? (
          <Button tone="surface" onPress={() => onModify(id)} style={styles.action}>
            <ButtonText tone="surface">Modify</ButtonText>
          </Button>
        ) : null}
      </View>
    </Card>
  )
}

function Metric({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="caption" color={colors.textMuted}>
        {label}
      </Text>
      <Text variant="strong" style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    gap: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  identity: {
    flex: 1,
    gap: 2,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  symbol: {
    flexShrink: 1,
  },
  more: {
    minWidth: 32,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pnlRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
  },
  lots: {
    fontVariant: ['tabular-nums'],
  },
  metrics: {
    flexDirection: 'row',
  },
  metric: {
    flex: 1,
    gap: 2,
  },
  metricValue: {
    fontVariant: ['tabular-nums'],
  },
  actions: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  action: {
    flex: 1,
  },
})
