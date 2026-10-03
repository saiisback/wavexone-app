import { StyleSheet, View, type ViewProps } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import { Aurora } from './aurora'
import { colors } from './colors'
import { SCREEN_PADDING } from './tokens'

/** Height of the floating glass tab bar, without the safe-area inset under it. */
export const TAB_BAR_HEIGHT = 66

/**
 * Height reserved under scrolling content so the floating tab bar never
 * covers it: the bar, its gap from the bottom edge and the home indicator.
 */
export const TAB_BAR_CLEARANCE = 132

/** Distance from the bottom of the screen to the top of the floating tab bar. */
export function useTabBarTop() {
  const insets = useSafeAreaInsets()
  return Math.max(insets.bottom, 14) + TAB_BAR_HEIGHT
}

/**
 * Page container.
 *
 * Screens here draw their own headers rather than using the native stack
 * header, so the top safe-area inset is applied explicitly. Pass
 * `edges={[]}` when a screen bleeds its own artwork under the status bar.
 */
export function Screen({
  children,
  edges = ['top'],
  aurora = true,
  style,
  ...rest
}: ViewProps & {
  edges?: readonly ('top' | 'bottom')[]
  /** The ambient canvas; off under full-bleed dark headers. */
  aurora?: boolean
}) {
  const insets = useSafeAreaInsets()

  return (
    <View
      {...rest}
      style={[
        styles.root,
        {
          paddingTop: edges.includes('top') ? insets.top : 0,
          paddingBottom: edges.includes('bottom') ? insets.bottom : 0,
        },
        style,
      ]}
    >
      {aurora ? <Aurora /> : null}
      {children}
    </View>
  )
}

/** Standard horizontal gutter. */
export function Gutter({ style, ...rest }: ViewProps) {
  return <View {...rest} style={[styles.gutter, style]} />
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: colors.bg,
  },
  gutter: {
    paddingHorizontal: SCREEN_PADDING,
  },
})
