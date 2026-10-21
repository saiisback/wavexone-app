import { useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, View } from 'react-native'


/**
 * A quiet brand-tinted hero field. It is intentionally static: content and
 * live prices provide the motion, while the chrome stays composed.
 */
export function LiquidBackdrop() {
  const styles = useThemeStyles(themeStyles)

  return (
    <View pointerEvents="none" style={styles.layer}>
      <View style={styles.band} />
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
    overflow: 'hidden',
    backgroundColor: colors.brandTint,
  },
  band: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 6,
    backgroundColor: colors.gold,
  },
}))
