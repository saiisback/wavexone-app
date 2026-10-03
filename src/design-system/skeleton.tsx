import { StyleSheet, View, type DimensionValue } from 'react-native'

import { colors } from './colors'
import { radius, spacing } from './tokens'

/** One placeholder shape. Static on purpose: no spinner, no shimmer loop. */
export function SkeletonBlock({
  width,
  height,
  round = false,
}: {
  width: DimensionValue
  height: number
  round?: boolean
}) {
  return (
    <View
      testID="loading-skeleton-block"
      style={[styles.block, { width, height }, round ? { borderRadius: height / 2 } : null]}
    />
  )
}

/**
 * Placeholder shaped like the rows it stands in for — badge, two lines and a
 * trailing value — so the layout does not jump when the data lands.
 */
export function SkeletonRows({ count = 3 }: { count?: number }) {
  return (
    <View accessible accessibilityLabel="Loading" accessibilityState={{ busy: true }} style={styles.rows}>
      <SkeletonBlock width="38%" height={16} />
      {Array.from({ length: count }, (_, index) => (
        <View key={index} style={styles.row}>
          <SkeletonBlock width={36} height={36} round />
          <View style={styles.lines}>
            <SkeletonBlock width="46%" height={13} />
            <SkeletonBlock width="70%" height={11} />
          </View>
          <SkeletonBlock width={64} height={20} />
        </View>
      ))}
    </View>
  )
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.navySoft,
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
})
