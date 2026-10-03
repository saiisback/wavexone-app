import { StyleSheet, TextInput, type TextInputProps } from 'react-native'

import { colors } from './colors'
import { fonts } from './tokens'

/**
 * Unlabelled input primitive for compact search fields: body type, brand
 * caret, no platform chrome. The caller draws the surface. Forms should use
 * `Field`.
 */
export function Input({ style, ...props }: TextInputProps) {
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

const styles = StyleSheet.create({
  input: {
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    padding: 0,
    // The surrounding field draws focus; web's own ring would double it.
    outlineWidth: 0,
  },
})
