import type { BottomTabBarProps } from '@react-navigation/bottom-tabs'
import { StyleSheet, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'

import {
  CandlesIcon,
  HomeIcon,
  MarketsIcon,
  MoreIcon,
  PositionsIcon,
  PositionsIconFilled,
  PressableScale,
  Text,
  colors,
  fonts,
  shadow,
} from '../design-system'
import type { TabParamList } from './types'

/**
 * Hand-drawn tab bar.
 *
 * A native tab bar cannot produce this layout — the centre "Trade" control is
 * a circle that breaks out above the bar, and the selected states differ per
 * tab (filled glyph, inverted badge, gold dots). Everything else in the app
 * uses native navigators.
 */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets()

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index
        const name = route.name as keyof TabParamList
        const { options } = descriptors[route.key]

        const onPress = () => {
          const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true })
          if (!focused && !event.defaultPrevented) {
            navigation.navigate(route.name)
          }
        }

        if (name === 'Trade') {
          return (
            <PressableScale key={route.key} onPress={onPress} scaleTo={0.9} style={styles.item}>
              <View
                accessibilityRole="tab"
                accessibilityState={{ selected: focused }}
                style={styles.glyph}
              >
                {/*
                 * The disc is taken out of flow so it cannot push into the
                 * label: the Trade label keeps the same baseline as every
                 * other tab, and only the circle breaks above the bar.
                 * `pointerEvents` is off so presses reach the row instead.
                 */}
                <View style={styles.fabAnchor} pointerEvents="none">
                  <View style={styles.cradle}>
                    <View style={styles.fab}>
                      <CandlesIcon size={26} color={colors.gold} />
                    </View>
                  </View>
                </View>
              </View>
              <Text style={[styles.label, focused ? styles.labelActive : null]}>
                {options.title ?? name}
              </Text>
            </PressableScale>
          )
        }

        return (
          <PressableScale key={route.key} onPress={onPress} scaleTo={0.9} style={styles.item}>
            <View
              accessibilityRole="tab"
              accessibilityState={{ selected: focused }}
              style={styles.glyph}
            >
              <TabGlyph name={name} focused={focused} />
            </View>
            <Text style={[styles.label, focused ? styles.labelActive : null]}>
              {options.title ?? name}
            </Text>
          </PressableScale>
        )
      })}
    </View>
  )
}

function TabGlyph({ name, focused }: { name: keyof TabParamList; focused: boolean }) {
  switch (name) {
    case 'Home':
      // Drawn solid in every state, exactly as in the mockups.
      return <HomeIcon size={25} color={focused ? colors.ink : colors.text} />
    case 'Markets':
      return <MarketsIcon size={25} color={focused ? colors.ink : colors.text} filled={focused} />
    case 'Positions':
      return focused ? <PositionsIconFilled size={25} /> : <PositionsIcon size={25} color={colors.text} />
    case 'More':
      return <MoreIcon size={25} color={focused ? colors.goldDeep : colors.text} />
    default:
      return null
  }
}

const FAB_SIZE = 58
/** Thin white ring so the bar reads as bulging around the button. */
const CRADLE_SIZE = FAB_SIZE + 8
const GLYPH_HEIGHT = 28
/** How far the FAB's centre sits above the other tabs' glyph centres. */
const FAB_LIFT = 9

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surface,
    paddingTop: 14,
  },
  item: {
    flex: 1,
    alignItems: 'center',
  },
  glyph: {
    height: GLYPH_HEIGHT,
    justifyContent: 'center',
  },
  // Centres the disc on the glyph row, then lifts it clear of the label.
  fabAnchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: GLYPH_HEIGHT / 2 - FAB_LIFT - CRADLE_SIZE / 2,
    alignItems: 'center',
  },
  // White disc that reads as the bar bulging upward around the Trade button.
  cradle: {
    width: CRADLE_SIZE,
    height: CRADLE_SIZE,
    borderRadius: CRADLE_SIZE / 2,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fab: {
    width: FAB_SIZE,
    height: FAB_SIZE,
    borderRadius: FAB_SIZE / 2,
    backgroundColor: colors.ink,
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: shadow.fab,
  },
  label: {
    // Spacing lives here rather than as `gap` on `item`: `PressableScale`
    // puts that style on its outer wrapper, whose only child is the press
    // target, so a gap there separates nothing.
    marginTop: 12,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 16,
    color: colors.text,
  },
  labelActive: {
    fontFamily: fonts.bold,
    color: colors.ink,
  },
})
