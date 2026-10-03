import { Switch as RNSwitch } from 'react-native'

import { colors } from './colors'

/** Platform switch, tinted gold. */
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
      ios_backgroundColor={colors.track}
    />
  )
}

const TRACK = { false: colors.track, true: colors.navy }
