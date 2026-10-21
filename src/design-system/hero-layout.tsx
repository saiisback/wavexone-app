import { useThemeStyles, useTheme } from './theme'
import type { Palette } from './colors'
import { useIsFocused } from '@react-navigation/native'
import { BlurView } from 'expo-blur'
import { StatusBar } from 'expo-status-bar'
import { Platform, StyleSheet, View, type NativeScrollEvent, type NativeSyntheticEvent, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { LiquidBackdrop } from './liquid-backdrop'
import { Reveal } from './motion'
import { TAB_BAR_CLEARANCE } from './screen'
import { Text } from './text'
import { SCREEN_PADDING, radius, spacing } from './tokens'

/** How far the content sheet rides up over the navy header. */
const SHEET_OVERLAP = radius.sheet

/**
 * Scroll position for a hero screen, kept in a shared value so the header can
 * react on the UI thread without re-rendering. `onScroll` is the Reanimated
 * handler for `Animated.ScrollView`; `onScrollJS` feeds lists (FlashList)
 * that wrap their own scroll handler.
 */
export function useHeroScroll() {
  const scrollY = useSharedValue(0)
  const onScroll = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollY.set(event.contentOffset.y)
    },
  })
  const onScrollJS = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    scrollY.set(event.nativeEvent.contentOffset.y)
  }
  return { scrollY, onScroll, onScrollJS }
}

/**
 * The navy top of every main tab: a bar of controls under the status bar,
 * then the screen's hero, which drifts up slower than the page and fades as
 * the sheet slides over it.
 */
export function HeroHeader({
  scrollY,
  bar,
  children,
  style,
}: {
  scrollY: SharedValue<number>
  /** Controls along the top: avatar, title, account, bell. */
  bar?: React.ReactNode
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const styles = useThemeStyles(themeStyles)

  const insets = useSafeAreaInsets()
  const focused = useIsFocused()

  const parallax = useAnimatedStyle(() => {
    const y = scrollY.get()
    return {
      opacity: interpolate(y, [0, 200], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [-120, 0, 240], [-24, 0, 96], Extrapolation.CLAMP) },
        { scale: interpolate(y, [-160, 0, 240], [1.04, 1, 0.94], Extrapolation.CLAMP) },
      ],
    }
  })

  return (
    <View style={[styles.header, { paddingTop: insets.top + spacing.xs }, style]}>
      {/* Dark status bar text over the pearl light, only while this screen shows. */}
      {focused ? <StatusBar style="dark" /> : null}
      {bar ? <View style={styles.bar}>{bar}</View> : null}
      {children ? <Animated.View style={[styles.hero, parallax]}>{children}</Animated.View> : null}
    </View>
  )
}

/** The grouped page the content sits on, continuing seamlessly from the hero. */
export function ContentSheet({
  children,
  style,
  bottomInset = TAB_BAR_CLEARANCE,
}: {
  children?: React.ReactNode
  style?: StyleProp<ViewStyle>
  /** Space kept clear at the bottom; the tab bar's by default. */
  bottomInset?: number
}) {
  const styles = useThemeStyles(themeStyles)

  return (
    <Reveal distance={40} style={[styles.sheet, { paddingBottom: bottomInset }, style]}>
      {children}
    </Reveal>
  )
}

/**
 * A slim frosted bar that fades in over the top once the hero has scrolled
 * away, so the screen's key figure stays in view.
 */
export function CompactBar({
  scrollY,
  title,
  value,
  threshold = 170,
}: {
  scrollY: SharedValue<number>
  title: string
  value?: string
  /** Scroll offset at which the bar is fully shown. */
  threshold?: number
}) {
  const styles = useThemeStyles(themeStyles)
  const { scheme } = useTheme()

  const insets = useSafeAreaInsets()
  const shown = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.get(), [threshold - 50, threshold], [0, 1], Extrapolation.CLAMP)
    return { opacity: progress, transform: [{ translateY: (1 - progress) * -8 }] }
  })

  return (
    <Animated.View pointerEvents="none" style={[styles.compact, { paddingTop: insets.top }, shown]}>
      {Platform.OS === 'android' ? null : <BlurView intensity={60} tint={scheme} style={styles.sheetBlur} />}
      <View style={styles.compactRow}>
        <Text variant="strong" numberOfLines={1}>
          {title}
        </Text>
        {value ? (
          <Text variant="strong" numberOfLines={1} style={styles.compactValue}>
            {value}
          </Text>
        ) : null}
      </View>
    </Animated.View>
  )
}

/**
 * The layout every main tab shares: navy header with a hero, the pearl
 * sheet sliding over it, and a compact bar that takes over on scroll.
 * Screens with long virtualised lists compose the same parts around a
 * FlashList instead.
 */
export function HeroScreen({
  bar,
  hero,
  compact,
  children,
  sheetStyle,
  bottomInset,
  overlay,
}: {
  bar?: React.ReactNode
  hero?: React.ReactNode
  compact?: { title: string; value?: string }
  children?: React.ReactNode
  sheetStyle?: StyleProp<ViewStyle>
  bottomInset?: number
  /** Floating chrome drawn above the scroll view: a docked action bar. */
  overlay?: React.ReactNode
}) {
  const styles = useThemeStyles(themeStyles)

  const { scrollY, onScroll } = useHeroScroll()
  return (
    <View style={styles.root}>
      <HeroLight scrollY={scrollY} />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <HeroHeader scrollY={scrollY} bar={bar}>
          {hero}
        </HeroHeader>
        <ContentSheet style={sheetStyle} bottomInset={bottomInset}>
          {children}
        </ContentSheet>
      </Animated.ScrollView>
      {compact ? <CompactBar scrollY={scrollY} title={compact.title} value={compact.value} /> : null}
      {overlay}
    </View>
  )
}

/**
 * The drifting light behind the hero, fixed behind the scroll view so the
 * glass sheet blurs it as it rides up. It eases up a little with the page.
 */
function HeroLight({ scrollY }: { scrollY: SharedValue<number> }) {
  const styles = useThemeStyles(themeStyles)

  const drift = useAnimatedStyle(() => ({
    transform: [{ translateY: interpolate(scrollY.get(), [-200, 0, 400], [0, 0, -120], Extrapolation.CLAMP) }],
  }))
  return (
    <Animated.View pointerEvents="none" style={[styles.light, drift]}>
      <LiquidBackdrop />
    </Animated.View>
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  light: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 640,
  },
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
  },
  header: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: SHEET_OVERLAP + spacing.xl,
    gap: spacing.lg,
  },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: 48,
    gap: spacing.md,
  },
  hero: {
    gap: spacing.md,
  },
  sheet: {
    flexGrow: 1,
    marginTop: -SHEET_OVERLAP,
    paddingTop: spacing.xl + spacing.sm,
    gap: spacing.xxl - 4,
    backgroundColor: colors.bg,
    boxShadow: '0px -8px 24px rgba(17, 26, 66, 0.06)',
    borderTopLeftRadius: radius.sheet,
    borderTopRightRadius: radius.sheet,
    borderCurve: 'continuous',
    overflow: 'hidden',
  },
  compact: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    overflow: 'hidden',
    backgroundColor: colors.compactBar,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderColor: colors.divider,
  },
  sheetBlur: {
    ...StyleSheet.absoluteFill,
    zIndex: -1,
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.md,
    height: 52,
    paddingHorizontal: SCREEN_PADDING,
  },
  compactValue: {
    fontVariant: ['tabular-nums'],
  },
}))
