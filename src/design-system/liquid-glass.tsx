import { BlurView } from 'expo-blur'
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native'

import { colors } from './colors'

/**
 * Apple-style controls. `clear` is the quiet grey disc of a Wallet action
 * button, `frost` the translucent material of a floating bar (real blur on
 * iOS and web, a denser fill on Android), `accent` the solid brand navy for
 * the one key control on a screen.
 */
export function LiquidGlass({
  tint = 'clear',
  blur = true,
  style,
  children,
  ...rest
}: ViewProps & {
  tint?: 'clear' | 'frost' | 'accent'
  blur?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const real = tint === 'frost' && blur && Platform.OS !== 'android'
  return (
    <View {...rest} style={[styles.base, real ? styles.frostOverBlur : fills[tint], style]}>
      {real ? <BlurView intensity={70} tint="light" style={styles.layer} /> : null}
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
  frostOverBlur: {
    backgroundColor: 'rgba(255, 255, 255, 0.82)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.14)',
  },
})

const fills = StyleSheet.create({
  clear: { backgroundColor: colors.accent },
  frost: {
    backgroundColor: 'rgba(255, 255, 255, 0.96)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(60, 60, 67, 0.14)',
  },
  accent: { backgroundColor: colors.brand },
})
