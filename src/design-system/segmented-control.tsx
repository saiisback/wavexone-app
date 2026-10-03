import { useState } from 'react'
import { Pressable, StyleSheet, View } from 'react-native'
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated'

import { colors } from './colors'
import { Text } from './text'
import { fonts, motion, radius } from './tokens'

export type SegmentedControlProps<T extends string> = {
  options: readonly T[]
  value: T
  onChange: (value: T) => void
}

const INSET = 4

/**
 * Apple-style segmented control: a soft grey track and a white thumb that
 * glides to the selected option on a spring, so the change is felt.
 */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  const [width, setWidth] = useState(0)
  const segment = width > 0 ? (width - INSET * 2) / options.length : 0
  const index = Math.max(options.indexOf(value), 0)

  // Only the transform animates; the width is plain layout set once measured.
  const thumb = useAnimatedStyle(() => ({
    transform: [{ translateX: withSpring(index * segment, motion.glide) }],
  }))

  return (
    <View style={styles.track} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      <Animated.View
        pointerEvents="none"
        style={[styles.thumb, { width: segment, opacity: segment > 0 ? 1 : 0 }, thumb]}
      />
      {options.map((option) => {
        const selected = option === value
        return (
          <Pressable
            key={option}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            onPress={() => onChange(option)}
            style={styles.segment}
          >
            <Text style={[styles.label, selected ? styles.labelSelected : null]}>{option}</Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  track: {
    flexDirection: 'row',
    backgroundColor: colors.track,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    padding: INSET,
  },
  thumb: {
    position: 'absolute',
    top: INSET,
    bottom: INSET,
    left: INSET,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    boxShadow: '0px 0px 0px 0.5px rgba(0, 0, 0, 0.08), 0px 3px 8px rgba(20, 24, 43, 0.12), 0px 1px 1px rgba(20, 24, 43, 0.04)',
  },
  segment: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 14,
    color: colors.textMuted,
  },
  labelSelected: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
})
