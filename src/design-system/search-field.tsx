import { StyleSheet, View } from 'react-native'

import { colors } from './colors'
import { SearchIcon } from './icons'
import { Input } from './input'
import { fonts, radius, shadow } from './tokens'

/** The one search box: Markets, Balance and the instrument picker. */
export function SearchField({
  value,
  onChangeText,
  placeholder = 'Search markets',
}: {
  value: string
  onChangeText: (value: string) => void
  placeholder?: string
}) {
  return (
    <View style={styles.field}>
      <SearchIcon size={20} color={colors.textMuted} />
      <Input
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        accessibilityLabel={placeholder}
        placeholderTextColor={colors.textMuted}
        style={styles.input}
        returnKeyType="search"
        autoCorrect={false}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    borderRadius: radius.card,
    borderCurve: 'continuous',
    backgroundColor: colors.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: colors.border,
    boxShadow: shadow.card,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
    // Keeps the caret on the same baseline across platforms.
    padding: 0,
  },
})
