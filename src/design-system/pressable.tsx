import { Pressable as RNPressable, type AccessibilityState, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
  type AnimatedStyle,
} from 'react-native-reanimated'

export { Pressable } from 'react-native'

export type PressableScaleProps = {
  onPress?: () => void
  /** Opens a context menu on most rows. */
  onLongPress?: () => void
  children: React.ReactNode
  style?: StyleProp<AnimatedStyle<StyleProp<ViewStyle>>>
  /** How far the target shrinks while held. */
  scaleTo?: number
  disabled?: boolean
  hitSlop?: number
  accessibilityLabel?: string
  accessibilityState?: AccessibilityState
}

const TIMING = { duration: 120 }

/**
 * Press target with a spring-free scale response.
 *
 * The shared value stores the *state* (0 = idle, 1 = held) and the transform
 * is derived from it, so the animation itself runs on the UI thread.
 *
 * The press is detected by react-native's `Pressable` rather than a
 * `GestureDetector`. A gesture handler would keep the press-in state off the
 * JS thread too, but it does not reliably receive events inside a scroll
 * container on web — and most of these targets are rows inside a list. One
 * frame of latency on the scale-down is a cheaper price than a row that
 * silently ignores taps.
 */
export function PressableScale({
  onPress,
  onLongPress,
  children,
  style,
  scaleTo = 0.96,
  disabled = false,
  hitSlop = 0,
  accessibilityLabel,
  accessibilityState,
}: PressableScaleProps) {
  const pressed = useSharedValue(0)

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressed.get(), [0, 1], [1, scaleTo]) }],
    opacity: interpolate(pressed.get(), [0, 1], [1, 0.92]),
  }))

  return (
    <Animated.View style={[style, animatedStyle]}>
      <RNPressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ ...accessibilityState, disabled }}
        disabled={disabled}
        hitSlop={hitSlop}
        onPress={onPress}
        onLongPress={onLongPress}
        delayLongPress={380}
        onPressIn={() => pressed.set(withTiming(1, TIMING))}
        onPressOut={() => pressed.set(withTiming(0, TIMING))}
      >
        {children}
      </RNPressable>
    </Animated.View>
  )
}
