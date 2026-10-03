import { StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { ChevronRightIcon } from './icons'
import { Pressable } from './pressable'
import { Text } from './text'
import { fonts, radius } from './tokens'

const CHIP_FILL = {
  navy: colors.brandTint,
  blue: colors.tintBlue,
  violet: colors.tintViolet,
  amber: colors.tintAmber,
  mint: colors.tintMint,
  rose: colors.tintRose,
  gold: 'rgba(230, 190, 63, 0.18)',
  onInk: 'rgba(255, 255, 255, 0.14)',
  surface: colors.surface,
} as const

/** A tinted disc behind an icon: rows, tiles, empty states. */
export function IconChip({
  children,
  tone = 'navy',
  size = 40,
  shape = 'circle',
}: {
  children: React.ReactNode
  tone?: keyof typeof CHIP_FILL
  size?: number
  /** `square` is the rounded tile used beside list rows. */
  shape?: 'circle' | 'square'
}) {
  const round = shape === 'circle' ? size / 2 : size * 0.32
  return (
    <View style={[styles.chip, { width: size, height: size, borderRadius: round, backgroundColor: CHIP_FILL[tone] }]}>
      {children}
    </View>
  )
}

/** "Details ›" — a small tinted pill that leads somewhere else. */
export function PillLink({
  label,
  onPress,
  tone = 'light',
  accessibilityLabel,
}: {
  label: string
  onPress: () => void
  tone?: 'light' | 'onInk'
  accessibilityLabel?: string
}) {
  const ink = tone === 'onInk'
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      onPress={onPress}
      hitSlop={8}
      style={[styles.pill, ink ? styles.pillOnInk : styles.pillLight]}
    >
      <Text style={[styles.pillLabel, { color: ink ? colors.onInk : colors.text }]}>{label}</Text>
      <ChevronRightIcon size={14} color={ink ? colors.onInk : colors.textMuted} />
    </Pressable>
  )
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    justifyContent: 'center',
    borderCurve: 'continuous',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    height: 32,
    paddingLeft: 12,
    paddingRight: 8,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  pillLight: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pillOnInk: {
    backgroundColor: 'rgba(255, 255, 255, 0.14)',
  },
  pillLabel: {
    fontFamily: fonts.medium,
    fontSize: 13,
    lineHeight: 17,
  },
})
