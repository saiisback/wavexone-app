import { useEffect, useRef } from 'react'
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated'

import { radius, motion } from './tokens'

/**
 * Fades a block up into place when it first mounts. Siblings pass their
 * order as `index` so a screen settles top to bottom rather than all at once.
 * Reanimated honours the system's reduce-motion setting.
 */
export function Reveal({
  index = 0,
  distance = 10,
  style,
  children,
}: {
  index?: number
  /** How far below its resting place the block starts. */
  distance?: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  // Driven by a shared value rather than a layout animation: those take the
  // view out of flow on web while they run, which collapses its parent.
  const shown = useSharedValue(0)
  useEffect(() => {
    shown.set(withDelay(index * motion.stagger, withTiming(1, REVEAL)))
  }, [index, shown])
  const entering = useAnimatedStyle(() => ({
    opacity: shown.get(),
    transform: [{ translateY: (1 - shown.get()) * distance }, { scale: 0.98 + shown.get() * 0.02 }],
  }))

  return <Animated.View style={[style, entering]}>{children}</Animated.View>
}

/**
 * Washes its children green or red for a moment when `value` moves, so a
 * live price reads as alive without the number itself jumping around.
 */
export function TickFlash({
  value,
  style,
  children,
}: {
  value: number
  style?: StyleProp<ViewStyle>
  children: React.ReactNode
}) {
  const flash = useSharedValue(0)
  const rising = useSharedValue(1)
  const previous = useRef(value)

  useEffect(() => {
    if (value === previous.current) return
    rising.set(value > previous.current ? 1 : 0)
    previous.current = value
    flash.set(withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 720 })))
  }, [value, flash, rising])

  const tint = useAnimatedStyle(() => {
    // Fixed decimals: as the flash fades, a plain number can print as
    // "1.04e-8", which is not a colour Reanimated can parse (it throws).
    const alpha = (0.14 * flash.get()).toFixed(3)
    return {
      backgroundColor: rising.get() === 1 ? `rgba(22, 124, 59, ${alpha})` : `rgba(204, 48, 38, ${alpha})`,
    }
  })

  return <Animated.View style={[styles.flash, style, tint]}>{children}</Animated.View>
}

const REVEAL = { duration: motion.reveal, easing: Easing.out(Easing.exp) }

/**
 * Keep financial figures exact. Interpolating live values with React state on
 * every animation frame kept the JS thread busy between feed updates and while
 * navigating. The options argument remains compatible with existing callers.
 */
export function useCountUp(value: number, _options: { duration?: number } = {}) {
  return value
}

/**
 * Scales its child in with a spring when it first appears: badges, dots,
 * success ticks.
 */
export function PopIn({ delay = 0, style, children }: { delay?: number; style?: StyleProp<ViewStyle>; children: React.ReactNode }) {
  const shown = useSharedValue(0)
  useEffect(() => {
    shown.set(withDelay(delay, withSpring(1, motion.spring)))
  }, [delay, shown])
  const pop = useAnimatedStyle(() => ({
    opacity: Math.min(shown.get() * 1.4, 1),
    transform: [{ scale: 0.6 + shown.get() * 0.4 }],
  }))
  return <Animated.View style={[style, pop]}>{children}</Animated.View>
}

/**
 * A soft dot that breathes — the "live" marker beside streaming prices.
 */
export function LiveDot({ color, size = 8 }: { color: string; size?: number }) {
  const pulse = useSharedValue(0)
  useEffect(() => {
    pulse.set(withRepeat(withTiming(1, { duration: 1600, easing: Easing.out(Easing.quad) }), -1, false))
  }, [pulse])
  const ring = useAnimatedStyle(() => ({
    opacity: 0.45 * (1 - pulse.get()),
    transform: [{ scale: 1 + pulse.get() * 1.6 }],
  }))
  return (
    <Animated.View style={{ width: size, height: size }}>
      <Animated.View style={[{ position: 'absolute', width: size, height: size, borderRadius: size / 2, backgroundColor: color }, ring]} />
      <Animated.View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color }} />
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  flash: {
    borderRadius: radius.sm,
    paddingHorizontal: 4,
    marginHorizontal: -4,
  },
})
