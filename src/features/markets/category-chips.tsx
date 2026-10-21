import { useColors, useThemeStyles } from '../../design-system/theme'
import type { Palette } from '../../design-system/colors'
import { useEffect } from 'react'
import { ScrollView, StyleSheet } from 'react-native'
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { Pressable, SCREEN_PADDING, fonts, motion, radius, shadow } from '../../design-system'

/**
 * A horizontal strip of category pills. White at rest; the selected pill
 * fills near-black and its label turns white, eased rather than
 * swapped, with a small settle in scale.
 */
export function CategoryChips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}) {
  const styles = useThemeStyles(themeStyles)

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      style={styles.scroller}
    >
      {options.map((option) => (
        <Chip key={option} label={option} selected={option === value} onPress={() => onChange(option)} />
      ))}
    </ScrollView>
  )
}

function Chip({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  const on = useSharedValue(selected ? 1 : 0)
  const bump = useSharedValue(1)
  useEffect(() => {
    on.set(withTiming(selected ? 1 : 0, { duration: motion.base }))
    if (selected) {
      bump.set(0.94)
      bump.set(withSpring(1, motion.spring))
    }
  }, [selected, on, bump])

  const fill = useAnimatedStyle(() => ({
    backgroundColor: interpolateColor(on.get(), [0, 1], [colors.surface, colors.gold]),
    transform: [{ scale: bump.get() }],
  }))
  const ink = useAnimatedStyle(() => ({
    color: interpolateColor(on.get(), [0, 1], [colors.textMuted, colors.homePanel]),
  }))

  return (
    <Pressable
      accessibilityRole="tab"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      onPress={onPress}
      hitSlop={4}
    >
      <Animated.View
        style={[styles.chip, selected ? styles.chipSelected : styles.chipRest, fill, selected ? styles.selectedFill : null]}
      >
        <Animated.Text style={[styles.label, selected ? styles.labelSelected : null, ink]}>{label}</Animated.Text>
      </Animated.View>
    </Pressable>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  scroller: {
    flexGrow: 0,
  },
  strip: {
    paddingHorizontal: SCREEN_PADDING,
    paddingVertical: 6,
    gap: 8,
  },
  chip: {
    height: 38,
    justifyContent: 'center',
    paddingHorizontal: 17,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
  },
  chipRest: {
    boxShadow: shadow.card,
  },
  chipSelected: {
    boxShadow: '0px 8px 18px rgba(20, 24, 43, 0.24)',
  },
  selectedFill: {
    backgroundColor: colors.gold,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    letterSpacing: -0.1,
  },
  labelSelected: {
    fontFamily: fonts.semibold,
    color: colors.homePanel,
  },
}))
