import { createContext, useContext } from 'react'
import { StyleSheet, View } from 'react-native'

import { Card } from './card'
import { colors } from './colors'
import { Divider } from './divider'
import { ChevronRightIcon } from './icons'
import { Pressable } from './pressable'
import { Text } from './text'
import { fonts, radius, spacing } from './tokens'

/** Soft fills for a row's icon tile; `navy` is the brand tint. */
const TILE_FILL = {
  navy: colors.brandTint,
  blue: colors.tintBlue,
  violet: colors.tintViolet,
  amber: colors.tintAmber,
  mint: colors.tintMint,
  rose: colors.tintRose,
} as const

export type ListRowTone = keyof typeof TILE_FILL

export type ListRowProps = {
  icon?: React.ReactNode
  /** Fill behind the icon tile. Defaults to the brand tint (rose when destructive). */
  tone?: ListRowTone
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

/**
 * Horizontal padding the enclosing group gives its rows. Rows own the
 * padding (rather than the card) so the press highlight runs edge to edge.
 */
const GroupInset = createContext(0)

/** One line inside a `ListGroup`. */
export function ListRow({
  icon,
  tone,
  label,
  detail,
  value,
  trailing,
  onPress,
  divider = true,
  destructive = false,
  compact = false,
}: ListRowProps) {
  const inset = useContext(GroupInset)
  const fill = TILE_FILL[tone ?? (destructive ? 'rose' : 'navy')]

  return (
    <View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={[label, value, detail].filter(Boolean).join('. ')}
        disabled={!onPress}
        onPress={onPress}
        style={({ pressed }) => [
          styles.row,
          { paddingHorizontal: inset },
          compact ? styles.compactRow : null,
          pressed && onPress ? styles.pressed : null,
        ]}
      >
        {icon ? <View style={[styles.icon, { backgroundColor: fill }]}>{icon}</View> : null}

        <View style={styles.text}>
          <Text
            numberOfLines={detail ? 1 : 2}
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
            color={compact ? colors.text : colors.textMuted}
            numberOfLines={1}
            style={[styles.value, compact ? styles.compactValue : null]}
          >
            {value}
          </Text>
        ) : null}

        {trailing ?? (onPress ? <ChevronRightIcon size={18} color={colors.textSubtle} /> : null)}
      </Pressable>

      {divider ? (
        <View style={{ marginRight: inset }}>
          <Divider inset={inset + (icon ? ICON_TILE + spacing.md : 0)} />
        </View>
      ) : null}
    </View>
  )
}

/**
 * A run of `ListRow`s on one white card (`card`, the default), or straight
 * on the page (`plain`) where the rows already sit inside another surface.
 */
export function ListGroup({
  variant = 'card',
  title,
  children,
}: {
  variant?: 'plain' | 'card'
  /** Small label above the group: "Account", "Security". */
  title?: string
  children: React.ReactNode
}) {
  return (
    <View>
      {title ? (
        <Text variant="overline" color={colors.textMuted} style={styles.title}>
          {title.toUpperCase()}
        </Text>
      ) : null}
      {variant === 'plain' ? children : (
        <GroupInset.Provider value={spacing.lg}>
          <Card padded={false} style={styles.group}>
            {children}
          </Card>
        </GroupInset.Provider>
      )}
    </View>
  )
}

/** The rounded tile a row's icon sits on. */
const ICON_TILE = 40

const styles = StyleSheet.create({
  group: {
    paddingVertical: spacing.xs,
  },
  title: {
    paddingBottom: spacing.sm + 2,
    paddingLeft: spacing.xs,
    letterSpacing: 0.8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 60,
    paddingVertical: spacing.md,
    gap: spacing.md,
  },
  pressed: {
    backgroundColor: colors.well,
  },
  icon: {
    width: ICON_TILE,
    height: ICON_TILE,
    borderRadius: radius.md - 1,
    borderCurve: 'continuous',
    alignItems: 'center',
    justifyContent: 'center',
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
    fontFamily: fonts.medium,
    fontSize: 15.5,
    lineHeight: 20,
    letterSpacing: -0.15,
    color: colors.text,
  },
  destructive: {
    color: colors.red,
  },
  compactRow: {
    minHeight: 48,
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
