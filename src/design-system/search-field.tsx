import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { useEffect, useState } from 'react'
import { StyleSheet, View } from 'react-native'
import Animated, { interpolateColor, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated'

import { SearchIcon } from './icons'
import { Input } from './input'
import { fonts, motion, radius, shadow } from './tokens'

/**
 * The one search box: Markets, Balance and the instrument picker. A white
 * pill with a hairline; focusing it draws a soft ring in the bright brand
 * step and lifts the icon to the same colour.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search markets',
  tone = 'light',
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
  /** `onInk` frosts the field for a brand-gradient surface. */
  tone?: 'light' | 'onInk'
}) {
  const colors = useColors()
  const RING = useThemeStyles(themeRING)
  const RING_ON_INK = useThemeStyles(themeRING_ON_INK)
  const styles = useThemeStyles(themeStyles)

  const ink = tone === 'onInk'
  const [focused, setFocused] = useState(false)
  const focus = useSharedValue(0)
  useEffect(() => {
    focus.set(withTiming(focused ? 1 : 0, { duration: motion.fast }))
  }, [focused, focus])

  const ring = useAnimatedStyle(() => ({
    borderColor: interpolateColor(focus.get(), [0, 1], ink ? RING_ON_INK : RING),
  }))
  // The soft outer ring is its own layer, so only opacity animates.
  const halo = useAnimatedStyle(() => ({
    opacity: focus.get(),
    transform: [{ scale: 0.98 + focus.get() * 0.02 }],
  }))

  const muted = ink ? colors.onInkMuted : colors.textMuted
  return (
    <View>
      {ink ? null : <Animated.View pointerEvents="none" style={[styles.halo, halo]} />}
      <Animated.View style={[styles.field, ink ? styles.fieldOnInk : styles.fieldLight, ring]}>
        <SearchIcon size={19} color={ink ? colors.onInk : focused ? colors.brandBright : muted} />
        <View style={styles.inputWrap}>
          <Input
            value={value}
            onChangeText={onChangeText}
            placeholder={placeholder}
            accessibilityLabel={placeholder}
            placeholderTextColor={ink ? colors.onInkMuted : colors.textSubtle}
            style={[styles.input, ink ? styles.inputOnInk : null]}
            returnKeyType="search"
            autoCorrect={false}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
          />
        </View>
      </Animated.View>
    </View>
  )
}

const themeRING = (colors: Palette) => ([colors.border, colors.brandBright])
const themeRING_ON_INK = (colors: Palette) => ([colors.glassOnInkEdge, colors.onInk])

const themeStyles = (colors: Palette) => (StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 50,
    borderRadius: radius.pill,
    borderCurve: 'continuous',
    borderWidth: 1,
    backgroundColor: colors.glass,
    paddingHorizontal: 18,
  },
  fieldLight: {
    boxShadow: shadow.card,
  },
  halo: {
    position: 'absolute',
    top: -4,
    left: -4,
    right: -4,
    bottom: -4,
    borderRadius: radius.pill,
    backgroundColor: 'rgba(58, 79, 180, 0.12)',
  },
  fieldOnInk: {
    backgroundColor: colors.glassOnInk,
  },
  inputWrap: {
    flex: 1,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    // Keeps the caret on the same baseline across platforms.
    padding: 0,
    // Web draws its own focus ring inside the field; the field draws one already.
    outlineWidth: 0,
  },
  inputOnInk: {
    color: colors.onInk,
  },
}))
