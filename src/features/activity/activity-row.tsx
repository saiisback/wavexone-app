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
          <Text variant="strong" style={styles.title}>
            {title}
          </Text>
          <Text
            variant="caption"
            color={colors.textMuted}
            style={styles.subtitle}
            numberOfLines={1}
          >
            {subtitle}
          </Text>
        </View>

        <View style={styles.when}>
          <Text
            variant="caption"
            color={colors.textMuted}
            style={styles.whenText}
            numberOfLines={1}
          >
            {date}
          </Text>
          <Text
            variant="caption"
            color={colors.textMuted}
            style={styles.whenText}
            numberOfLines={1}
          >
            {time}
          </Text>
        </View>

        <Text
          variant="strong"
          color={amount < 0 ? colors.red : colors.green}
          style={styles.amount}
          numberOfLines={1}
        >
          {formatSignedMoney(amount)}
        </Text>

        <Pressable
          accessibilityRole="button"
          accessibilityLabel={`More actions for ${title}`}
          hitSlop={10}
          onPress={() => onMenu(id)}
        >
          <MoreVerticalIcon size={18} color={colors.text} />
        </Pressable>
      </Card>
    </PressableScale>
  )
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 14,
    paddingHorizontal: 12,
    borderRadius: radius.card,
  },
  icon: {
    width: 30,
    alignItems: 'center',
  },
  identity: {
    flex: 1,
    minWidth: 0,
    gap: 3,
  },
  title: {
    fontSize: 16,
  },
  subtitle: {
    fontSize: 13,
  },
  when: {
    width: 88,
    flexShrink: 0,
    gap: 3,
  },
  whenText: {
    fontSize: 13,
  },
  amount: {
    width: 82,
    fontSize: 16,
    textAlign: 'right',
  },
})
