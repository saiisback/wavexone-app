import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StatusBar } from 'expo-status-bar'
import { StyleSheet, View } from 'react-native'

import { InkBackdrop } from './ink-backdrop'
import { Logo } from './logo'
import { LiveDot, PopIn } from './motion'
import { Text } from './text'
import { spacing } from './tokens'

/**
 * Full-screen brand moment shown while the app restores its session: the
 * luminous gradient, the logo springing in and a breathing status line.
 */
export function BrandSplash({ message }: { message: string }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <InkBackdrop />
      <PopIn>
        <Logo size={30} />
      </PopIn>
      <View style={styles.status} accessibilityLiveRegion="polite">
        <LiveDot color={colors.accentDeep} size={7} />
        <Text variant="caption" color={colors.onInkMuted}>
          {message}
        </Text>
      </View>
    </View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  root: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
    backgroundColor: colors.surface,
  },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
}))
