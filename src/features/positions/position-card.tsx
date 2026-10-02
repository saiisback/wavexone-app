import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Badge,
  Button,
  ButtonText,
  Card,
  Divider,
  MoreVerticalIcon,
  Pressable,
  PressableScale,
  Text,
  colors,
  type AssetIconKind,
} from '../../design-system'
import { formatLots, formatPrice, formatSignedMoney } from '../../data/format'

export type PositionCardProps = {
  id: string
  symbol: string
  description: string
  iconKind: AssetIconKind
  iconLabel?: string
  iconTint?: string
  side: 'Buy' | 'Sell'
  lots: number
  entry: number
  current: number
  precision: number
  pnl: number
  /** Copy on the footer button — "Close position", "Cancel order", … */
  actionLabel: string
  onAction: (id: string) => void
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
  side,
  lots,
  entry,
  current,
  precision,
  pnl,
  actionLabel,
  onAction,
  onMenu,
  onPress,
}: PositionCardProps) {
  return (
    <Card style={styles.card}>
      <PressableScale onPress={onPress} onLongPress={() => onMenu(id)} scaleTo={0.995}>
        <View style={styles.header}>
          <AssetIcon kind={iconKind} label={iconLabel} tint={iconTint} size={42} />
          <View style={styles.identity}>
            <Text variant="strong">{symbol}</Text>
            <Text variant="caption" color={colors.textMuted}>
              {description}
            </Text>
          </View>
          <Badge tone={side === 'Buy' ? 'buy' : 'sell'}>{side}</Badge>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`More actions for ${symbol}`}
            hitSlop={10}
            onPress={() => onMenu(id)}
          >
            <MoreVerticalIcon size={20} color={colors.text} />
          </Pressable>
        </View>
      </PressableScale>

      <Divider />

      <View style={styles.metrics}>
        <Metric value={formatLots(lots)} />
        <Metric value={formatPrice(entry, precision)} label="Entry" />
        <Metric value={formatPrice(current, precision)} label="Current" />
        <Metric
          value={formatSignedMoney(pnl)}
          label="P&L"
          tint={pnl < 0 ? colors.red : colors.green}
        />
      </View>

      <Button tone="track" onPress={() => onAction(id)}>
        <ButtonText tone="track">{actionLabel}</ButtonText>
      </Button>
    </Card>
  )
}

function Metric({ value, label, tint }: { value: string; label?: string; tint?: string }) {
  return (
    <View style={styles.metric}>
      <Text variant="strong" color={tint} style={styles.metricValue} numberOfLines={1}>
        {value}
      </Text>
      {label ? (
        <Text variant="caption" color={colors.textMuted} style={styles.metricLabel}>
          {label}
        </Text>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    padding: 16,
    borderRadius: 20,
    gap: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  identity: {
    flex: 1,
    gap: 3,
  },
  metrics: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  metric: {
    flex: 1,
    gap: 3,
  },
  metricValue: {
    fontSize: 16,
  },
  metricLabel: {
    fontSize: 13,
  },
})
