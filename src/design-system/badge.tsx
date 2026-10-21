import { useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, View } from 'react-native'

import { Text } from './text'
import { fonts, radius } from './tokens'

export type BadgeTone = 'buy' | 'sell' | 'neutral'

/** Small tinted pill: the Buy / Sell marker on a position row. */
export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  const labelColor = useThemeStyles(themeLabelColor)
  const tones = useThemeStyles(themeTones)

  return (
    <View style={[styles.base, tones[tone]]}>
      <Text style={[styles.label, { color: labelColor[tone] }]}>{children}</Text>
    </View>
  )
}

const themeLabelColor = (colors: Palette): Record<BadgeTone, string> => ({
  buy: colors.greenSoftText,
  sell: colors.redSoftText,
  neutral: colors.textMuted,
})

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 9,
    paddingVertical: 3,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
})

const themeTones = (colors: Palette) => (StyleSheet.create({
  buy: { backgroundColor: colors.greenSoft },
  sell: { backgroundColor: colors.redSoft },
  neutral: { backgroundColor: colors.track },
}))
