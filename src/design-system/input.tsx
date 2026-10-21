import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { StyleSheet, TextInput, type TextInputProps } from 'react-native'

import { fonts } from './tokens'

/**
 * Unlabelled input primitive for compact search fields: body type, brand
 * caret, no platform chrome. The caller draws the surface. Forms should use
 * `Field`.
 */
export function Input({ style, ...props }: TextInputProps) {
  const colors = useColors()
  const styles = useThemeStyles(themeStyles)

  return (
    <TextInput
      selectionColor={colors.brandBright}
      cursorColor={colors.brandBright}
      placeholderTextColor={colors.textSubtle}
      {...props}
      style={[styles.input, style]}
    />
  )
}

const themeStyles = (colors: Palette) => (StyleSheet.create({
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    padding: 0,
    // The surrounding field draws focus; web's own ring would double it.
    outlineWidth: 0,
  },
}))
