import { BlurView } from 'expo-blur'
import { Platform, StyleSheet, View, type ViewProps } from 'react-native'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import { colors } from './colors'
import { InkBackdrop } from './ink-backdrop'
import { shadow } from './tokens'

export type GlassTone = 'light' | 'onInk' | 'ink'

export type GlassProps = ViewProps & {
  /** `light` frosts the canvas, `onInk` frosts a navy surface, `ink` is the navy hero. */
  tone?: GlassTone
  /**
   * Real backdrop blur, for surfaces that float over moving content (tab
   * bar, docks). Costly, so lists and static panels leave it off — over the
   * soft canvas the translucent fill and sheen already read as glass.
   * Android has no backdrop target here and falls back to the fill.
   */
  blur?: boolean
  /** The light catching the top edge. */
  sheen?: boolean
  /** Lift off the page; off for glass nested inside another surface. */
  lifted?: boolean
  /** The brand "W" on navy; small cards leave it out. */
  watermark?: boolean
}

/**
 * The app's one surface: frosted glass with a highlight along its top edge
 * and a soft navy shadow. Cards, panels, bars and chips are all this.
 */
export function Glass({
  tone = 'light',
  blur = false,
  sheen = false,
  lifted = true,
  watermark = true,
  style,
  children,
  ...rest
}: GlassProps) {
  const blurred = blur && Platform.OS !== 'android'
  return (
    <View
      {...rest}
      style={[
        styles.base,
        tones[tone],
        blurred ? (tone === 'light' ? styles.blurredLight : styles.blurredOnInk) : null,
        lifted ? (tone === 'ink' ? styles.liftedInk : tone === 'light' ? styles.lifted : null) : null,
        style,
      ]}
    >
      {tone === 'ink' ? <InkBackdrop watermark={watermark} /> : null}
      {blurred ? (
        <BlurView
          intensity={tone === 'light' ? 40 : 30}
          tint={tone === 'light' ? 'light' : 'dark'}
          style={styles.blur}
        />
      ) : null}
      {sheen && tone !== 'ink' ? <Sheen tone={tone} /> : null}
      {children}
    </View>
  )
}

/** A white wash fading down from the top edge, as light on curved glass. */
function Sheen({ tone }: { tone: GlassTone }) {
  return (
    <View pointerEvents="none" style={styles.sheen}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id={`glass-sheen-${tone}`} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={tone === 'light' ? 0.7 : 0.14} />
            <Stop offset="1" stopColor="#FFFFFF" stopOpacity={0} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill={`url(#glass-sheen-${tone})`} />
      </Svg>
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderCurve: 'continuous',
    borderWidth: 1,
  },
  blur: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
  sheen: {
    zIndex: -1,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '55%',
  },
  lifted: {
    boxShadow: shadow.card,
  },
  liftedInk: {
    boxShadow: shadow.hero,
  },
  blurredLight: {
    backgroundColor: 'rgba(255, 255, 255, 0.66)',
  },
  blurredOnInk: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },
})

const tones = StyleSheet.create({
  light: {
    backgroundColor: colors.glass,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  onInk: {
    backgroundColor: colors.glassOnInk,
    borderColor: colors.glassOnInkEdge,
  },
  // Feature card: a plain white card, as in Stocks.
  ink: {
    backgroundColor: colors.glassStrong,
    borderColor: 'rgba(255, 255, 255, 0.95)',
  },
})
