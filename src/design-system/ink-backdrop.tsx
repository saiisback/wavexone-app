import { useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, View } from 'react-native'


/**
 * The feature-card surface: a solid American navy field. Branded colour is
 * reserved for high-value moments rather than diffused through the canvas.
 */
export function InkBackdrop(_props: { watermark?: boolean }) {
  const styles = useThemeStyles(themeStyles)

  return <View pointerEvents="none" style={styles.layer} />
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  // Below the content: web paints an absolutely placed layer above in-flow
  // siblings unless it is pushed back explicitly.
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
    backgroundColor: colors.royal,
  },
}))
