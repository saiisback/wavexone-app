import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg'

import {
  CandlesIcon,
  LiquidGlass,
  PressableScale,
  TAB_BAR_HEIGHT,
  Text,
  colors,
  fonts,
  motion,
  shadow,
} from '../design-system'
import { TabHomeIcon, TabMarketsIcon, TabMoreIcon, TabPositionsIcon } from './tab-icons'
import type { TabParamList } from './types'

/**
 * Hand-drawn tab bar in the manner of iOS 26: a floating capsule of frosted
 * Liquid Glass, a brighter glass lozenge that glides to the selected tab,
 * and the Trade button rising out of the centre as a disc of frosted white glass.
 *
 * A native tab bar cannot produce this layout — the centre control breaks
 * out above the bar. The frost is dense enough that content scrolling under
 * it reads only as soft colour, never as legible text.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()
  const [width, setWidth] = useState(0)
  const slot = width / Math.max(state.routes.length, 1)
  const tradeIndex = state.routes.findIndex((route) => route.name === 'Trade')
  const onTrade = state.index === tradeIndex

  const position = useSharedValue(state.index)
  useEffect(() => {
    position.set(withSpring(state.index, motion.glide))
  }, [state.index, position])
  const shown = useSharedValue(onTrade ? 0 : 1)
  useEffect(() => {
    shown.set(withTiming(onTrade ? 0 : 1, { duration: motion.fast }))
  }, [onTrade, shown])

  const capsule = useAnimatedStyle(() => ({
    opacity: width > 0 ? shown.get() : 0,
    transform: [
      { translateX: position.get() * slot + slot / 2 - CAPSULE_WIDTH / 2 },
      { scale: 0.85 + 0.15 * shown.get() },
    ],
  }))

  const bottom = Math.max(insets.bottom, 14)
  return (
    <>
    <EdgeFade height={bottom + TAB_BAR_HEIGHT + 28} />
    <View pointerEvents="box-none" style={[styles.dock, { bottom }]}>
      <LiquidGlass tint="frost" style={styles.surface} />
      <View style={styles.row} onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
        <Animated.View pointerEvents="none" style={[styles.capsule, capsule]} />
        {state.routes.map((route, index) => {
          const focused = state.index === index
          const name = route.name as keyof TabParamList
          const title = descriptors[route.key].options.title ?? name

          const onPress = () => {
            const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
            if (!focused && !event.defaultPrevented) navigation.navigate(route.name)
          }

          return (
            <PressableScale key={route.key} accessibilityLabel={title} onPress={onPress} scaleTo={0.9} style={styles.item}>
              <View accessibilityRole="tab" accessibilityState={{ selected: focused }} style={styles.cell}>
                <View style={styles.glyph}>
                  {name === 'Trade' ? <TradeDisc focused={focused} /> : <TabGlyph name={name} focused={focused} />}
                </View>
                <Text style={[styles.label, focused ? styles.labelActive : null]} numberOfLines={1}>
                  {title}
                </Text>
              </View>
            </PressableScale>
          )
        })}
      </View>
    </View>
    </>
  )
}

/**
 * iOS-style scroll-edge fade: the pearl canvas rising behind the floating
 * bar, so content passing beneath and around it dissolves rather than
 * showing through the gaps.
 */
function EdgeFade({ height }: { height: number }) {
  return (
    <View pointerEvents="none" style={[styles.fade, { height }]}>
      <Svg width="100%" height="100%" preserveAspectRatio="none">
        <Defs>
          <LinearGradient id="tab-edge-fade" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={colors.bg} stopOpacity={0} />
            <Stop offset="0.45" stopColor={colors.bg} stopOpacity={0.85} />
            <Stop offset="1" stopColor={colors.bg} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Rect width="100%" height="100%" fill="url(#tab-edge-fade)" />
      </Svg>
    </View>
  )
}

/**
 * The white glass disc that rises out of the bar, with a slow grey halo
 * breathing out from it. Taken out of flow so its label keeps the baseline
 * of the others; presses fall through to the row.
 */
