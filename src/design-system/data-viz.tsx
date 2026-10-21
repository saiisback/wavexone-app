import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { useEffect } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withTiming,
} from 'react-native-reanimated'
import Svg, { Circle } from 'react-native-svg'

import { colors } from './colors'
import { motion, radius } from './tokens'

const themeFILL = (colors: Palette) => ({
  navy: colors.navy,
  brand: colors.brandBright,
  gold: colors.gold,
  ice: colors.ice,
  accent: colors.accentDeep,
  onInk: colors.onInk,
  green: colors.green,
  red: colors.red,
} as const)

const themeTRACK = (colors: Palette) => ({
  light: colors.navyTint,
  onInk: 'rgba(255, 255, 255, 0.16)',
} as const)

/**
 * A share of a whole, 0–1. The fill grows in from the left on mount and
 * glides to new values — animated with `scaleX`, so no layout per frame.
 */
export function ProgressBar({
  value,
  tone = 'navy',
  track = 'light',
  height = 8,
}: {
  value: number
  tone?: keyof ReturnType<typeof themeFILL>
  track?: keyof ReturnType<typeof themeTRACK>
  height?: number
}) {
  const FILL = useThemeStyles(themeFILL)
  const TRACK = useThemeStyles(themeTRACK)

  const clamped = Math.min(Math.max(value, 0), 1)
  const progress = useSharedValue(0)
  useEffect(() => {
    progress.set(withTiming(clamped, { duration: motion.reveal * 1.6, easing: Easing.out(Easing.cubic) }))
  }, [clamped, progress])
  const fill = useAnimatedStyle(() => ({ transform: [{ scaleX: progress.get() }] }))

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: height / 2, backgroundColor: TRACK[track] }]}
    >
      <Animated.View style={[styles.fill, { borderRadius: height / 2, backgroundColor: FILL[tone] }, fill]} />
    </View>
  )
}

export type DonutSegment = { key: string; value: number; color: string }

/**
 * Ring chart of parts of a whole, drawn clockwise from the top with a small
 * gap between rounded segments. The ring turns and fades in on mount — the
 * whole view animates rather than the SVG strokes, which Android cannot
 * animate natively. Whatever sits in `children` is centred inside.
 */
export function Donut({
  segments,
  size = 132,
  thickness = 14,
  children,
}: {
  segments: readonly DonutSegment[]
  size?: number
  thickness?: number
  children?: React.ReactNode
}) {
  const total = segments.reduce((sum, item) => sum + Math.max(item.value, 0), 0)
  const r = (size - thickness) / 2
  const circumference = 2 * Math.PI * r
  const many = segments.length > 1
  const gap = many ? Math.min(thickness * 0.9, circumference * 0.04) : 0

  const sweep = useSharedValue(0)
  useEffect(() => {
    sweep.set(0)
    sweep.set(withDelay(120, withTiming(1, { duration: 1000, easing: Easing.out(Easing.cubic) })))
  }, [total, sweep])
  const turning = useAnimatedStyle(() => ({
    opacity: sweep.get(),
    transform: [{ rotate: `${(-90 - 120 * (1 - sweep.get())).toFixed(2)}deg` }, { scale: 0.86 + 0.14 * sweep.get() }],
  }))

  let offset = 0
  return (
    <View style={{ width: size, height: size }}>
      <DonutTrack size={size} r={r} thickness={thickness} />
      <Animated.View style={[styles.layer, turning]}>
        <Svg width={size} height={size}>
          {total > 0
            ? segments.map((segment) => {
                const length = (Math.max(segment.value, 0) / total) * circumference
                // Round caps reach half a stroke past each end of the dash.
                const dash = Math.max(length - gap - (many ? thickness : 0), 0.1)
                const start = offset + (many ? thickness / 2 : 0)
                offset += length
                return (
                  <Circle
                    key={segment.key}
                    cx={size / 2}
                    cy={size / 2}
                    r={r}
                    stroke={segment.color}
                    strokeWidth={thickness}
                    strokeLinecap="round"
                    strokeDasharray={`${dash} ${circumference - dash}`}
                    strokeDashoffset={-start}
                    fill="none"
                  />
                )
              })
            : null}
        </Svg>
      </Animated.View>
      <View style={styles.center}>{children}</View>
    </View>
  )
}

/** The empty ring behind the segments; it does not turn. */
function DonutTrack({ size, r, thickness }: { size: number; r: number; thickness: number }) {
  const colors = useColors()

  return (
    <Svg width={size} height={size} style={styles.layer}>
      <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.track} strokeWidth={thickness} fill="none" />
    </Svg>
  )
}

/** Navy, soft blue, then soft tints, for chart segments. */
export const SERIES_COLORS = [
  colors.brand,
  colors.accent,
  colors.brandSky,
  colors.tintAmberInk,
  colors.tintMintInk,
  colors.tintRoseInk,
] as const

const styles = StyleSheet.create({
  track: {
    overflow: 'hidden',
    width: '100%',
  },
  fill: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
    right: 0,
    transformOrigin: 'left',
    borderCurve: 'continuous',
  },
  layer: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  center: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pill,
  },
})
