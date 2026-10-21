import { useTheme, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { BlurView } from 'expo-blur'
import { Platform, StyleSheet, View, type StyleProp, type ViewProps, type ViewStyle } from 'react-native'


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
  const fills = useThemeStyles(themeFills)
  const styles = useThemeStyles(themeStyles)
  const { scheme } = useTheme()

  const real = tint === 'frost' && blur && Platform.OS !== 'android'
  return (
    <View {...rest} style={[styles.base, real ? styles.frostOverBlur : fills[tint], style]}>
      {real ? <BlurView intensity={70} tint={scheme} style={styles.layer} /> : null}
      {children}
    </View>
  )
}

const themeStyles = (colors: Palette) => StyleSheet.create({
  base: {
    overflow: 'hidden',
    borderCurve: 'continuous',
  },
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
  frostOverBlur: {
    backgroundColor: colors.frost,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
})

const themeFills = (colors: Palette) => (StyleSheet.create({
  clear: { backgroundColor: colors.accent },
  frost: {
    backgroundColor: colors.frostStrong,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
  },
  accent: { backgroundColor: colors.royal },
}))
