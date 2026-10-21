import { useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'

import { radius, shadow, spacing } from './tokens'

/**
 * The account card keeps a familiar physical-card proportion, but uses one
 * confident brand surface instead of glass effects. The quiet gold rail is
 * the only decorative detail and makes the card recognisably WaveXOne.
 */
export function WalletCard({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={[styles.card, style]}>
      <View pointerEvents="none" style={styles.goldRail} />
      <View pointerEvents="none" style={styles.brandField} />
      {children}
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  card: {
    aspectRatio: 1.586,
    width: '100%',
    padding: spacing.xl,
    justifyContent: 'space-between',
    overflow: 'hidden',
    borderRadius: radius.xl,
    borderCurve: 'continuous',
    backgroundColor: colors.royal,
    boxShadow: shadow.hero,
  },
  goldRail: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    width: 4,
    backgroundColor: colors.gold,
  },
  brandField: {
    position: 'absolute',
    width: 230,
    height: 230,
    borderRadius: 115,
    right: -105,
    bottom: -135,
    backgroundColor: 'rgba(255, 255, 255, 0.045)',
  },
}))
