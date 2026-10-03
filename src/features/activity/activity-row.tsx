import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  Card,
  DepositIcon,
  MoreVerticalIcon,
  Pressable,
  PressableScale,
  Text,
  WithdrawIcon,
  colors,
  radius,
  type AssetIconKind,
} from '../../design-system'
import { formatSignedMoney } from '../../data/format'

export type ActivityRowProps = {
  id: string
  kind: 'trade' | 'deposit' | 'withdrawal'
  title: string
  subtitle: string
  date: string
  time: string
  amount: number
  iconKind?: AssetIconKind
  iconLabel?: string
  iconTint?: string
  /** The traded instrument's ticker and category, for its logo. */
  iconSymbol?: string
  iconCategory?: string
  onMenu: (id: string) => void
}

/** One line of history: a closed trade, a deposit or a withdrawal. */
export function ActivityRow({
  id,
  kind,
  title,
  subtitle,
  date,
  time,
  amount,
  iconKind,
  iconLabel,
  iconTint,
  iconSymbol,
  iconCategory,
  onMenu,
}: ActivityRowProps) {
  return (
    <PressableScale onPress={() => onMenu(id)} scaleTo={0.99}>
      <Card style={styles.card}>
        <View style={styles.icon}>
          {kind === 'deposit' ? <DepositIcon size={26} color={colors.text} /> : null}
          {kind === 'withdrawal' ? <WithdrawIcon size={26} color={colors.text} /> : null}
          {kind === 'trade' && iconKind ? (
            <AssetIcon
              kind={iconKind}
              label={iconLabel}
              tint={iconTint}
              symbol={iconSymbol}
              category={iconCategory}
              size={30}
            />
          ) : null}
        </View>

        <View style={styles.identity}>
          <Text variant="strong" numberOfLines={1}>
            {title}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {subtitle}
          </Text>
        </View>

        <View style={styles.trailing}>
          <Text
            variant="strong"
            color={amount < 0 ? colors.red : colors.green}
            style={styles.amount}
            numberOfLines={1}
          >
            {formatSignedMoney(amount)}
          </Text>
          <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
            {[date, time].filter(Boolean).join(' · ')}
          </Text>
        </View>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${title}`}
          hitSlop={10}
          onPress={() => onMenu(id)}
          style={styles.more}
        >
          <MoreVerticalIcon size={18} color={colors.textMuted} />
        </Pressable>
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingLeft: 14,
    paddingRight: 6,
    borderRadius: radius.card,
  },
  icon: {
    width: 32,
    alignItems: 'center',
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  trailing: {
    flexShrink: 0,
    maxWidth: '45%',
    alignItems: 'flex-end',
    gap: 2,
  },
  amount: {
    fontVariant: ['tabular-nums'],
  },
  more: {
    minWidth: 28,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
})
