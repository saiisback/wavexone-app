import { View, StyleSheet, type ViewProps } from 'react-native'

import { colors } from './colors'
import { radius, shadow, spacing } from './tokens'

export type CardProps = ViewProps & {
  /** `surface` is the white card, `ink` the navy one. */
  tone?: 'surface' | 'ink' | 'gold' | 'goldSoft'
  /** Set false when the card supplies its own padding (e.g. split layouts). */
  padded?: boolean
}

/** Rounded container used for every block on every screen. */
export function Card({ tone = 'surface', padded = true, style, ...rest }: CardProps) {
  return <View {...rest} style={[styles.base, tones[tone], padded ? styles.padded : null, style]} />
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.card,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  padded: {
    padding: spacing.xl,
  },
})

const tones = StyleSheet.create({
  surface: {
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    boxShadow: shadow.card,
  },
  ink: {
    backgroundColor: colors.ink,
  },
  gold: {
    backgroundColor: colors.gold,
  },
  goldSoft: {
    backgroundColor: colors.goldSoft,
  },
})
