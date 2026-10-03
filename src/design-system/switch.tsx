import { Platform, Switch as RNSwitch } from 'react-native'

import { colors } from './colors'

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
const WEB_THUMB = Platform.OS === 'web' ? { activeThumbColor: colors.surface } : null

const TRACK = { false: colors.border, true: colors.brand }
