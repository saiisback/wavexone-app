import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg'

import { colors } from './colors'

/**
 * The light behind the home hero: soft pools of white light and neutral
 * grey shadow drifting slowly over the grouped grey — no hue — so the glass
 * card and sheet above have depth to frost. Only transforms animate, on the UI
 * thread. Never touchable.
 */
export function LiquidBackdrop() {
  return (
    <View pointerEvents="none" style={styles.layer}>
      <Orb color="#FFFFFF" size={440} top={-170} left={-150} opacity={1} period={12000} dx={40} dy={24} />
      <Orb color="#E2E2E7" size={400} top={-80} left={150} opacity={0.8} period={15000} dx={-34} dy={30} />
      <Orb color="#DCDCE2" size={320} top={210} left={-70} opacity={0.6} period={17000} dx={30} dy={-20} />
      <Orb color="#FFFFFF" size={300} top={240} left={200} opacity={0.9} period={13500} dx={-24} dy={-18} />
    </View>
  )
}

function Orb({
  color,
  size,
  top,
  left,
  opacity,
  period,
  dx,
  dy,
}: {
  color: string
  size: number
  top: number
  left: number
  opacity: number
  period: number
  dx: number
  dy: number
}) {
  const drift = useSharedValue(0)
  useEffect(() => {
    drift.set(withRepeat(withTiming(1, { duration: period, easing: Easing.inOut(Easing.sin) }), -1, true))
  }, [drift, period])
  const moving = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(drift.get(), [0, 1], [0, dx]) },
      { translateY: interpolate(drift.get(), [0, 1], [0, dy]) },
      { scale: interpolate(drift.get(), [0, 1], [1, 1.08]) },
    ],
  }))
  const id = `orb-${color.slice(1)}`
  return (
    <Animated.View style={[{ position: 'absolute', top, left, width: size, height: size }, moving]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="0.5" cy="0.5" r="0.5">
            <Stop offset="0" stopColor={color} stopOpacity={opacity} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  )
}

const styles = StyleSheet.create({
  layer: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
    overflow: 'hidden',
    backgroundColor: colors.bg,
  },
})
