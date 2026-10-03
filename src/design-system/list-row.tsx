import { StyleSheet, View } from 'react-native'

import { Card } from './card'
import { colors } from './colors'
import { Divider } from './divider'
import { ChevronRightIcon } from './icons'
import { Pressable } from './pressable'
import { Text } from './text'
import { spacing } from './tokens'

export type ListRowProps = {
  icon?: React.ReactNode
  label: string
  /** Secondary line under the label. */
  detail?: string
  /** Right-aligned value shown before the chevron. */
  value?: string
  /** Replaces the chevron — a Switch, a badge, a tick. */
  trailing?: React.ReactNode
  onPress?: () => void
  /** Hairline below the row; omit on the last row of a group. */
  divider?: boolean
  destructive?: boolean
}

/** One line inside a `ListGroup`. */
export function ListRow({
  icon,
  label,
  detail,
  value,
  trailing,
  onPress,
  divider = true,
  destructive = false,
}: ListRowProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[label, value, detail].filter(Boolean).join('. ')}
        disabled={!onPress}
        onPress={onPress}
        style={styles.row}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}

        <View style={styles.text}>
          <Text style={[styles.label, destructive ? styles.destructive : null]}>{label}</Text>
          {detail ? (
            <Text variant="caption" color={colors.textMuted}>
              {detail}
            </Text>
          ) : null}
        </View>

        {value ? (
          <Text variant="body" color={colors.text} numberOfLines={1} style={styles.value}>
            {value}
          </Text>
        ) : null}

        {trailing ?? (onPress ? <ChevronRightIcon size={20} color={colors.textSubtle} /> : null)}
      </Pressable>

      {divider ? <Divider inset={icon ? 54 : 0} /> : null}
    </View>
  )
}

/** Card that groups a run of `ListRow`s. */
export function ListGroup({ children }: { children: React.ReactNode }) {
  return (
    <Card padded={false} style={styles.group}>
      {children}
    </Card>
  )
}

const styles = StyleSheet.create({
  group: {
    paddingHorizontal: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  icon: {
    width: 26,
    alignItems: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
    gap: 2,
  },
  value: {
    flexShrink: 1,
    maxWidth: '60%',
    textAlign: 'right',
  },
  label: {
    fontSize: 16,
    lineHeight: 21,
    color: colors.text,
  },
  destructive: {
    color: colors.red,
  },
})
