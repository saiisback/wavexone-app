import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native'
import Animated, {
  Extrapolation,
  interpolate,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Aurora } from './aurora'
import { CircleButton } from './circle-button'
import { colors } from './colors'
import { useHeroScroll } from './hero-layout'
import { ArrowLeftIcon } from './icons'
import { TAB_BAR_CLEARANCE } from './screen'
import { Text } from './text'
import { useSafeBack } from './use-safe-back'
import { SCREEN_PADDING, spacing } from './tokens'

/** Scroll offset at which the large title has fully handed over to the bar. */
const COLLAPSE_AT = 56
/** Height of the collapsed bar under the status bar. */
const BAR_HEIGHT = 52

/**
 * The large title that opens a light page: "Markets", "Positions". It sinks
 * and fades as the page scrolls, while `PageBar` takes over at the top, and
 * stretches a touch when the page is pulled down.
 */
export function PageTitle({
  scrollY,
  title,
  subtitle,
  trailing,
  leading,
  style,
}: {
  scrollY: SharedValue<number>
  title: string
  subtitle?: React.ReactNode
  /** Controls on the right: account pill, filter, add. */
  trailing?: React.ReactNode
  /** A back button; the title then sits beside it at heading size. */
  leading?: React.ReactNode
  style?: StyleProp<ViewStyle>
}) {
  const fade = useAnimatedStyle(() => {
    const y = scrollY.get()
    return {
      opacity: interpolate(y, [0, COLLAPSE_AT], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [-100, 0], [10, 0], Extrapolation.CLAMP) },
        { scale: interpolate(y, [-140, 0, COLLAPSE_AT], [1.06, 1, 0.96], Extrapolation.CLAMP) },
      ],
    }
  })

  return (
    <View style={[styles.titleBlock, style]}>
      <View style={styles.titleRow}>
        {leading}
        <Animated.View style={[styles.titleText, leading ? null : styles.titleOrigin, fade]}>
          <Text variant={leading ? 'heading' : 'title'} numberOfLines={1} accessibilityRole="header">
            {title}
          </Text>
          {subtitle ? (
            typeof subtitle === 'string' ? (
              <Text variant="caption" color={colors.textMuted} numberOfLines={1}>
                {subtitle}
              </Text>
            ) : subtitle
          ) : null}
        </Animated.View>
        {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
      </View>
    </View>
  )
}

/**
 * A frosted bar with the page's title in small type, fading in over the top
 * once the large title has scrolled away.
 */
export function PageBar({
  scrollY,
  title,
  trailing,
}: {
  scrollY: SharedValue<number>
  title: string
  trailing?: React.ReactNode
}) {
  const insets = useSafeAreaInsets()
  const shown = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.get(), [COLLAPSE_AT - 24, COLLAPSE_AT + 8], [0, 1], Extrapolation.CLAMP)
    return { opacity: progress }
  })
  const titleIn = useAnimatedStyle(() => {
    const progress = interpolate(scrollY.get(), [COLLAPSE_AT - 12, COLLAPSE_AT + 16], [0, 1], Extrapolation.CLAMP)
    return { opacity: progress, transform: [{ translateY: (1 - progress) * 8 }] }
  })

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.bar, { paddingTop: insets.top, height: insets.top + BAR_HEIGHT }, shown]}
    >
      <View style={styles.barRow} pointerEvents="box-none">
        <Animated.View style={titleIn} pointerEvents="none">
          <Text variant="strong" numberOfLines={1}>
            {title}
          </Text>
        </Animated.View>
        {trailing ? <View style={styles.barTrailing}>{trailing}</View> : null}
      </View>
    </Animated.View>
  )
}

/** The round back button used by every pushed page. */
export function BackButton({ onPress }: { onPress?: () => void }) {
  const goBack = useSafeBack()
  return (
    <CircleButton size={42} onPress={onPress ?? goBack} accessibilityLabel="Back">
      <ArrowLeftIcon size={20} color={colors.text} />
    </CircleButton>
  )
}

/**
 * The layout of every light page: a large title over the canvas, content
 * below it, and a frosted bar that takes the title over on scroll. Pass
 * `back` for pages pushed onto a stack. Screens with long virtualised lists
 * compose `PageTitle` and `PageBar` around a FlashList instead.
 */
export function PageScreen({
  title,
  subtitle,
  trailing,
  back = false,
  children,
  contentStyle,
  bottomInset = TAB_BAR_CLEARANCE,
  overlay,
  refreshControl,
}: {
  title: string
  subtitle?: React.ReactNode
  trailing?: React.ReactNode
  back?: boolean
  children?: React.ReactNode
  contentStyle?: StyleProp<ViewStyle>
  bottomInset?: number
  /** Floating chrome drawn above the scroll view: a docked action bar. */
  overlay?: React.ReactNode
  refreshControl?: React.ComponentProps<typeof Animated.ScrollView>['refreshControl']
}) {
  const insets = useSafeAreaInsets()
  const { scrollY, onScroll } = useHeroScroll()

  return (
    <View style={styles.root}>
      <Aurora />
      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="never"
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        refreshControl={refreshControl}
        contentContainerStyle={[styles.scroll, { paddingTop: insets.top + spacing.sm, paddingBottom: bottomInset }]}
      >
        <PageTitle
          scrollY={scrollY}
          title={title}
          subtitle={subtitle}
          trailing={trailing}
          leading={back ? <BackButton /> : undefined}
        />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </Animated.ScrollView>
      <PageBar scrollY={scrollY} title={title} />
      {overlay}
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  scroll: {
    flexGrow: 1,
  },
  titleBlock: {
    paddingHorizontal: SCREEN_PADDING,
    paddingBottom: spacing.xl,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    minHeight: 48,
  },
  titleText: {
    flex: 1,
    gap: 2,
  },
  titleOrigin: {
    transformOrigin: 'left',
  },
  trailing: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  content: {
    gap: spacing.xxl,
  },
  bar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(250, 250, 252, 0.9)',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  barRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: SCREEN_PADDING,
  },
  barTrailing: {
    position: 'absolute',
    right: SCREEN_PADDING,
    flexDirection: 'row',
    gap: spacing.sm,
  },
})
