import { StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { Text } from './text'
import { fonts, radius } from './tokens'

export type BadgeTone = 'buy' | 'sell' | 'neutral'

/** Small tinted pill: the Buy / Sell marker on a position row. */
export function Badge({ tone, children }: { tone: BadgeTone; children: React.ReactNode }) {
  return (
    <View style={[styles.base, tones[tone]]}>
      <Text style={[styles.label, { color: labelColor[tone] }]}>{children}</Text>
    </View>
  )
}

const labelColor: Record<BadgeTone, string> = {
  buy: colors.greenSoftText,
  sell: colors.redSoftText,
  neutral: colors.textMuted,
}

const styles = StyleSheet.create({
  base: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.sm,
    borderCurve: 'continuous',
  },
  label: {
    fontFamily: fonts.semibold,
    fontSize: 12,
    lineHeight: 16,
  },
})

const tones = StyleSheet.create({
  buy: { backgroundColor: colors.greenSoft },
  sell: { backgroundColor: colors.redSoft },
  neutral: { backgroundColor: colors.track },
})
