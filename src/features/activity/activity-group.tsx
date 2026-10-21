import { useColors, useThemeStyles } from '../../design-system/theme'
import type { Palette } from '../../design-system/colors'
import { StyleSheet, View } from 'react-native'

import { Amount, Text, radius, spacing } from '../../design-system'
import { formatSignedMoney } from '../../data/format'

/**
 * The small day label over a run of rows — "Today", "Yesterday" — with the
 * day's count and net on the right, styled like an inset sticky header.
 */
export function ActivityDayHeader({ title, count, total }: { title: string; count: number; total?: number }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.header} accessibilityRole="header">
      <View style={styles.headerPill}>
        <Text variant="overline" weight="semibold" color={colors.text}>
          {title}
        </Text>
        <Text variant="overline" color={colors.textSubtle}>
          {`· ${count}`}
        </Text>
      </View>
      {total !== undefined && Math.abs(total) >= 0.005 ? (
        <Amount variant="overline" weight="semibold" color={total < 0 ? colors.red : colors.green}>
          {formatSignedMoney(total)}
        </Amount>
      ) : null}
    </View>
  )
}

/**
 * One row's slice of a day's white card. Rows in a virtualised list cannot
 * share a parent, so each draws its part: rounded top on the first, rounded
 * bottom on the last, a hairline between.
 */
export function ActivityGroupCell({
  first,
  last,
  children,
}: {
  first: boolean
  last: boolean
  children: React.ReactNode
}) {
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={[styles.cell, first ? styles.first : null, last ? styles.last : null]}>
      {children}
      {last ? null : <View style={styles.divider} />}
    </View>
  )
}

/** Matches the hairline ring in `shadow.card`. */
const EDGE = 'rgba(20, 24, 43, 0.06)'

const themeStyles = (colors: Palette) => (StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: spacing.xl,
    paddingBottom: spacing.sm,
    paddingHorizontal: spacing.xs,
  },
  headerPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.navyTint,
  },
  cell: {
    backgroundColor: colors.glass,
    borderCurve: 'continuous',
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderColor: EDGE,
  },
  first: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    paddingTop: spacing.xs,
  },
  last: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomLeftRadius: radius.card,
    borderBottomRightRadius: radius.card,
    paddingBottom: spacing.xs,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: spacing.lg + 44 + spacing.md,
    marginRight: spacing.lg,
    backgroundColor: colors.divider,
  },
}))