function TradeDisc({ focused }: { focused: boolean }) {
  const halo = useSharedValue(0)
  useEffect(() => {
    halo.set(withDelay(900, withRepeat(withTiming(1, { duration: 2600, easing: Easing.out(Easing.quad) }), -1, false)))
  }, [halo])
  const haloStyle = useAnimatedStyle(() => ({
    opacity: interpolate(halo.get(), [0, 1], [0.22, 0]),
    transform: [{ scale: interpolate(halo.get(), [0, 1], [1, 1.5]) }],
  }))

  // A number in a shared value, turned into "Ndeg" per frame: the spring
  // itself can never be interpolated into a string.
  const spin = useSharedValue(focused ? 1 : 0)
  useEffect(() => {
    spin.set(withSpring(focused ? 1 : 0, motion.glide))
  }, [focused, spin])
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: -3 * spin.get() }, { scale: 1 + 0.04 * spin.get() }],
  }))
  const glyph = useAnimatedStyle(() => ({
    transform: [{ rotate: `${(180 * spin.get()).toFixed(2)}deg` }],
  }))

  return (
    <View style={styles.discAnchor} pointerEvents="none">
      <Animated.View style={[styles.halo, haloStyle]} />
      <Animated.View style={[styles.disc, lift]}>
        <LiquidGlass tint="frost" style={styles.discGlass}>
          <Animated.View style={glyph}>
            <CandlesIcon size={26} color={colors.text} />
          </Animated.View>
        </LiquidGlass>
      </Animated.View>
    </View>
  )
}

/** The tab's icon: outline at rest, filled and lifted when selected. */
function TabGlyph({ name, focused }: { name: keyof TabParamList; focused: boolean }) {
  const active = useSharedValue(focused ? 1 : 0)
  useEffect(() => {
    active.set(withSpring(focused ? 1 : 0, motion.spring))
  }, [focused, active])
  const lift = useAnimatedStyle(() => ({
    transform: [{ scale: 1 + 0.06 * active.get() }, { translateY: -1 * active.get() }],
  }))

  const color = focused ? colors.text : colors.textMuted
  const props = { size: 23, color, active: focused }
  return (
    <Animated.View style={lift}>
      {name === 'Home' ? <TabHomeIcon {...props} /> : null}
      {name === 'Markets' ? <TabMarketsIcon {...props} /> : null}
      {name === 'Positions' ? <TabPositionsIcon {...props} /> : null}
      {name === 'More' ? <TabMoreIcon {...props} /> : null}
    </Animated.View>
  )
}

const DISC = 58
const GLYPH = 28
const CAPSULE_WIDTH = 62

const styles = StyleSheet.create({
  fade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  dock: {
    position: 'absolute',
    left: 14,
    right: 14,
  },
  // Dense frost: whatever scrolls beneath reads as colour, not text.
  surface: {
    ...StyleSheet.absoluteFill,
    borderRadius: 34,
  },
  row: {
    height: TAB_BAR_HEIGHT,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 6,
  },
  // The selected lozenge: brighter glass with its own rim.
  capsule: {
    position: 'absolute',
    left: 6,
    top: (TAB_BAR_HEIGHT - 54) / 2,
    width: CAPSULE_WIDTH,
    height: 54,
    borderRadius: 27,
    backgroundColor: colors.track,
  },
  item: {
    flex: 1,
  },
  cell: {
    alignItems: 'center',
    justifyContent: 'center',
    height: TAB_BAR_HEIGHT,
    gap: 3,
  },
  glyph: {
    height: GLYPH,
    width: GLYPH,
    alignItems: 'center',
    justifyContent: 'center',
  },
  discAnchor: {
    position: 'absolute',
    left: -40,
    right: -40,
    top: GLYPH / 2 - 20 - DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  halo: {
    position: 'absolute',
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    backgroundColor: colors.textSubtle,
  },
  disc: {
    width: DISC,
    height: DISC,
    borderRadius: DISC / 2,
    boxShadow: shadow.fab,
  },
  discGlass: {
    flex: 1,
    borderRadius: DISC / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    lineHeight: 14,
    color: colors.textSubtle,
  },
  labelActive: {
    fontFamily: fonts.semibold,
    color: colors.text,
  },
})
