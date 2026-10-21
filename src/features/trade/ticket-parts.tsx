import { useColors, useThemeStyles } from '../../design-system/theme'
import type { Palette } from '../../design-system/colors'
import { StyleSheet, View } from 'react-native'

import { PopIn, PressableScale, Text, radius, shadow, spacing } from '../../design-system'

/**
 * Building blocks shared by the Trade tab and the order sheets: the centred
 * intro of a sheet, the big lot stepper and key-value summary rows.
 */

/**
 * The top of a confirmation sheet: the instrument on a disc inside a soft
 * brand ring, then a centred title and subtitle. `children` sits under the
 * subtitle (a side badge, a live price pill).
 */
export function SheetIntro({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode
  title: string
  subtitle?: string
  children?: React.ReactNode
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.intro}>
      <PopIn>
        <View style={styles.discRing}>
          <View style={styles.disc}>{icon}</View>
        </View>
      </PopIn>
      <View style={styles.introText}>
        <Text variant="heading" style={styles.centred} accessibilityRole="header">
          {title}
        </Text>
        {subtitle ? (
          <Text variant="caption" color={colors.textMuted} style={styles.centred}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {children ? <View style={styles.introExtras}>{children}</View> : null}
    </View>
  )
}

/**
 * Round − / + buttons either side of a large lots figure. The labels match
 * every other volume control in the app ("Decrease volume").
 */
export function LotStepper({
  lots,
  unit,
  onDecrease,
  onIncrease,
  compact = false,
}: {
  /** The figure alone, e.g. "0.50". */
  lots: string
  /** "lots" or "lot". */
  unit: string
  onDecrease: () => void
  onIncrease: () => void
  /** A smaller figure for sheets. */
  compact?: boolean
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.stepper}>
      <StepButton kind="minus" accessibilityLabel="Decrease volume" onPress={onDecrease} compact={compact} />
      <View style={styles.lots}>
        <Text
          variant={compact ? 'displaySm' : 'display'}
          numberOfLines={1}
          adjustsFontSizeToFit
          style={compact ? null : styles.lotsFigure}
        >
          {lots}
        </Text>
        <Text variant="caption" weight="medium" color={colors.textMuted}>
          {unit}
        </Text>
      </View>
      <StepButton kind="plus" accessibilityLabel="Increase volume" onPress={onIncrease} compact={compact} />
    </View>
  )
}

function StepButton({
  kind,
  accessibilityLabel,
  onPress,
  compact,
}: {
  kind: 'minus' | 'plus'
  accessibilityLabel: string
  onPress: () => void
  compact: boolean
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const plus = kind === 'plus'
  const size = compact ? 48 : 56
  const glyph = plus ? colors.white : colors.brand
  return (
    <PressableScale accessibilityLabel={accessibilityLabel} onPress={onPress} scaleTo={0.86} hitSlop={4}>
      <View
        style={[
          styles.step,
          { width: size, height: size, borderRadius: size / 2 },
          plus ? styles.stepPlus : styles.stepMinus,
        ]}
      >
        <View style={[styles.bar, { backgroundColor: glyph }]} />
        {plus ? <View style={[styles.bar, styles.barVertical, { backgroundColor: glyph }]} /> : null}
      </View>
    </PressableScale>
  )
}

/** A label on the left and its value on the right, optionally on a well. */
export function KeyValueRow({
  label,
  value,
  tint,
  leading,
  well = false,
}: {
  label: string
  value: string
  /** Colours the value: red when it breaks a limit. */
  tint?: string
  /** A dot or icon before the value. */
  leading?: React.ReactNode
  /** Sets the row on a soft inset well, for the figure that matters most. */
  well?: boolean
}) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={[styles.row, well ? styles.rowWell : null]}>
      <Text variant="body" color={colors.textMuted} style={styles.rowLabel}>
        {label}
      </Text>
      <View style={styles.rowValue}>
        {leading}
        <Text variant="strong" color={tint} numberOfLines={1} style={styles.tabular}>
          {value}
        </Text>
      </View>
    </View>
  )
}

const DISC = 76
const RING = 10

const themeStyles = (colors: Palette) => (StyleSheet.create({
  intro: {
    alignItems: 'center',
    gap: spacing.md,
    paddingTop: spacing.xs,
    paddingBottom: spacing.sm,
  },
  discRing: {
    width: DISC + RING * 2,
    height: DISC + RING * 2,
    borderRadius: (DISC + RING * 2) / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.brandTint,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surface,
    boxShadow: shadow.raised,
  },
  introText: {
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: spacing.lg,
  },
  centred: {
    textAlign: 'center',
  },
  introExtras: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
  },
  step: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  stepMinus: {
    backgroundColor: colors.brandTint,
  },
  stepPlus: {
    backgroundColor: colors.royal,
    boxShadow: '0px 8px 18px rgba(20, 24, 43, 0.24)',
  },
  bar: {
    position: 'absolute',
    width: 18,
    height: 2.2,
    borderRadius: 1.1,
  },
  barVertical: {
    width: 2.2,
    height: 18,
  },
  lots: {
    flex: 1,
    alignItems: 'center',
    gap: 0,
  },
  lotsFigure: {
    fontSize: 44,
    lineHeight: 52,
    letterSpacing: -1.6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    minHeight: 44,
  },
  rowWell: {
    paddingHorizontal: spacing.md,
    marginHorizontal: -spacing.md,
    borderRadius: radius.md,
    borderCurve: 'continuous',
    backgroundColor: colors.well,
  },
  rowLabel: {
    flexShrink: 0,
  },
  rowValue: {
    flexShrink: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  tabular: {
    fontVariant: ['tabular-nums'],
  },
}))
