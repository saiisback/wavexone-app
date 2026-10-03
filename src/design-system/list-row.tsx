import { StyleSheet, View } from 'react-native'

import { Card } from './card'
import { colors } from './colors'
import { Divider } from './divider'
import { ChevronRightIcon } from './icons'
import { Pressable } from './pressable'
import { Text } from './text'
import { radius, spacing } from './tokens'

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
  /** A key-value line: shorter, muted label, emphasised value. */
  compact?: boolean
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
  compact = false,
}: ListRowProps) {
  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[label, value, detail].filter(Boolean).join('. ')}
        disabled={!onPress}
        onPress={onPress}
        style={[styles.row, compact ? styles.compactRow : null]}
      >
        {icon ? <View style={styles.icon}>{icon}</View> : null}

        <View style={styles.text}>
          <Text
            style={[styles.label, compact ? styles.compactLabel : null, destructive ? styles.destructive : null]}
          >
            {label}
          </Text>
          {detail ? (
            <Text variant="caption" color={colors.textMuted}>
              {detail}
            </Text>
          ) : null}
        </View>

        {value ? (
          <Text
            variant={compact ? 'strong' : 'body'}
            color={colors.text}
            numberOfLines={1}
            style={[styles.value, compact ? styles.compactValue : null]}
          >
            {value}
          </Text>
        ) : null}

        {trailing ?? (onPress ? <ChevronRightIcon size={20} color={colors.textSubtle} /> : null)}
      </Pressable>

      {divider ? <Divider inset={icon ? ICON_TILE + spacing.md : 0} /> : null}
    </View>
  )
}

/**
 * A run of `ListRow`s. `plain` (the default) lets menus and settings sit on
 * the page with hairlines between rows; `card` keeps a surface for form
 * fields inside sheets.
 */
export function ListGroup({
  variant = 'plain',
  title,
  children,
}: {
  variant?: 'plain' | 'card'
  /** Small caps label above the group: "ACCOUNT", "SECURITY". */
  title?: string
  children: React.ReactNode
}) {
  return (
    <View>
      {title ? (
        <Text variant="overline" color={colors.textSubtle} style={styles.title}>
          {title}
        </Text>
      ) : null}
      {variant === 'plain' ? children : (
        <Card padded={false} style={styles.group}>
          {children}
        </Card>
      )}
    </View>
  )
}

/** The rounded tile a row's icon sits on. */
const ICON_TILE = 36

const styles = StyleSheet.create({
  group: {
    paddingHorizontal: spacing.lg,
  },
  title: {
    paddingBottom: spacing.xs,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 56,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  icon: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
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
  compactRow: {
    minHeight: 44,
    paddingVertical: spacing.sm,
  },
  compactLabel: {
    fontSize: 15,
    color: colors.textMuted,
  },
  compactValue: {
    fontSize: 15,
    fontVariant: ['tabular-nums'],
  },
})
