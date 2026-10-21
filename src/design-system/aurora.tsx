import { useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, View, type DimensionValue } from 'react-native'

/**
 * A deliberately quiet canvas. The earlier decorative gradients competed
 * with dense financial data, so branded colour now lives on purposeful cards.
 */
export function Aurora({ height = '100%' }: { height?: DimensionValue }) {
  const styles = useThemeStyles(themeStyles)

  return (
    <View pointerEvents="none" style={[styles.wrap, { height }]} />
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  wrap: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.bg,
  },
}))
