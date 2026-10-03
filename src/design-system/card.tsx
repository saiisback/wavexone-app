import { StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { Glass, type GlassProps } from './glass'
import { radius, shadow, spacing } from './tokens'

export type CardProps = Omit<GlassProps, 'tone'> & {
  /**
   * `surface` is the white card; `ink` the luminous brand-gradient card;
   * `well` a flat inset panel inside another card; `tint` a soft brand fill.
   */
  tone?: 'surface' | 'ink' | 'well' | 'tint' | 'gold' | 'goldSoft'
  /** Set false when the card supplies its own padding (e.g. split layouts). */
  padded?: boolean
}

/**
 * A rounded block of content. On the pearl sheet that is a clean white card
 * with a soft shadow and no outline; `ink` is the navy hero with its glow,
 * and `blur` turns a card into frosted glass for content that floats.
 */
export function Card({ tone = 'surface', padded = true, blur, lifted = true, sheen, watermark, style, ...rest }: CardProps) {
  const padding = padded ? styles.padded : null
  if (tone === 'ink' || blur) {
    return (
      <Glass
        {...rest}
        tone={tone === 'ink' ? 'ink' : 'light'}
        blur={blur}
        lifted={lifted}
        sheen={sheen}
        watermark={watermark}
        style={[styles.base, padding, style]}
      />
    )
  }
  const flat = tone === 'well' || tone === 'tint'
  return <View {...rest} style={[styles.base, tones[tone], lifted && !flat ? styles.lifted : null, padding, style]} />
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
  lifted: {
    boxShadow: shadow.card,
  },
})

const tones = StyleSheet.create({
  // Glass: a near-opaque white pane with a bright rim, over the pastel canvas.
  surface: {
    backgroundColor: colors.glass,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  well: {
    backgroundColor: colors.well,
    borderRadius: radius.lg,
  },
  tint: {
    backgroundColor: colors.brandTint,
  },
  gold: {
    backgroundColor: colors.gold,
  },
  goldSoft: {
    backgroundColor: colors.goldSoft,
  },
})
