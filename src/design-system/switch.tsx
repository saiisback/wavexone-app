import { useColors, useThemeStyles } from './theme'
import type { Palette } from './colors'
import { Platform, Switch as RNSwitch } from 'react-native'


/**
 * Platform switch: the brand navy when on, the quiet track when off, with a
 * white thumb on every platform.
 */
export function Switch({
  value,
  onValueChange,
  disabled,
  accessibilityLabel,
}: {
  value: boolean
  onValueChange: (value: boolean) => void
  disabled?: boolean
  accessibilityLabel?: string
}) {
  const colors = useColors()
  const WEB_THUMB = useThemeStyles(themeWEB_THUMB)
  const TRACK = useThemeStyles(themeTRACK)

  return (
    <RNSwitch
      value={value}
      onValueChange={onValueChange}
      disabled={disabled}
      accessibilityLabel={accessibilityLabel}
      trackColor={TRACK}
      thumbColor={colors.surface}
      {...WEB_THUMB}
      ios_backgroundColor={colors.border}
    />
  )
}

/** react-native-web paints the "on" thumb teal unless told otherwise. */
const themeWEB_THUMB = (colors: Palette) => (Platform.OS === 'web' ? { activeThumbColor: colors.surface } : null)

const themeTRACK = (colors: Palette) => ({ false: colors.border, true: colors.brand })
