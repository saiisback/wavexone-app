import { StyleSheet, View } from 'react-native'

import {
  AssetIcon,
  DepositIcon,
  MoreVerticalIcon,
  Pressable,
  PressableScale,
  Text,
  WithdrawIcon,
  colors,
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

const ACTIVITY_ICON = 36
/** Icon plus the row's gap, so dividers start at the text. */
export const ACTIVITY_ROW_DIVIDER_INSET = ACTIVITY_ICON + 12

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
      <View style={styles.row}>
        <View style={[styles.icon, kind === 'trade' ? null : styles.fundingIcon]}>
          {kind === 'deposit' ? <DepositIcon size={20} color={colors.text} /> : null}
          {kind === 'withdrawal' ? <WithdrawIcon size={20} color={colors.text} /> : null}
          {kind === 'trade' && iconKind ? (
            <AssetIcon
              kind={iconKind}
              label={iconLabel}
              tint={iconTint}
              symbol={iconSymbol}
              category={iconCategory}
              size={36}
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
      </View>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    minHeight: 64,
    paddingVertical: 12,
  },
  icon: {
    width: ACTIVITY_ICON,
    height: ACTIVITY_ICON,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fundingIcon: {
    borderRadius: ACTIVITY_ICON / 2,
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
