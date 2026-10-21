import { useThemeStyles } from './theme'
import type { Palette } from './colors'
import { useEffect } from 'react'
import { StyleSheet, View, type DimensionValue } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'

import { radius, spacing } from './tokens'

/** One placeholder shape. No spinner; the group breathes as a whole. */
export function SkeletonBlock({
  width,
  height,
  round = false,
}: {
  width: DimensionValue
  height: number
  round?: boolean
}) {
  const styles = useThemeStyles(themeStyles)

  return (
    <View
      testID="loading-skeleton-block"
      style={[styles.block, { width, height }, round ? { borderRadius: height / 2 } : null]}
    />
  )
}

/**
 * Placeholder shaped like the rows it stands in for — badge, two lines and a
 * trailing value — so the layout does not jump when the data lands. Pulses
 * gently while it waits.
 */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  const styles = useThemeStyles(themeStyles)

  const pulse = useSharedValue(1)
  useEffect(() => {
    pulse.set(withRepeat(withTiming(0.55, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true))
  }, [pulse])
  const breathing = useAnimatedStyle(() => ({ opacity: pulse.get() }))

  return (
    <Animated.View
      accessible
      accessibilityLabel="Loading"
      accessibilityState={{ busy: true }}
      style={[styles.rows, breathing]}
    >
      <SkeletonBlock width="38%" height={16} />
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <SkeletonBlock width={40} height={40} round />
          <View style={styles.lines}>
            <SkeletonBlock width="46%" height={13} />
            <SkeletonBlock width="70%" height={11} />
          </View>
          <SkeletonBlock width={64} height={22} />
        </View>
      ))}
    </Animated.View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  block: {
    backgroundColor: colors.track,
    borderRadius: radius.sm,
  },
  rows: {
    gap: spacing.lg,
    paddingVertical: spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  lines: {
    flex: 1,
    gap: 6,
  },
}))
